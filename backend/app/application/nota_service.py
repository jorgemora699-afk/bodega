from datetime import datetime
from app import db
from app.infrastructure.models import Nota, Trabajadora


class NotaService:

    @staticmethod
    def listar_todas():
        return Nota.query.order_by(Nota.resuelta.asc(), Nota.creada_en.desc()).all()

    @staticmethod
    def crear(data, usuario_id, rol):
        texto = data.get("texto")
        if not texto or not texto.strip():
            return None, "El texto de la nota es obligatorio"

        if rol == "jefe":
            nota = Nota(texto=texto.strip(), creada_por_usuario_id=usuario_id)
        else:
            trabajadora_id = data.get("trabajadora_creadora_id")
            if not trabajadora_id:
                return None, "trabajadora_creadora_id es obligatorio"
            if not Trabajadora.query.get(trabajadora_id):
                return None, "Trabajadora no encontrada"
            nota = Nota(texto=texto.strip(), trabajadora_creadora_id=trabajadora_id)

        db.session.add(nota)
        db.session.commit()
        return nota, None

    @staticmethod
    def marcar_resuelta(nota_id, usuario_id, rol, trabajadora_id=None):
        nota = Nota.query.get(nota_id)
        if not nota:
            return None, "Nota no encontrada"

        if nota.resuelta:
            return None, "Esta nota ya está marcada como realizada"

        if rol == "jefe":
            nota.resuelta_por_usuario_id = usuario_id
        else:
            if not trabajadora_id:
                return None, "trabajadora_id es obligatorio"
            if not Trabajadora.query.get(trabajadora_id):
                return None, "Trabajadora no encontrada"
            nota.trabajadora_resuelve_id = trabajadora_id

        nota.resuelta = True
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