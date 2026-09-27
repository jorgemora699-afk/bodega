from datetime import datetime
from app import db
from app.infrastructure.models import IngresoEgreso


class IngresoEgresoService:

    @staticmethod
    def listar(tipo=None, desde=None, hasta=None):
        query = IngresoEgreso.query
        if tipo:
            query = query.filter_by(tipo=tipo)
        if desde:
            query = query.filter(IngresoEgreso.fecha >= desde)
        if hasta:
            query = query.filter(IngresoEgreso.fecha <= hasta)
        return query.order_by(IngresoEgreso.fecha.desc()).all()

    @staticmethod
    def obtener_por_id(registro_id):
        return IngresoEgreso.query.get(registro_id)

    @staticmethod
    def crear(data):
        registro = IngresoEgreso(
            tipo=data["tipo"],
            monto=data["monto"],
            descripcion=data["descripcion"],
            metodo_pago=data.get("metodo_pago"),
            proveedor_id=data.get("proveedor_id"),
        )
        db.session.add(registro)
        db.session.commit()
        return registro

    @staticmethod
    def actualizar(registro_id, data):
        registro = IngresoEgreso.query.get(registro_id)
        if not registro:
            return None

        if "tipo" in data:
            registro.tipo = data["tipo"]
        if "monto" in data:
            registro.monto = data["monto"]
        if "descripcion" in data:
            registro.descripcion = data["descripcion"]
        if "metodo_pago" in data:
            registro.metodo_pago = data["metodo_pago"]
        if "proveedor_id" in data:
            registro.proveedor_id = data["proveedor_id"]

        db.session.commit()
        return registro

    @staticmethod
    def eliminar(registro_id):
        registro = IngresoEgreso.query.get(registro_id)
        if not registro:
            return False
        db.session.delete(registro)
        db.session.commit()
        return True