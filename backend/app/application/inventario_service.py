from app import db
from app.infrastructure.models import Producto, MovimientoInventario
from app.domain.inventario import esta_bajo_stock, hay_stock_suficiente, UMBRAL_BAJO_STOCK_DEFAULT


class InventarioService:

    @staticmethod
    def listar_movimientos(producto_id=None):
        query = MovimientoInventario.query
        if producto_id:
            query = query.filter_by(producto_id=producto_id)
        return query.order_by(MovimientoInventario.fecha.desc()).all()

    @staticmethod
    def registrar_entrada(data):
        """Producción: 'se hicieron 100 empanadas de pollo'"""
        producto = Producto.query.get(data["producto_id"])
        if not producto:
            return None, "Producto no encontrado"

        cantidad = data["cantidad"]
        producto.stock_actual += cantidad

        movimiento = MovimientoInventario(
            producto_id=producto.id,
            trabajadora_id=data.get("trabajadora_id"),
            tipo="entrada",
            motivo=data.get("motivo", "produccion"),
            cantidad=cantidad,
        )
        db.session.add(movimiento)
        db.session.commit()
        return movimiento, None

    @staticmethod
    def registrar_salida_manual(data):
        producto = Producto.query.get(data["producto_id"])
        if not producto:
            return None, "Producto no encontrado"

        cantidad = data["cantidad"]
        if not hay_stock_suficiente(producto.stock_actual, cantidad):
            return None, "La cantidad supera el stock actual"

        producto.stock_actual -= cantidad

        movimiento = MovimientoInventario(
            producto_id=producto.id,
            trabajadora_id=data.get("trabajadora_id"),
            tipo="salida",
            motivo=data.get("motivo", "merma"),
            cantidad=cantidad,
        )
        db.session.add(movimiento)
        db.session.commit()
        return movimiento, None

    @staticmethod
    def productos_bajo_stock(umbral=UMBRAL_BAJO_STOCK_DEFAULT):
        productos = Producto.query.filter(Producto.activo == True).all()
        return [p for p in productos if esta_bajo_stock(p.stock_actual, umbral)]