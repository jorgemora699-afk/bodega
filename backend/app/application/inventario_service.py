from app import db
from app.infrastructure.models import Producto, MovimientoInventario
from app.domain.inventario import esta_bajo_stock, hay_stock_suficiente, UMBRAL_BAJO_STOCK_DEFAULT

MOTIVOS_ENTRADA_VALIDOS = {"produccion", "ajuste"}
MOTIVOS_SALIDA_VALIDOS = {"consumo", "merma", "ajuste"}


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
    def productos_bajo_stock(umbral=None):
        """Si se pasa un umbral explícito, se usa igual para todos (comportamiento
        anterior, por compatibilidad). Si no, cada producto se compara contra su
        propio stock_minimo configurado."""
        productos = Producto.query.filter(Producto.activo == True).all()

        if umbral is not None:
            return [p for p in productos if esta_bajo_stock(float(p.stock_actual), umbral)]

        return [p for p in productos if esta_bajo_stock(float(p.stock_actual), float(p.stock_minimo))]


    @staticmethod
    def reportar_nivel(data):
        """La trabajadora dice cuánto TIENE ahora; se calcula la diferencia
        contra el stock guardado y se registra el movimiento que corresponda.

        - Menor al stock guardado: salida por la diferencia.
        - Mayor al stock guardado: entrada por la diferencia.
        - Igual: no hay cambios.

        El motivo enviado se respeta solo si es coherente con la dirección
        real del movimiento (ej. "produccion" en una entrada). Si no lo es
        (ej. "produccion" pero el número dio una salida), se registra como
        "ajuste".
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
            motivos_validos = MOTIVOS_SALIDA_VALIDOS
            cantidad_movimiento = diferencia
        else:
            tipo = "entrada"
            motivos_validos = MOTIVOS_ENTRADA_VALIDOS
            cantidad_movimiento = abs(diferencia)

        motivo_enviado = data.get("motivo")
        motivo = motivo_enviado if motivo_enviado in motivos_validos else "ajuste"

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