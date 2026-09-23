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

        cantidad = float(data["cantidad"])
        producto.stock_actual = float(producto.stock_actual) + cantidad

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

        cantidad = float(data["cantidad"])
        if not hay_stock_suficiente(float(producto.stock_actual), cantidad):
            return None, "La cantidad supera el stock actual"

        producto.stock_actual = float(producto.stock_actual) - cantidad

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
        return [p for p in productos if esta_bajo_stock(float(p.stock_actual), umbral)]


    @staticmethod
    def reportar_nivel(data):
        """Salida por nivel restante: la trabajadora dice cuánto QUEDA,
        no cuánto se produjo o salió. Se calcula la diferencia contra el
        stock guardado y se registra el movimiento correspondiente.

        - Si lo reportado es menor al stock guardado: es una salida por
        la diferencia (se usa el motivo que envíe el frontend).
        - Si lo reportado es mayor: el stock guardado estaba desactualizado.
        Se corrige con un ajuste hacia arriba, sin importar el motivo enviado.
        - Si es igual: no hay cambios que registrar.
        """
        producto = Producto.query.get(data["producto_id"])
        if not producto:
            return None, "Producto no encontrado"

        cantidad_restante = float(data["cantidad_restante"])
        if cantidad_restante < 0:
            return None, "La cantidad no puede ser negativa"

        stock_previo = float(producto.stock_actual)
        diferencia = round(stock_previo - cantidad_restante, 3)

        if diferencia == 0:
            return {"sin_cambios": True, "stock_actual": stock_previo}, None

        if diferencia > 0:
            tipo = "salida"
            motivo = data.get("motivo", "consumo")
            cantidad_movimiento = diferencia
        else:
            tipo = "entrada"
            motivo = "ajuste"
            cantidad_movimiento = abs(diferencia)

        producto.stock_actual = cantidad_restante

        movimiento = MovimientoInventario(
            producto_id=producto.id,
            trabajadora_id=data.get("trabajadora_id"),
            tipo=tipo,
            motivo=motivo,
            cantidad=cantidad_movimiento,
        )
        db.session.add(movimiento)
        db.session.commit()
        return movimiento, None