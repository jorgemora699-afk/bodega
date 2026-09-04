from datetime import datetime
from app import db
from app.infrastructure.models import Venta, Producto, MovimientoInventario


class VentaService:

    @staticmethod
    def listar_todas():
        return Venta.query.order_by(Venta.fecha.desc()).all()

    @staticmethod
    def obtener_por_id(venta_id):
        return Venta.query.get(venta_id)

    @staticmethod
    def crear(data):
        producto = Producto.query.get(data["producto_id"])
        if not producto:
            return None, "Producto no encontrado"

        cantidad = data["cantidad"]
        total = float(producto.precio_unitario) * cantidad

        venta = Venta(
            producto_id=producto.id,
            trabajadora_id=data["trabajadora_id"],
            cantidad=cantidad,
            precio_unitario=producto.precio_unitario,
            total=total,
            metodo_pago=data["metodo_pago"],
        )
        db.session.add(venta)
        db.session.flush()  # para tener venta.id antes del commit

        producto.stock_actual -= cantidad

        movimiento = MovimientoInventario(
            producto_id=producto.id,
            trabajadora_id=data["trabajadora_id"],
            venta_id=venta.id,
            tipo="salida",
            motivo="venta",
            cantidad=cantidad,
        )
        db.session.add(movimiento)
        db.session.commit()
        return venta, None

    @staticmethod
    def actualizar(venta_id, data):
        venta = Venta.query.get(venta_id)
        if not venta:
            return None, "Venta no encontrada"

        producto_anterior = Producto.query.get(venta.producto_id)
        cantidad_anterior = venta.cantidad

        # revertir el efecto anterior en el inventario
        producto_anterior.stock_actual += cantidad_anterior

        nuevo_producto_id = data.get("producto_id", venta.producto_id)
        nueva_cantidad = data.get("cantidad", cantidad_anterior)

        producto_nuevo = Producto.query.get(nuevo_producto_id)
        if not producto_nuevo:
            return None, "Producto no encontrado"

        # aplicar el nuevo efecto
        producto_nuevo.stock_actual -= nueva_cantidad

        venta.producto_id = nuevo_producto_id
        venta.trabajadora_id = data.get("trabajadora_id", venta.trabajadora_id)
        venta.cantidad = nueva_cantidad
        venta.precio_unitario = producto_nuevo.precio_unitario
        venta.total = float(producto_nuevo.precio_unitario) * nueva_cantidad
        venta.metodo_pago = data.get("metodo_pago", venta.metodo_pago)
        venta.editado = True

        if venta.movimiento:
            venta.movimiento.producto_id = nuevo_producto_id
            venta.movimiento.trabajadora_id = venta.trabajadora_id
            venta.movimiento.cantidad = nueva_cantidad
            venta.movimiento.fecha = datetime.utcnow()

        db.session.commit()
        return venta, None

    @staticmethod
    def eliminar(venta_id):
        venta = Venta.query.get(venta_id)
        if not venta:
            return False, "Venta no encontrada"

        producto = Producto.query.get(venta.producto_id)
        producto.stock_actual += venta.cantidad  # revertir el descuento de stock

        if venta.movimiento:
            db.session.delete(venta.movimiento)

        db.session.delete(venta)
        db.session.commit()
        return True, None