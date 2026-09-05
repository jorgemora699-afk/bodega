from datetime import datetime
from app import db
from app.infrastructure.models import Venta, Producto, MovimientoInventario
from app.domain.inventario import hay_stock_suficiente
from app.domain.periodos import rango_por_periodo
from sqlalchemy.orm import joinedload


class VentaService:

    @staticmethod
    def listar_todas(periodo="todas"):
        query = Venta.query.options(joinedload(Venta.producto), joinedload(Venta.trabajadora))
        if periodo and periodo != "todas":
            inicio, fin = rango_por_periodo(periodo)
            query = query.filter(Venta.fecha.between(inicio, fin))
        return query.order_by(Venta.fecha.desc()).all()

    @staticmethod
    def obtener_por_id(venta_id):
        return Venta.query.get(venta_id)

    @staticmethod
    def crear(data):
        producto = Producto.query.get(data["producto_id"])
        if not producto:
            return None, "Producto no encontrado"

        cantidad = float(data["cantidad"])

        if not hay_stock_suficiente(float(producto.stock_actual), cantidad):
            return None, f"Stock insuficiente: quedan {float(producto.stock_actual)} de {producto.nombre}"

        total = float(producto.precio_unitario) * cantidad

        venta = Venta(
            producto_id=producto.id,
            trabajadora_id=data["trabajadora_id"],
            cantidad=cantidad,
            precio_unitario=producto.precio_unitario,
            total=total,
            metodo_pago=data["metodo_pago"],
        )
        db.session.add(venta)
        db.session.flush()

        producto.stock_actual = float(producto.stock_actual) - cantidad

        movimiento = MovimientoInventario(
            producto_id=producto.id,
            trabajadora_id=data["trabajadora_id"],
            venta_id=venta.id,
            tipo="salida",
            motivo="venta",
            cantidad=cantidad,
        )
        db.session.add(movimiento)
        db.session.commit()
        return venta, None

    @staticmethod
    def actualizar(venta_id, data):
        venta = Venta.query.get(venta_id)
        if not venta:
            return None, "Venta no encontrada"

        producto_anterior = Producto.query.get(venta.producto_id)
        cantidad_anterior = float(venta.cantidad)

        nuevo_producto_id = data.get("producto_id", venta.producto_id)
        nueva_cantidad = float(data.get("cantidad", cantidad_anterior))

        producto_nuevo = Producto.query.get(nuevo_producto_id)
        if not producto_nuevo:
            return None, "Producto no encontrado"

        # stock "disponible" como si ya se hubiera revertido la venta original,
        # calculado antes de tocar la BD, para validar antes de aplicar nada
        if nuevo_producto_id == venta.producto_id:
            stock_disponible = float(producto_anterior.stock_actual) + cantidad_anterior
        else:
            stock_disponible = float(producto_nuevo.stock_actual)

        if not hay_stock_suficiente(stock_disponible, nueva_cantidad):
            return None, f"Stock insuficiente: quedan {stock_disponible} de {producto_nuevo.nombre}"

        # revertir el efecto anterior y aplicar el nuevo — si es el mismo producto,
        # producto_anterior y producto_nuevo son el mismo objeto, así que las dos
        # líneas se acumulan correctamente sobre la misma fila
        producto_anterior.stock_actual = float(producto_anterior.stock_actual) + cantidad_anterior
        producto_nuevo.stock_actual = float(producto_nuevo.stock_actual) - nueva_cantidad

        venta.producto_id = nuevo_producto_id
        venta.trabajadora_id = data.get("trabajadora_id", venta.trabajadora_id)
        venta.cantidad = nueva_cantidad
        venta.precio_unitario = producto_nuevo.precio_unitario
        venta.total = float(producto_nuevo.precio_unitario) * nueva_cantidad
        venta.metodo_pago = data.get("metodo_pago", venta.metodo_pago)
        venta.editado = True

        if venta.movimiento:
            venta.movimiento.producto_id = nuevo_producto_id
            venta.movimiento.trabajadora_id = venta.trabajadora_id
            venta.movimiento.cantidad = nueva_cantidad
            venta.movimiento.fecha = datetime.utcnow()

        db.session.commit()
        return venta, None

    @staticmethod
    def eliminar(venta_id):
        venta = Venta.query.get(venta_id)
        if not venta:
            return False, "Venta no encontrada"

        producto = Producto.query.get(venta.producto_id)
        producto.stock_actual = float(producto.stock_actual) + float(venta.cantidad)

        if venta.movimiento:
            db.session.delete(venta.movimiento)

        db.session.delete(venta)
        db.session.commit()
        return True, None