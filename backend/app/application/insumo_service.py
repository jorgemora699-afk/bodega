from app import db
from app.infrastructure.models import Insumo, MovimientoInsumo


class InsumoService:

    @staticmethod
    def listar_todos(solo_activos=True):
        query = Insumo.query
        if solo_activos:
            query = query.filter_by(activo=True)
        return query.order_by(Insumo.nombre).all()

    @staticmethod
    def obtener_por_id(insumo_id):
        return Insumo.query.get(insumo_id)

    @staticmethod
    def crear(data):
        insumo = Insumo(
            nombre=data["nombre"],
            categoria=data.get("categoria", "cocina"),
            unidad_medida=data.get("unidad_medida", "unidad"),
            stock_actual=data.get("stock_actual", 0),
            stock_minimo=data.get("stock_minimo", 5),
        )
        db.session.add(insumo)
        db.session.commit()
        return insumo

    @staticmethod
    def actualizar(insumo_id, data):
        insumo = Insumo.query.get(insumo_id)
        if not insumo:
            return None

        if "nombre" in data:
            insumo.nombre = data["nombre"]
        if "categoria" in data:
            insumo.categoria = data["categoria"]
        if "unidad_medida" in data:
            insumo.unidad_medida = data["unidad_medida"]
        if "stock_minimo" in data:
            insumo.stock_minimo = data["stock_minimo"]
        if "activo" in data:
            insumo.activo = data["activo"]
        # stock_actual NO se edita aquí a propósito — mismo criterio que
        # con Producto: los cambios de stock pasan por entrada/salida,
        # para no perder la trazabilidad en MovimientoInsumo.

        db.session.commit()
        return insumo

    @staticmethod
    def eliminar(insumo_id):
        insumo = Insumo.query.get(insumo_id)
        if not insumo:
            return False
        insumo.activo = False  # borrado lógico, igual que Producto
        db.session.commit()
        return True

    @staticmethod
    def listar_movimientos(insumo_id=None):
        query = MovimientoInsumo.query
        if insumo_id:
            query = query.filter_by(insumo_id=insumo_id)
        return query.order_by(MovimientoInsumo.fecha.desc()).all()

    @staticmethod
    def registrar_entrada(data):
        insumo = Insumo.query.get(data["insumo_id"])
        if not insumo:
            return None, "Insumo no encontrado"

        cantidad = float(data["cantidad"])
        insumo.stock_actual = float(insumo.stock_actual) + cantidad

        movimiento = MovimientoInsumo(
            insumo_id=insumo.id,
            trabajadora_id=data.get("trabajadora_id"),
            tipo="entrada",
            motivo=data.get("motivo", "compra"),
            cantidad=cantidad,
        )
        db.session.add(movimiento)
        db.session.commit()
        return movimiento, None

    @staticmethod
    def registrar_salida(data):
        insumo = Insumo.query.get(data["insumo_id"])
        if not insumo:
            return None, "Insumo no encontrado"

        cantidad = float(data["cantidad"])
        if cantidad > float(insumo.stock_actual):
            return None, f"La cantidad supera el stock actual ({float(insumo.stock_actual)} {insumo.unidad_medida})"

        insumo.stock_actual = float(insumo.stock_actual) - cantidad

        movimiento = MovimientoInsumo(
            insumo_id=insumo.id,
            trabajadora_id=data.get("trabajadora_id"),
            tipo="salida",
            motivo=data.get("motivo", "uso"),
            cantidad=cantidad,
        )
        db.session.add(movimiento)
        db.session.commit()
        return movimiento, None

    @staticmethod
    def bajo_stock():
        insumos = Insumo.query.filter(Insumo.activo == True).all()
        return [i for i in insumos if float(i.stock_actual) <= float(i.stock_minimo)]