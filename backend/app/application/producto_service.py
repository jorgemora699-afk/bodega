from app import db
from app.infrastructure.models import Producto


class ProductoService:

    @staticmethod
    def listar_todos(solo_activos=True):
        query = Producto.query
        if solo_activos:
            query = query.filter_by(activo=True)
        return query.order_by(Producto.nombre).all()

    @staticmethod
    def obtener_por_id(producto_id):
        return Producto.query.get(producto_id)

    @staticmethod
    def crear(data):
        producto = Producto(
            nombre=data["nombre"],
            categoria=data.get("categoria"),
            precio_unitario=data["precio_unitario"],
            stock_actual=data.get("stock_actual", 0),
        )
        db.session.add(producto)
        db.session.commit()
        return producto

    @staticmethod
    def actualizar(producto_id, data):
        producto = Producto.query.get(producto_id)
        if not producto:
            return None

        if "nombre" in data:
            producto.nombre = data["nombre"]
        if "categoria" in data:
            producto.categoria = data["categoria"]
        if "precio_unitario" in data:
            producto.precio_unitario = data["precio_unitario"]
        if "stock_actual" in data:
            producto.stock_actual = data["stock_actual"]
        if "activo" in data:
            producto.activo = data["activo"]

        db.session.commit()
        return producto

    @staticmethod
    def eliminar(producto_id):
        producto = Producto.query.get(producto_id)
        if not producto:
            return False
        producto.activo = False  # borrado lógico, no físico
        db.session.commit()
        return True