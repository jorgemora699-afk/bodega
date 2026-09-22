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
            tipo_pago=data.get("tipo_pago", "hora"),
            valor_hora=data.get("valor_hora"),
            salario_mensual=data.get("salario_mensual"),
            incluye_nomina=data.get("incluye_nomina", True),
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
        if "tipo_pago" in data:
            trabajadora.tipo_pago = data["tipo_pago"]
        if "valor_hora" in data:
            trabajadora.valor_hora = data["valor_hora"]
        if "salario_mensual" in data:
            trabajadora.salario_mensual = data["salario_mensual"]
        if "activa" in data:
            trabajadora.activa = data["activa"]
        if "incluye_nomina" in data:
            trabajadora.incluye_nomina = data["incluye_nomina"]

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

    @staticmethod
    def establecer_codigo(trabajadora_id, codigo):
        trabajadora = Trabajadora.query.get(trabajadora_id)
        if not trabajadora:
            return None, "Trabajadora no encontrada"

        if not codigo or len(str(codigo).strip()) < 4:
            return None, "El código debe tener al menos 4 dígitos"

        trabajadora.set_codigo(str(codigo).strip())
        db.session.commit()
        return trabajadora, None

    @staticmethod
    def quitar_codigo(trabajadora_id):
        trabajadora = Trabajadora.query.get(trabajadora_id)
        if not trabajadora:
            return False
        trabajadora.codigo_hash = None
        db.session.commit()
        return True

    @staticmethod
    def verificar_codigo(trabajadora_id, codigo):
        trabajadora = Trabajadora.query.get(trabajadora_id)
        if not trabajadora:
            return False, "Trabajadora no encontrada"

        if not trabajadora.activa:
            return False, "Esta trabajadora no está activa"

        if not trabajadora.codigo_hash:
            return False, "Esta trabajadora no tiene un código configurado"

        if not trabajadora.check_codigo(codigo):
            return False, "Código incorrecto"

        return True, None