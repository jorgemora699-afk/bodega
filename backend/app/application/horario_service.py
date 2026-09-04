from datetime import datetime, date
from app import db
from app.infrastructure.models import Horario
from app.domain.horario import validar_marcar_entrada, validar_marcar_salida, TurnoYaAbiertoError, TurnoNoAbiertoError


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
        hoy = date.today()

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
        hoy = date.today()

        horario = Horario.query.filter_by(
            trabajadora_id=trabajadora_id, fecha=hoy, hora_salida=None
        ).first()

        try:
            validar_marcar_salida(horario)
        except TurnoNoAbiertoError as e:
            return None, str(e)

        horario.hora_salida = datetime.utcnow()
        db.session.commit()
        return horario, None