from datetime import datetime
from app import db
from app.infrastructure.models import Nota, Trabajadora


class NotaService:

    @staticmethod
    def listar_todas():
        # pendientes primero (resuelta=False ordena antes), más recientes arriba dentro de cada grupo
        return Nota.query.order_by(Nota.resuelta.asc(), Nota.creada_en.desc()).all()

    @staticmethod
    def crear(data):
        trabajadora_id = data.get("trabajadora_creadora_id")
        texto = data.get("texto")

        if not trabajadora_id or not texto or not texto.strip():
            return None, "trabajadora_creadora_id y texto son obligatorios"

        trabajadora = Trabajadora.query.get(trabajadora_id)
        if not trabajadora:
            return None, "Trabajadora no encontrada"

        nota = Nota(texto=texto.strip(), trabajadora_creadora_id=trabajadora_id)
        db.session.add(nota)
        db.session.commit()
        return nota, None

    @staticmethod
    def marcar_resuelta(nota_id, trabajadora_id):
        nota = Nota.query.get(nota_id)
        if not nota:
            return None, "Nota no encontrada"

        if nota.resuelta:
            return None, "Esta nota ya está marcada como realizada"

        trabajadora = Trabajadora.query.get(trabajadora_id)
        if not trabajadora:
            return None, "Trabajadora no encontrada"

        nota.resuelta = True
        nota.trabajadora_resuelve_id = trabajadora_id
        nota.resuelta_en = datetime.utcnow()
        db.session.commit()
        return nota, None

    @staticmethod
    def eliminar(nota_id):
        nota = Nota.query.get(nota_id)
        if not nota:
            return False
        db.session.delete(nota)
        db.session.commit()
        return True