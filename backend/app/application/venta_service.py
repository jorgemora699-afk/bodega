from datetime import datetime
from app import db
from app.infrastructure.models import Venta, Producto, MovimientoInventario, MovimientoInsumo
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
    def _validar_stock(producto, cantidad):
        """
        Devuelve (ok, mensaje_error). Si el producto usa un insumo (ej. jugo -> pulpa),
        valida contra el insumo; si no, valida contra el stock propio del producto.
        """
        if producto.insumo_id and producto.insumo:
            insumo = producto.insumo
            if not hay_stock_suficiente(float(insumo.stock_actual), cantidad):
                return False, f"Stock insuficiente de {insumo.nombre}: quedan {float(insumo.stock_actual)} {insumo.unidad_medida}"
            return True, None

        if not hay_stock_suficiente(float(producto.stock_actual), cantidad):
            return False, f"Stock insuficiente: quedan {float(producto.stock_actual)} de {producto.nombre}"
        return True, None

    @staticmethod
    def _aplicar_venta(producto, cantidad, trabajadora_id, venta_id):
        """
        Descuenta el stock correspondiente. Si el producto tiene insumo asociado,
        descuenta el insumo (ej. pulpa) y NO toca producto.stock_actual, porque ese
        numero se deriva del insumo en Producto.to_dict(). Si no tiene insumo,
        descuenta producto.stock_actual como siempre.
        """
        if producto.insumo_id and producto.insumo:
            insumo = producto.insumo
            insumo.stock_actual = float(insumo.stock_actual) - float(cantidad)

            db.session.add(MovimientoInsumo(
                insumo_id=insumo.id,
                trabajadora_id=trabajadora_id,
                venta_id=venta_id,
                tipo="salida",
                motivo="venta",
                cantidad=cantidad,
            ))
            return

        producto.stock_actual = float(producto.stock_actual) - float(cantidad)

        db.session.add(MovimientoInventario(
            producto_id=producto.id,
            trabajadora_id=trabajadora_id,
            venta_id=venta_id,
            tipo="salida",
            motivo="venta",
            cantidad=cantidad,
        ))

    @staticmethod
    def _revertir_venta(venta):
        """
        Revierte el efecto de una venta ya aplicada, sin importar si en su momento
        descontó un insumo o el stock propio del producto - revisa que movimientos
        quedaron ligados a esta venta y los deshace.
        """
        movimientos_insumo = MovimientoInsumo.query.filter_by(venta_id=venta.id, motivo="venta").all()
        for m in movimientos_insumo:
            m.insumo.stock_actual = float(m.insumo.stock_actual) + float(m.cantidad)
            db.session.delete(m)

        if venta.movimiento:
            producto = Producto.query.get(venta.producto_id)
            if producto:
                producto.stock_actual = float(producto.stock_actual) + float(venta.cantidad)
            db.session.delete(venta.movimiento)

    @staticmethod
    def crear(data):
        producto = Producto.query.get(data["producto_id"])
        if not producto:
            return None, "Producto no encontrado"

        cantidad = float(data["cantidad"])

        ok, error = VentaService._validar_stock(producto, cantidad)
        if not ok:
            return None, error

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

        VentaService._aplicar_venta(producto, cantidad, data["trabajadora_id"], venta.id)

        db.session.commit()
        return venta, None

    @staticmethod
    def actualizar(venta_id, data):
        venta = Venta.query.get(venta_id)
        if not venta:
            return None, "Venta no encontrada"

        nuevo_producto_id = data.get("producto_id", venta.producto_id)
        nueva_cantidad = float(data.get("cantidad", float(venta.cantidad)))

        producto_nuevo = Producto.query.get(nuevo_producto_id)
        if not producto_nuevo:
            return None, "Producto no encontrado"

        # revertimos el efecto de la venta original primero (insumo o producto,
        # segun lo que haya quedado registrado), asi el stock queda "limpio"
        # antes de validar y aplicar el nuevo producto/cantidad
        VentaService._revertir_venta(venta)

        ok, error = VentaService._validar_stock(producto_nuevo, nueva_cantidad)
        if not ok:
            db.session.rollback()
            return None, error

        venta.producto_id = nuevo_producto_id
        venta.trabajadora_id = data.get("trabajadora_id", venta.trabajadora_id)
        venta.cantidad = nueva_cantidad
        venta.precio_unitario = producto_nuevo.precio_unitario
        venta.total = float(producto_nuevo.precio_unitario) * nueva_cantidad
        venta.metodo_pago = data.get("metodo_pago", venta.metodo_pago)
        venta.editado = True

        VentaService._aplicar_venta(producto_nuevo, nueva_cantidad, venta.trabajadora_id, venta.id)

        db.session.commit()
        return venta, None

    @staticmethod
    def eliminar(venta_id):
        venta = Venta.query.get(venta_id)
        if not venta:
            return False, "Venta no encontrada"

        VentaService._revertir_venta(venta)

        db.session.delete(venta)
        db.session.commit()
        return True, None