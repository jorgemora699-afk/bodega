from app import db
from app.infrastructure.models import Producto, ProductoInsumo


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
    def _reemplazar_insumos(producto, insumos_data):
        """
        Reemplaza por completo la lista de insumos que este producto consume
        al venderse. insumos_data es una lista de {insumo_id, cantidad}.
        Se borra todo lo anterior y se crea de nuevo, más simple y seguro
        que tratar de calcular diffs.
        """
        ProductoInsumo.query.filter_by(producto_id=producto.id).delete()

        for item in insumos_data or []:
            insumo_id = item.get("insumo_id")
            cantidad = item.get("cantidad")
            if not insumo_id or not cantidad:
                continue
            db.session.add(ProductoInsumo(
                producto_id=producto.id,
                insumo_id=insumo_id,
                cantidad=cantidad,
            ))

    @staticmethod
    def crear(data):
        producto = Producto(
            nombre=data["nombre"],
            categoria=data.get("categoria"),
            precio_unitario=data["precio_unitario"],
            stock_actual=data.get("stock_actual", 0),
            stock_minimo=data.get("stock_minimo", 5),
        )
        db.session.add(producto)
        db.session.flush()  # para tener producto.id antes de crear sus insumos

        if "insumos" in data:
            ProductoService._reemplazar_insumos(producto, data["insumos"])

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
        if "stock_minimo" in data:
            producto.stock_minimo = data["stock_minimo"]
        if "insumos" in data:
            ProductoService._reemplazar_insumos(producto, data["insumos"])
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