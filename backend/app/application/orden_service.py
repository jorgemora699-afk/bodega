from collections import defaultdict
from app import db
from app.infrastructure.models import Orden, Venta, Producto, MovimientoInventario
from app.domain.inventario import hay_stock_suficiente


class OrdenService:

    @staticmethod
    def listar_todas():
        return Orden.query.order_by(Orden.fecha.desc()).all()

    @staticmethod
    def obtener_por_id(orden_id):
        return Orden.query.get(orden_id)

    @staticmethod
    def crear(data):
        trabajadora_id = data.get("trabajadora_id")
        metodo_pago = data.get("metodo_pago")
        items = data.get("items", [])

        if not trabajadora_id or not metodo_pago:
            return None, "trabajadora_id y metodo_pago son obligatorios"
        if not items:
            return None, "La orden debe tener al menos un producto"

        # Se agrupa por producto para validar el stock total pedido,
        # por si el mismo producto viene en más de una línea del carrito.
        cantidad_total_por_producto = defaultdict(float)
        for item in items:
            if item.get("producto_id") is None or item.get("cantidad") is None:
                return None, "Cada línea del carrito necesita producto_id y cantidad"
            cantidad_total_por_producto[item["producto_id"]] += float(item["cantidad"])

        productos_cache = {}
        for producto_id, cantidad_total in cantidad_total_por_producto.items():
            producto = Producto.query.get(producto_id)
            if not producto:
                return None, f"Producto no encontrado (id {producto_id})"
            if not hay_stock_suficiente(float(producto.stock_actual), cantidad_total):
                return None, f"Stock insuficiente: quedan {float(producto.stock_actual)} de {producto.nombre}"
            productos_cache[producto_id] = producto

        # Todas las validaciones pasaron — recién aquí se empieza a escribir en la BD.
        orden = Orden(trabajadora_id=trabajadora_id, metodo_pago=metodo_pago, total=0)
        db.session.add(orden)
        db.session.flush()

        total_orden = 0
        for item in items:
            producto = productos_cache[item["producto_id"]]
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

            producto.stock_actual = float(producto.stock_actual) - cantidad

            movimiento = MovimientoInventario(
                producto_id=producto.id,
                trabajadora_id=trabajadora_id,
                venta_id=venta.id,
                tipo="salida",
                motivo="venta",
                cantidad=cantidad,
            )
            db.session.add(movimiento)

        orden.total = total_orden
        db.session.commit()
        return orden, None

    @staticmethod
    def anular(orden_id):
        """Anula la orden completa: revierte el stock de cada línea y
        elimina la orden junto con sus ventas y movimientos asociados."""
        orden = Orden.query.get(orden_id)
        if not orden:
            return False, "Orden no encontrada"

        for venta in orden.ventas:
            producto = Producto.query.get(venta.producto_id)
            if producto:
                producto.stock_actual = float(producto.stock_actual) + float(venta.cantidad)
            if venta.movimiento:
                db.session.delete(venta.movimiento)
            db.session.delete(venta)

        db.session.delete(orden)
        db.session.commit()
        return True, None

    @staticmethod
    def actualizar(orden_id, data):
        orden = Orden.query.get(orden_id)
        if not orden:
            return None, "Orden no encontrada"

        metodo_pago = data.get("metodo_pago", orden.metodo_pago)
        trabajadora_id = data.get("trabajadora_id", orden.trabajadora_id)
        items = data.get("items")

        if items is None:
            return None, "La orden debe tener al menos un producto"
        if not items:
            return None, "La orden debe tener al menos un producto"

        # 1. Revertir el stock que las líneas actuales habían descontado,
        #    sin tocar la BD todavía — solo para poder validar el nuevo pedido
        #    contra el stock "como si la orden vieja no existiera".
        stock_hipotetico = {}
        for venta in orden.ventas:
            producto = Producto.query.get(venta.producto_id)
            if producto:
                stock_hipotetico[producto.id] = stock_hipotetico.get(
                    producto.id, float(producto.stock_actual)
                ) + float(venta.cantidad)

        # 2. Agrupar las nuevas líneas por producto (por si el mismo producto
        #    aparece en más de una línea) y validar stock suficiente.
        cantidad_total_por_producto = defaultdict(float)
        for item in items:
            if item.get("producto_id") is None or item.get("cantidad") is None:
                return None, "Cada línea del pedido necesita producto_id y cantidad"
            cantidad_total_por_producto[item["producto_id"]] += float(item["cantidad"])

        productos_cache = {}
        for producto_id, cantidad_total in cantidad_total_por_producto.items():
            producto = Producto.query.get(producto_id)
            if not producto:
                return None, f"Producto no encontrado (id {producto_id})"

            stock_disponible = stock_hipotetico.get(producto_id, float(producto.stock_actual))
            if not hay_stock_suficiente(stock_disponible, cantidad_total):
                return None, f"Stock insuficiente: quedan {stock_disponible} de {producto.nombre}"

            productos_cache[producto_id] = producto

        # 3. Todo válido — recién aquí se toca la base de datos.
        #    Revertir stock real de las líneas viejas y borrarlas junto
        #    con sus movimientos de inventario.
        for venta in list(orden.ventas):
            producto = Producto.query.get(venta.producto_id)
            if producto:
                producto.stock_actual = float(producto.stock_actual) + float(venta.cantidad)
            if venta.movimiento:
                db.session.delete(venta.movimiento)
            db.session.delete(venta)
        db.session.flush()

        # 4. Crear las líneas nuevas, descontando stock real.
        total_orden = 0
        for item in items:
            producto = productos_cache[item["producto_id"]]
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

            producto.stock_actual = float(producto.stock_actual) - cantidad

            movimiento = MovimientoInventario(
                producto_id=producto.id,
                trabajadora_id=trabajadora_id,
                venta_id=venta.id,
                tipo="salida",
                motivo="venta",
                cantidad=cantidad,
            )
            db.session.add(movimiento)

        orden.metodo_pago = metodo_pago
        orden.trabajadora_id = trabajadora_id
        orden.total = total_orden
        orden.editado = True

        db.session.commit()
        return orden, None