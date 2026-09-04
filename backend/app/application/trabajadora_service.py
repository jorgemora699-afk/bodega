from app import db
from app.infrastructure.models import Trabajadora


class TrabajadoraService:

    @staticmethod
    def listar_todas(solo_activas=True):
        query = Trabajadora.query
        if solo_activas:
            query = query.filter_by(activa=True)
        return query.order_by(Trabajadora.nombre).all()

    @staticmethod
    def obtener_por_id(trabajadora_id):
        return Trabajadora.query.get(trabajadora_id)

    @staticmethod
    def crear(data):
        trabajadora = Trabajadora(
            nombre=data["nombre"],
            valor_hora=data.get("valor_hora"),
        )
        db.session.add(trabajadora)
        db.session.commit()
        return trabajadora

    @staticmethod
    def actualizar(trabajadora_id, data):
        trabajadora = Trabajadora.query.get(trabajadora_id)
        if not trabajadora:
            return None

        if "nombre" in data:
            trabajadora.nombre = data["nombre"]
        if "valor_hora" in data:
            trabajadora.valor_hora = data["valor_hora"]
        if "activa" in data:
            trabajadora.activa = data["activa"]

        db.session.commit()
        return trabajadora

    @staticmethod
    def eliminar(trabajadora_id):
        trabajadora = Trabajadora.query.get(trabajadora_id)
        if not trabajadora:
            return False
        trabajadora.activa = False  # borrado lógico — conserva ventas/horarios históricos
        db.session.commit()
        return True