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