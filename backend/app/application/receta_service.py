from app import db
from app.infrastructure.models import Receta, RecetaIngrediente, RecetaPaso, Producto



class RecetaService:

    @staticmethod
    def _reemplazar_pasos(receta, pasos_data):
        if pasos_data is None:
            return
        for paso in list(receta.pasos):
            db.session.delete(paso)
        textos = [p.strip() for p in pasos_data if p and p.strip()]
        for orden, texto in enumerate(textos, start=1):
            db.session.add(RecetaPaso(receta_id=receta.id, orden=orden, descripcion=texto))

    @staticmethod
    def obtener_por_producto(producto_id):
        return Receta.query.filter_by(producto_id=producto_id).first()

    @staticmethod
    def guardar(producto_id, ingredientes_data, pasos_data=None):
        """Crea la receta si no existe, o reemplaza toda la lista de ingredientes si ya existe."""
        producto = Producto.query.get(producto_id)
        if not producto:
            return None, "Producto no encontrado"

        receta = Receta.query.filter_by(producto_id=producto_id).first()
        if not receta:
            receta = Receta(producto_id=producto_id)
            db.session.add(receta)
            db.session.flush()
        else:
            # borra los ingredientes anteriores para reemplazarlos por la lista nueva
            for ingrediente in receta.ingredientes:
                db.session.delete(ingrediente)

        for item in ingredientes_data:
            ingrediente = RecetaIngrediente(
                receta_id=receta.id,
                nombre_ingrediente=item["nombre_ingrediente"],
                cantidad=item["cantidad"],
                unidad=item["unidad"],
            )
            db.session.add(ingrediente)

        RecetaService._reemplazar_pasos(receta, pasos_data)
        db.session.commit()
        return receta, None

    @staticmethod
    def eliminar(producto_id):
        receta = Receta.query.filter_by(producto_id=producto_id).first()
        if not receta:
            return False
        db.session.delete(receta)  # cascade borra también los ingredientes
        db.session.commit()
        return True
        

    @staticmethod
    def listar_todas():
        return Receta.query.order_by(Receta.id.desc()).all()

    @staticmethod
    def obtener_por_id(receta_id):
        return Receta.query.get(receta_id)

    @staticmethod
    def crear_standalone(nombre, ingredientes_data, pasos_data=None):
        if not nombre or not nombre.strip():
            return None, "El nombre es obligatorio para una receta sin producto"

        receta = Receta(producto_id=None, nombre=nombre.strip())
        db.session.add(receta)
        db.session.flush()

        for item in ingredientes_data:
            db.session.add(RecetaIngrediente(
                receta_id=receta.id,
                nombre_ingrediente=item["nombre_ingrediente"],
                cantidad=item["cantidad"],
                unidad=item["unidad"],
            ))

        RecetaService._reemplazar_pasos(receta, pasos_data)
        db.session.commit()
        return receta, None


    @staticmethod
    def actualizar_por_id(receta_id, nombre, ingredientes_data, pasos_data=None):
        receta = Receta.query.get(receta_id)
        if not receta:
            return None, "Receta no encontrada"

        if receta.producto_id is None:
            if not nombre or not nombre.strip():
                return None, "El nombre es obligatorio para una receta sin producto"
            receta.nombre = nombre.strip()

        for ingrediente in receta.ingredientes:
            db.session.delete(ingrediente)

        for item in ingredientes_data:
            db.session.add(RecetaIngrediente(
                receta_id=receta.id,
                nombre_ingrediente=item["nombre_ingrediente"],
                cantidad=item["cantidad"],
                unidad=item["unidad"],
            ))

        RecetaService._reemplazar_pasos(receta, pasos_data)
        db.session.commit()
        return receta, None

    @staticmethod
    def eliminar_por_id(receta_id):
        receta = Receta.query.get(receta_id)
        if not receta:
            return False
        db.session.delete(receta)
        db.session.commit()
        return True