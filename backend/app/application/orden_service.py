from collections import defaultdict
from datetime import date, datetime
from app import db
from app.infrastructure.models import Orden, Venta, Producto, Cliente, MovimientoInventario, MovimientoInsumo, Insumo
from app.domain.inventario import hay_stock_suficiente
from app.application.cliente_service import ClienteService


def _resolver_recursos(producto, cantidad):
    """
    Determina sobre qué recurso(s) real(es) se debe descontar stock al vender
    este producto, y devuelve una LISTA de (tipo, recurso, cantidad_efectiva)
    -una entrada por cada recurso a descontar-:

    - Si el producto es un paquete armado a partir de otro producto base
      (ej. 'Paquete empanadas ranchera x12'), devuelve una sola entrada
      ("producto", producto_base, cantidad de paquetes x unidades por paquete).
    - Si el producto tiene uno o varios insumos asociados (ej. hamburguesa ->
      pan, carne, queso), devuelve una entrada ("insumo", insumo, cantidad x
      cantidad_por_unidad) por cada insumo que usa.
    - Si no aplica ninguno de los anteriores, devuelve una sola entrada
      ("producto", producto, cantidad tal cual) - el comportamiento de siempre.
    """
    if producto.es_paquete and producto.producto_base and producto.unidades_por_paquete:
        return [("producto", producto.producto_base, cantidad * producto.unidades_por_paquete)]

    if producto.insumos_usados:
        return [
            ("insumo", pi.insumo, cantidad * float(pi.cantidad))
            for pi in producto.insumos_usados
            if pi.insumo
        ]

    return [("producto", producto, cantidad)]


def _resolver_fecha(data):
    """
    Si viene 'fecha' en el payload (YYYY-MM-DD), la combina con la hora actual
    para poder registrar ventas de días anteriores. Si no viene, devuelve None
    para que el modelo use su default (datetime.utcnow).
    """
    fecha_str = data.get("fecha")
    if not fecha_str:
        return None

    fecha_dia = date.fromisoformat(fecha_str)
    return datetime.combine(fecha_dia, datetime.utcnow().time())


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
    def _resolver_cliente(data, metodo_pago, cliente_actual_id=None):
        """Determina el cliente_id final para la orden, según el método de pago.

        - Para 'credito': el cliente es obligatorio, debe existir, estar activo
          y NO ser el cliente predeterminado (una deuda necesita un responsable real).
        - Para los demás métodos: el cliente es opcional. Si no se envía uno,
          se usa el cliente predeterminado automáticamente.

        Devuelve (cliente_id, error).
        """
        cliente_id = data.get("cliente_id", cliente_actual_id)

        if metodo_pago == "credito":
            if not cliente_id:
                return None, "cliente_id es obligatorio para ventas a crédito"

            cliente = Cliente.query.get(cliente_id)
            if not cliente:
                return None, f"Cliente no encontrado (id {cliente_id})"
            if not cliente.activo:
                return None, f"El cliente {cliente.nombre} no está activo"
            if cliente.es_predeterminado:
                return None, "No puedes registrar una cuenta por cobrar a nombre del cliente predeterminado; selecciona o crea un cliente real"

            return cliente_id, None

        # Métodos distintos a crédito: el cliente es opcional
        if not cliente_id:
            predeterminado = ClienteService.obtener_predeterminado()
            if not predeterminado:
                return None, "No hay un cliente predeterminado configurado; crea uno o selecciona un cliente"
            return predeterminado.id, None

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

        cliente_id, error = OrdenService._resolver_cliente(data, metodo_pago)
        if error:
            return None, error

        try:
            fecha_personalizada = _resolver_fecha(data)
        except ValueError:
            return None, "Formato de fecha inválido, usa YYYY-MM-DD"

        pagada = metodo_pago != "credito"

        productos_vendidos = {}
        cantidad_efectiva_por_producto = defaultdict(float)
        cantidad_efectiva_por_insumo = defaultdict(float)

        for item in items:
            if item.get("producto_id") is None or item.get("cantidad") is None:
                return None, "Cada línea del carrito necesita producto_id y cantidad"

            producto = Producto.query.get(item["producto_id"])
            if not producto:
                return None, f"Producto no encontrado (id {item['producto_id']})"
            productos_vendidos[item["producto_id"]] = producto

            cantidad = float(item["cantidad"])
            for tipo, recurso, cantidad_efectiva in _resolver_recursos(producto, cantidad):
                if tipo == "insumo":
                    cantidad_efectiva_por_insumo[recurso.id] += cantidad_efectiva
                else:
                    cantidad_efectiva_por_producto[recurso.id] += cantidad_efectiva

        for producto_stock_id, cantidad_total in cantidad_efectiva_por_producto.items():
            producto_stock = Producto.query.get(producto_stock_id)
            if not hay_stock_suficiente(float(producto_stock.stock_actual), cantidad_total):
                return None, f"Stock insuficiente: quedan {float(producto_stock.stock_actual)} de {producto_stock.nombre}"

        for insumo_id, cantidad_total in cantidad_efectiva_por_insumo.items():
            insumo = Insumo.query.get(insumo_id)
            if not hay_stock_suficiente(float(insumo.stock_actual), cantidad_total):
                return None, f"Stock insuficiente de {insumo.nombre}: quedan {float(insumo.stock_actual)} {insumo.unidad_medida}"

        orden = Orden(
            trabajadora_id=trabajadora_id,
            cliente_id=cliente_id,
            metodo_pago=metodo_pago,
            descripcion=descripcion,
            pagada=pagada,
            total=0,
        )
        if fecha_personalizada:
            orden.fecha = fecha_personalizada

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
            if fecha_personalizada:
                venta.fecha = fecha_personalizada

            db.session.add(venta)
            db.session.flush()

            for tipo, recurso, cantidad_efectiva in _resolver_recursos(producto, cantidad):
                recurso.stock_actual = float(recurso.stock_actual) - cantidad_efectiva

                if tipo == "insumo":
                    db.session.add(MovimientoInsumo(
                        insumo_id=recurso.id,
                        trabajadora_id=trabajadora_id,
                        venta_id=venta.id,
                        tipo="salida",
                        motivo="venta",
                        cantidad=cantidad_efectiva,
                    ))
                else:
                    db.session.add(MovimientoInventario(
                        producto_id=recurso.id,
                        trabajadora_id=trabajadora_id,
                        venta_id=venta.id,
                        tipo="salida",
                        motivo="venta",
                        cantidad=cantidad_efectiva,
                    ))

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

        cliente_id, error = OrdenService._resolver_cliente(
            data, metodo_pago, cliente_actual_id=orden.cliente_id
        )
        if error:
            return None, error

        if metodo_pago == "credito":
            # Si ya era a crédito, se respeta el estado de pago que tenía.
            # Si nace como crédito ahora (antes era otro método), queda pendiente.
            pagada = orden.pagada if orden.metodo_pago == "credito" else False
        else:
            pagada = True

        # 1. Stock "hipotético" — como si las líneas viejas no hubieran existido,
        #    usando lo que de verdad se descontó (guardado en cada movimiento),
        #    no lo que dice la línea de venta (que puede ser un paquete o insumos).
        stock_hipotetico_producto = {}
        stock_hipotetico_insumo = {}

        for venta in orden.ventas:
            if venta.movimiento:
                pid = venta.movimiento.producto_id
                producto_stock = Producto.query.get(pid)
                if producto_stock:
                    base = stock_hipotetico_producto.get(pid, float(producto_stock.stock_actual))
                    stock_hipotetico_producto[pid] = base + float(venta.movimiento.cantidad)

            movimientos_insumo_venta = MovimientoInsumo.query.filter_by(
                venta_id=venta.id, motivo="venta"
            ).all()
            for m in movimientos_insumo_venta:
                insumo = Insumo.query.get(m.insumo_id)
                if insumo:
                    base = stock_hipotetico_insumo.get(m.insumo_id, float(insumo.stock_actual))
                    stock_hipotetico_insumo[m.insumo_id] = base + float(m.cantidad)

        # 2. Resolver las líneas nuevas a su producto/insumo de stock real y validar.
        productos_vendidos = {}
        cantidad_efectiva_por_producto = defaultdict(float)
        cantidad_efectiva_por_insumo = defaultdict(float)

        for item in items:
            if item.get("producto_id") is None or item.get("cantidad") is None:
                return None, "Cada línea del pedido necesita producto_id y cantidad"

            producto = Producto.query.get(item["producto_id"])
            if not producto:
                return None, f"Producto no encontrado (id {item['producto_id']})"
            productos_vendidos[item["producto_id"]] = producto

            cantidad = float(item["cantidad"])
            for tipo, recurso, cantidad_efectiva in _resolver_recursos(producto, cantidad):
                if tipo == "insumo":
                    cantidad_efectiva_por_insumo[recurso.id] += cantidad_efectiva
                else:
                    cantidad_efectiva_por_producto[recurso.id] += cantidad_efectiva

        for producto_stock_id, cantidad_total in cantidad_efectiva_por_producto.items():
            producto_stock = Producto.query.get(producto_stock_id)
            if not producto_stock:
                return None, "Producto de stock no encontrado"
            disponible = stock_hipotetico_producto.get(producto_stock_id, float(producto_stock.stock_actual))
            if not hay_stock_suficiente(disponible, cantidad_total):
                return None, f"Stock insuficiente: quedan {disponible} de {producto_stock.nombre}"

        for insumo_id, cantidad_total in cantidad_efectiva_por_insumo.items():
            insumo = Insumo.query.get(insumo_id)
            if not insumo:
                return None, "Insumo no encontrado"
            disponible = stock_hipotetico_insumo.get(insumo_id, float(insumo.stock_actual))
            if not hay_stock_suficiente(disponible, cantidad_total):
                return None, f"Stock insuficiente de {insumo.nombre}: quedan {disponible} {insumo.unidad_medida}"

        # 3. Revertir stock real de las líneas viejas (usando los movimientos, no la venta).
        for venta in list(orden.ventas):
            if venta.movimiento:
                producto_stock = Producto.query.get(venta.movimiento.producto_id)
                if producto_stock:
                    producto_stock.stock_actual = float(producto_stock.stock_actual) + float(venta.movimiento.cantidad)
                db.session.delete(venta.movimiento)

            movimientos_insumo_venta = MovimientoInsumo.query.filter_by(
                venta_id=venta.id, motivo="venta"
            ).all()
            for m in movimientos_insumo_venta:
                m.insumo.stock_actual = float(m.insumo.stock_actual) + float(m.cantidad)
                db.session.delete(m)

            db.session.delete(venta)
        db.session.flush()

        # 4. Crear las líneas nuevas, descontando stock real (producto o insumos).
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

            for tipo, recurso, cantidad_efectiva in _resolver_recursos(producto, cantidad):
                recurso.stock_actual = float(recurso.stock_actual) - cantidad_efectiva

                if tipo == "insumo":
                    db.session.add(MovimientoInsumo(
                        insumo_id=recurso.id,
                        trabajadora_id=trabajadora_id,
                        venta_id=venta.id,
                        tipo="salida",
                        motivo="venta",
                        cantidad=cantidad_efectiva,
                    ))
                else:
                    db.session.add(MovimientoInventario(
                        producto_id=recurso.id,
                        trabajadora_id=trabajadora_id,
                        venta_id=venta.id,
                        tipo="salida",
                        motivo="venta",
                        cantidad=cantidad_efectiva,
                    ))

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

            movimientos_insumo_venta = MovimientoInsumo.query.filter_by(
                venta_id=venta.id, motivo="venta"
            ).all()
            for m in movimientos_insumo_venta:
                m.insumo.stock_actual = float(m.insumo.stock_actual) + float(m.cantidad)
                db.session.delete(m)

            db.session.delete(venta)

        db.session.delete(orden)
        db.session.commit()
        return True, None