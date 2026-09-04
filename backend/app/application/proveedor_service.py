from app import db
from app.infrastructure.models import Proveedor, Producto


class ProveedorService:

    @staticmethod
    def listar_todos():
        return Proveedor.query.order_by(Proveedor.nombre).all()

    @staticmethod
    def obtener_por_id(proveedor_id):
        return Proveedor.query.get(proveedor_id)

    @staticmethod
    def listar_por_producto(producto_id):
        producto = Producto.query.get(producto_id)
        if not producto:
            return []
        return producto.proveedores

    @staticmethod
    def crear(data):
        proveedor = Proveedor(
            nombre=data["nombre"],
            celular=data["celular"],
            notas=data.get("notas"),
        )

        producto_ids = data.get("producto_ids", [])
        if producto_ids:
            productos = Producto.query.filter(Producto.id.in_(producto_ids)).all()
            proveedor.productos = productos

        db.session.add(proveedor)
        db.session.commit()
        return proveedor

    @staticmethod
    def actualizar(proveedor_id, data):
        proveedor = Proveedor.query.get(proveedor_id)
        if not proveedor:
            return None

        if "nombre" in data:
            proveedor.nombre = data["nombre"]
        if "celular" in data:
            proveedor.celular = data["celular"]
        if "notas" in data:
            proveedor.notas = data["notas"]
        if "producto_ids" in data:
            productos = Producto.query.filter(Producto.id.in_(data["producto_ids"])).all()
            proveedor.productos = productos

        db.session.commit()
        return proveedor

    @staticmethod
    def eliminar(proveedor_id):
        proveedor = Proveedor.query.get(proveedor_id)
        if not proveedor:
            return False
        db.session.delete(proveedor)
        db.session.commit()
        return True