from app import db
from app.infrastructure.models import PrecioEspecial, Cliente, Producto


class PrecioEspecialService:

    @staticmethod
    def listar_por_cliente(cliente_id):
        return PrecioEspecial.query.filter_by(cliente_id=cliente_id).order_by(PrecioEspecial.id).all()

    @staticmethod
    def obtener_precio(cliente_id, producto_id):
        """Devuelve el precio especial (float) si existe, o None si no aplica."""
        if not cliente_id:
            return None
        pe = PrecioEspecial.query.filter_by(cliente_id=cliente_id, producto_id=producto_id).first()
        return float(pe.precio) if pe else None

    @staticmethod
    def crear_o_actualizar(cliente_id, producto_id, precio):
        if not Cliente.query.get(cliente_id):
            return None, "Cliente no encontrado"
        if not Producto.query.get(producto_id):
            return None, "Producto no encontrado"
        if precio is None or float(precio) <= 0:
            return None, "El precio debe ser mayor a 0"

        pe = PrecioEspecial.query.filter_by(cliente_id=cliente_id, producto_id=producto_id).first()
        if pe:
            pe.precio = precio
        else:
            pe = PrecioEspecial(cliente_id=cliente_id, producto_id=producto_id, precio=precio)
            db.session.add(pe)

        db.session.commit()
        return pe, None

    @staticmethod
    def eliminar(precio_especial_id):
        pe = PrecioEspecial.query.get(precio_especial_id)
        if not pe:
            return False
        db.session.delete(pe)
        db.session.commit()
        return True