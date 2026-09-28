from datetime import datetime, time, timedelta
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
    """Fecha de 'hoy' según la hora de Colombia."""
    return datetime.now(ZONA_COLOMBIA).date()


def _hora_local_a_utc(fecha, hora_str):
    """Convierte HH:MM de Colombia a datetime naive UTC."""
    try:
        hh, mm = map(int, hora_str.split(":"))
    except (ValueError, AttributeError):
        raise ValueError("Formato de hora inválido, usa HH:MM")

    local_dt = datetime.combine(
        fecha,
        time(hour=hh, minute=mm),
        tzinfo=ZONA_COLOMBIA
    )

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
            trabajadora_id=trabajadora_id,
            fecha=hoy,
            hora_salida=None
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
        """Cierra el turno abierto más reciente."""
        horario = Horario.query.filter_by(
            trabajadora_id=trabajadora_id,
            hora_salida=None
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
        """
        Permite corregir la hora de entrada y/o salida.

        Si la salida es menor que la entrada, se interpreta
        como un turno que terminó después de medianoche.
        """

        horario = Horario.query.get(horario_id)

        if not horario:
            return None, "Turno no encontrado"

        nueva_entrada = horario.hora_entrada
        nueva_salida = horario.hora_salida

        try:

            # -------------------------
            # HORA DE ENTRADA
            # -------------------------
            if data.get("hora_entrada"):
                nueva_entrada = _hora_local_a_utc(
                    horario.fecha,
                    data["hora_entrada"]
                )

            # -------------------------
            # HORA DE SALIDA
            # -------------------------
            if data.get("hora_salida"):

                fecha_salida = horario.fecha

                # Determinamos la hora de entrada
                if data.get("hora_entrada"):
                    hora_entrada = datetime.strptime(
                        data["hora_entrada"],
                        "%H:%M"
                    ).time()

                else:
                    # Si no se está modificando la entrada,
                    # usamos la entrada que ya estaba guardada.
                    entrada_colombia = (
                        nueva_entrada
                        .replace(tzinfo=ZONA_UTC)
                        .astimezone(ZONA_COLOMBIA)
                    )

                    hora_entrada = entrada_colombia.time()

                hora_salida = datetime.strptime(
                    data["hora_salida"],
                    "%H:%M"
                ).time()

                # -------------------------
                # TURNO NOCTURNO
                # -------------------------
                if hora_salida < hora_entrada:
                    fecha_salida = horario.fecha + timedelta(days=1)

                nueva_salida = _hora_local_a_utc(
                    fecha_salida,
                    data["hora_salida"]
                )

            # Validamos después de convertir
            # las horas a UTC.
            validar_rango_horario(
                nueva_entrada,
                nueva_salida
            )

        except (ValueError, RangoHorarioInvalidoError) as e:
            return None, str(e)

        horario.hora_entrada = nueva_entrada
        horario.hora_salida = nueva_salida

        db.session.commit()

        return horario, None