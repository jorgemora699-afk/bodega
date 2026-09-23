from collections import defaultdict
from app import db
from app.infrastructure.models import Orden, Venta, Producto, Cliente, MovimientoInventario
from app.domain.inventario import hay_stock_suficiente


def _resolver_stock(producto, cantidad):
    """Si el producto es un paquete armado a partir de otro producto base
    (ej. 'Paquete empanadas ranchera x12'), devuelve el producto base y la
    cantidad real que hay que descontar de su stock (cantidad de paquetes
    × unidades por paquete). Si no es un paquete, devuelve el producto y
    la cantidad tal cual, sin cambios."""
    if producto.es_paquete and producto.producto_base and producto.unidades_por_paquete:
        return producto.producto_base, cantidad * producto.unidades_por_paquete
    return producto, cantidad


class OrdenService:

    @staticmethod
    def listar_todas():
        return Orden.query.order_by(Orden.fecha.desc()).all()

    @staticmethod
    def obtener_por_id(orden_id):
        return Orden.query.get(orden_id)

    @staticmethod
    def listar_pendientes():
        return (
            Orden.query
            .filter_by(metodo_pago="credito", pagada=False)
            .order_by(Orden.fecha.asc())
            .all()
        )

    @staticmethod
    def _validar_cliente_credito(data, cliente_actual_id=None):
        """Para el método 'credito', el cliente es obligatorio y debe existir
        y estar activo. Devuelve (cliente_id, error)."""
        cliente_id = data.get("cliente_id", cliente_actual_id)

        if not cliente_id:
            return None, "cliente_id es obligatorio para ventas a crédito"

        cliente = Cliente.query.get(cliente_id)
        if not cliente:
            return None, f"Cliente no encontrado (id {cliente_id})"
        if not cliente.activo:
            return None, f"El cliente {cliente.nombre} no está activo"

        return cliente_id, None

    @staticmethod
    def crear(data):
        trabajadora_id = data.get("trabajadora_id")
        metodo_pago = data.get("metodo_pago")
        items = data.get("items", [])
        descripcion = data.get("descripcion")

        if not trabajadora_id or not metodo_pago:
            return None, "trabajadora_id y metodo_pago son obligatorios"
        if not items:
            return None, "La orden debe tener al menos un producto"

        cliente_id = None
        pagada = True

        if metodo_pago == "credito":
            cliente_id, error = OrdenService._validar_cliente_credito(data)
            if error:
                return None, error
            pagada = False

        productos_vendidos = {}
        cantidad_efectiva_por_stock = defaultdict(float)

        for item in items:
            if item.get("producto_id") is None or item.get("cantidad") is None:
                return None, "Cada línea del carrito necesita producto_id y cantidad"

            producto = Producto.query.get(item["producto_id"])
            if not producto:
                return None, f"Producto no encontrado (id {item['producto_id']})"
            productos_vendidos[item["producto_id"]] = producto

            cantidad = float(item["cantidad"])
            producto_stock, cantidad_efectiva = _resolver_stock(producto, cantidad)
            cantidad_efectiva_por_stock[producto_stock.id] += cantidad_efectiva

        for producto_stock_id, cantidad_total in cantidad_efectiva_por_stock.items():
            producto_stock = Producto.query.get(producto_stock_id)
            if not hay_stock_suficiente(float(producto_stock.stock_actual), cantidad_total):
                return None, f"Stock insuficiente: quedan {float(producto_stock.stock_actual)} de {producto_stock.nombre}"

        orden = Orden(
            trabajadora_id=trabajadora_id,
            cliente_id=cliente_id,
            metodo_pago=metodo_pago,
            descripcion=descripcion,
            pagada=pagada,
            total=0,
        )
        db.session.add(orden)
        db.session.flush()

        total_orden = 0
        for item in items:
            producto = productos_vendidos[item["producto_id"]]
            cantidad = float(item["cantidad"])
            subtotal = float(producto.precio_unitario) * cantidad
            total_orden += subtotal

            venta = Venta(
                producto_id=producto.id,
                trabajadora_id=trabajadora_id,
                cantidad=cantidad,
                precio_unitario=producto.precio_unitario,
                total=subtotal,
                metodo_pago=metodo_pago,
                orden_id=orden.id,
            )
            db.session.add(venta)
            db.session.flush()

            producto_stock, cantidad_efectiva = _resolver_stock(producto, cantidad)
            producto_stock.stock_actual = float(producto_stock.stock_actual) - cantidad_efectiva

            movimiento = MovimientoInventario(
                producto_id=producto_stock.id,
                trabajadora_id=trabajadora_id,
                venta_id=venta.id,
                tipo="salida",
                motivo="venta",
                cantidad=cantidad_efectiva,
            )
            db.session.add(movimiento)

        orden.total = total_orden
        db.session.commit()
        return orden, None

    @staticmethod
    def actualizar(orden_id, data):
        orden = Orden.query.get(orden_id)
        if not orden:
            return None, "Orden no encontrada"

        metodo_pago = data.get("metodo_pago", orden.metodo_pago)
        trabajadora_id = data.get("trabajadora_id", orden.trabajadora_id)
        descripcion = data.get("descripcion", orden.descripcion)
        items = data.get("items")

        if not items:
            return None, "La orden debe tener al menos un producto"

        cliente_id = orden.cliente_id
        pagada = orden.pagada

        if metodo_pago == "credito":
            cliente_id, error = OrdenService._validar_cliente_credito(data, cliente_actual_id=orden.cliente_id)
            if error:
                return None, error
            # Si la orden no era de crédito antes, ahora nace como deuda pendiente.
            # Si ya era de crédito, se respeta el estado de pago que ya tenía.
            if orden.metodo_pago != "credito":
                pagada = False
        else:
            # Deja de ser una venta a crédito: se considera pagada de inmediato,
            # como cualquier otro método de pago.
            cliente_id = None
            pagada = True

        # 1. Stock "hipotético" — como si las líneas viejas no hubieran existido,
        #    usando lo que de verdad se descontó (guardado en cada movimiento),
        #    no lo que dice la línea de venta (que puede ser un paquete).
        stock_hipotetico = {}
        for venta in orden.ventas:
            if not venta.movimiento:
                continue
            pid = venta.movimiento.producto_id
            producto_stock = Producto.query.get(pid)
            if producto_stock:
                base = stock_hipotetico.get(pid, float(producto_stock.stock_actual))
                stock_hipotetico[pid] = base + float(venta.movimiento.cantidad)

        # 2. Resolver las líneas nuevas a su producto de stock real y validar.
        productos_vendidos = {}
        cantidad_efectiva_por_stock = defaultdict(float)

        for item in items:
            if item.get("producto_id") is None or item.get("cantidad") is None:
                return None, "Cada línea del pedido necesita producto_id y cantidad"

            producto = Producto.query.get(item["producto_id"])
            if not producto:
                return None, f"Producto no encontrado (id {item['producto_id']})"
            productos_vendidos[item["producto_id"]] = producto

            cantidad = float(item["cantidad"])
            producto_stock, cantidad_efectiva = _resolver_stock(producto, cantidad)
            cantidad_efectiva_por_stock[producto_stock.id] += cantidad_efectiva

        for producto_stock_id, cantidad_total in cantidad_efectiva_por_stock.items():
            producto_stock = Producto.query.get(producto_stock_id)
            if not producto_stock:
                return None, "Producto de stock no encontrado"
            disponible = stock_hipotetico.get(producto_stock_id, float(producto_stock.stock_actual))
            if not hay_stock_suficiente(disponible, cantidad_total):
                return None, f"Stock insuficiente: quedan {disponible} de {producto_stock.nombre}"

        # 3. Revertir stock real de las líneas viejas (usando el movimiento, no la venta).
        for venta in list(orden.ventas):
            if venta.movimiento:
                producto_stock = Producto.query.get(venta.movimiento.producto_id)
                if producto_stock:
                    producto_stock.stock_actual = float(producto_stock.stock_actual) + float(venta.movimiento.cantidad)
                db.session.delete(venta.movimiento)
            db.session.delete(venta)
        db.session.flush()

        # 4. Crear las líneas nuevas, descontando stock real.
        total_orden = 0
        for item in items:
            producto = productos_vendidos[item["producto_id"]]
            cantidad = float(item["cantidad"])
            subtotal = float(producto.precio_unitario) * cantidad
            total_orden += subtotal

            venta = Venta(
                producto_id=producto.id,
                trabajadora_id=trabajadora_id,
                cantidad=cantidad,
                precio_unitario=producto.precio_unitario,
                total=subtotal,
                metodo_pago=metodo_pago,
                orden_id=orden.id,
                editado=True,
            )
            db.session.add(venta)
            db.session.flush()

            producto_stock, cantidad_efectiva = _resolver_stock(producto, cantidad)
            producto_stock.stock_actual = float(producto_stock.stock_actual) - cantidad_efectiva

            movimiento = MovimientoInventario(
                producto_id=producto_stock.id,
                trabajadora_id=trabajadora_id,
                venta_id=venta.id,
                tipo="salida",
                motivo="venta",
                cantidad=cantidad_efectiva,
            )
            db.session.add(movimiento)

        orden.metodo_pago = metodo_pago
        orden.trabajadora_id = trabajadora_id
        orden.cliente_id = cliente_id
        orden.descripcion = descripcion
        orden.pagada = pagada
        orden.total = total_orden
        orden.editado = True

        db.session.commit()
        return orden, None

    @staticmethod
    def marcar_pagada(orden_id):
        orden = Orden.query.get(orden_id)
        if not orden:
            return None, "Orden no encontrada"

        if orden.metodo_pago != "credito":
            return None, "Esta orden no es una venta a crédito"

        if orden.pagada:
            return None, "Esta orden ya está marcada como pagada"

        orden.pagada = True
        db.session.commit()
        return orden, None

    @staticmethod
    def anular(orden_id):
        orden = Orden.query.get(orden_id)
        if not orden:
            return False, "Orden no encontrada"

        for venta in orden.ventas:
            if venta.movimiento:
                producto_stock = Producto.query.get(venta.movimiento.producto_id)
                if producto_stock:
                    producto_stock.stock_actual = float(producto_stock.stock_actual) + float(venta.movimiento.cantidad)
                db.session.delete(venta.movimiento)
            db.session.delete(venta)

        db.session.delete(orden)
        db.session.commit()
        return True, None