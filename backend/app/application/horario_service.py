from datetime import datetime, time
from zoneinfo import ZoneInfo
from app import db
from app.infrastructure.models import Horario
from app.domain.horario import (
    validar_marcar_entrada,
    validar_marcar_salida,
    validar_rango_horario,
    TurnoYaAbiertoError,
    TurnoNoAbiertoError,
    RangoHorarioInvalidoError,
)

ZONA_COLOMBIA = ZoneInfo("America/Bogota")
ZONA_UTC = ZoneInfo("UTC")


def _hoy_colombia():
    """Fecha de 'hoy' según la hora de Colombia, sin importar en qué
    zona horaria esté corriendo el servidor (local o Railway)."""
    return datetime.now(ZONA_COLOMBIA).date()


def _hora_local_a_utc(fecha, hora_str):
    """Convierte 'HH:MM' (hora de Colombia, en la fecha del turno) a un
    datetime naive en UTC, listo para guardar igual que datetime.utcnow()."""
    try:
        hh, mm = map(int, hora_str.split(":"))
    except (ValueError, AttributeError):
        raise ValueError("Formato de hora inválido, usa HH:MM")

    local_dt = datetime.combine(fecha, time(hour=hh, minute=mm), tzinfo=ZONA_COLOMBIA)
    return local_dt.astimezone(ZONA_UTC).replace(tzinfo=None)


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
        hoy o en un día anterior — cubre el caso de un turno olvidado."""
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

    @staticmethod
    def actualizar(horario_id, data):
        """Permite al jefe corregir la hora de entrada y/o salida de un
        turno puntual — pensado para arreglar olvidos o errores de marcaje.
        La fecha del turno no cambia, solo las horas dentro de ese día."""
        horario = Horario.query.get(horario_id)
        if not horario:
            return None, "Turno no encontrado"

        nueva_entrada = horario.hora_entrada
        nueva_salida = horario.hora_salida

        try:
            if data.get("hora_entrada"):
                nueva_entrada = _hora_local_a_utc(horario.fecha, data["hora_entrada"])
            if data.get("hora_salida"):
                nueva_salida = _hora_local_a_utc(horario.fecha, data["hora_salida"])

            validar_rango_horario(nueva_entrada, nueva_salida)
        except (ValueError, RangoHorarioInvalidoError) as e:
            return None, str(e)

        horario.hora_entrada = nueva_entrada
        horario.hora_salida = nueva_salida
        db.session.commit()
        return horario, None