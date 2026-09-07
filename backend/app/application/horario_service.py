from datetime import datetime
from zoneinfo import ZoneInfo
from app import db
from app.infrastructure.models import Horario
from app.domain.horario import validar_marcar_entrada, validar_marcar_salida, TurnoYaAbiertoError, TurnoNoAbiertoError

ZONA_COLOMBIA = ZoneInfo("America/Bogota")


def _hoy_colombia():
    """Fecha de 'hoy' según la hora de Colombia, sin importar en qué
    zona horaria esté corriendo el servidor (local o Railway)."""
    return datetime.now(ZONA_COLOMBIA).date()


class HorarioService:

    @staticmethod
    def listar(trabajadora_id=None, fecha=None):
        query = Horario.query
        if trabajadora_id:
            query = query.filter_by(trabajadora_id=trabajadora_id)
        if fecha:
            query = query.filter_by(fecha=fecha)
        return query.order_by(Horario.fecha.desc()).all()

    @staticmethod
    def marcar_entrada(trabajadora_id):
        hoy = _hoy_colombia()

        existente = Horario.query.filter_by(
            trabajadora_id=trabajadora_id, fecha=hoy, hora_salida=None
        ).first()

        try:
            validar_marcar_entrada(existente)
        except TurnoYaAbiertoError as e:
            return None, str(e)

        horario = Horario(
            trabajadora_id=trabajadora_id,
            fecha=hoy,
            hora_entrada=datetime.utcnow(),
        )
        db.session.add(horario)
        db.session.commit()
        return horario, None

    @staticmethod
    def marcar_salida(trabajadora_id):
        """Cierra el turno abierto más reciente, sin importar si se abrió
        hoy o en un día anterior — cubre el caso de un turno que quedó
        abierto por olvido y se cierra al día siguiente."""
        horario = Horario.query.filter_by(
            trabajadora_id=trabajadora_id, hora_salida=None
        ).order_by(Horario.fecha.desc()).first()

        try:
            validar_marcar_salida(horario)
        except TurnoNoAbiertoError as e:
            return None, str(e)

        horario.hora_salida = datetime.utcnow()
        db.session.commit()
        return horario, None