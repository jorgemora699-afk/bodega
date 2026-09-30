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
    def _validar_config_seleccion(data):
        """
        Valida y normaliza los campos de "paquete mixto" (ej. Paquete de
        empanadas mixta: la trabajadora elige N sabores distintos de una
        categoría, y el paquete lleva K unidades de cada sabor elegido).
        Devuelve (valores, error):

        - valores: dict con requiere_seleccion, categoria_seleccion,
          cantidad_seleccion y cantidad_por_seleccion listos para asignar
          al producto (o None si data no trae "requiere_seleccion", para
          no tocar lo existente).
        - Si requiere_seleccion es False/no viene, los demás campos se
          limpian (cantidad_por_seleccion vuelve a 1), para no dejar
          configuración huérfana de un cambio anterior.
        """
        if "requiere_seleccion" not in data:
            return None, None

        requiere = bool(data.get("requiere_seleccion"))

        if not requiere:
            return {
                "requiere_seleccion": False,
                "categoria_seleccion": None,
                "cantidad_seleccion": None,
                "cantidad_por_seleccion": 1,
            }, None

        categoria = (data.get("categoria_seleccion") or "").strip()
        if not categoria:
            return None, "categoria_seleccion es obligatoria cuando requiere_seleccion es true"

        try:
            cantidad = int(data.get("cantidad_seleccion"))
        except (TypeError, ValueError):
            return None, "cantidad_seleccion debe ser un número entero"

        if cantidad < 2:
            return None, "cantidad_seleccion debe ser al menos 2"

        try:
            cantidad_por_seleccion = int(data.get("cantidad_por_seleccion", 1))
        except (TypeError, ValueError):
            return None, "cantidad_por_seleccion debe ser un número entero"

        if cantidad_por_seleccion < 1:
            return None, "cantidad_por_seleccion debe ser al menos 1"

        return {
            "requiere_seleccion": True,
            "categoria_seleccion": categoria,
            "cantidad_seleccion": cantidad,
            "cantidad_por_seleccion": cantidad_por_seleccion,
        }, None

    @staticmethod
    def crear(data):
        config_seleccion, error = ProductoService._validar_config_seleccion(data)
        if error:
            raise ValueError(error)

        producto = Producto(
            nombre=data["nombre"],
            categoria=data.get("categoria"),
            precio_unitario=data["precio_unitario"],
            stock_actual=data.get("stock_actual", 0),
            stock_minimo=data.get("stock_minimo", 5),
        )

        if config_seleccion:
            producto.requiere_seleccion = config_seleccion["requiere_seleccion"]
            producto.categoria_seleccion = config_seleccion["categoria_seleccion"]
            producto.cantidad_seleccion = config_seleccion["cantidad_seleccion"]
            producto.cantidad_por_seleccion = config_seleccion["cantidad_por_seleccion"]

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

        config_seleccion, error = ProductoService._validar_config_seleccion(data)
        if error:
            raise ValueError(error)

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
        if config_seleccion:
            producto.requiere_seleccion = config_seleccion["requiere_seleccion"]
            producto.categoria_seleccion = config_seleccion["categoria_seleccion"]
            producto.cantidad_seleccion = config_seleccion["cantidad_seleccion"]
            producto.cantidad_por_seleccion = config_seleccion["cantidad_por_seleccion"]
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