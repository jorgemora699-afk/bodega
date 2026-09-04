from app import db
from app.infrastructure.models import Receta, RecetaIngrediente, Producto


class RecetaService:

    @staticmethod
    def obtener_por_producto(producto_id):
        return Receta.query.filter_by(producto_id=producto_id).first()

    @staticmethod
    def guardar(producto_id, ingredientes_data):
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