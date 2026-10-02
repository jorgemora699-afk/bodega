from datetime import datetime
from app import db
from app.infrastructure.models import (
    IngresoEgreso,
    Producto,
    Insumo,
    MovimientoInventario,
    MovimientoInsumo,
)


class IngresoEgresoService:

    @staticmethod
    def listar(tipo=None, desde=None, hasta=None):
        query = IngresoEgreso.query
        if tipo:
            query = query.filter_by(tipo=tipo)
        if desde:
            query = query.filter(IngresoEgreso.fecha >= desde)
        if hasta:
            query = query.filter(IngresoEgreso.fecha <= hasta)
        return query.order_by(IngresoEgreso.fecha.desc()).all()

    @staticmethod
    def obtener_por_id(registro_id):
        return IngresoEgreso.query.get(registro_id)

    @staticmethod
    def crear(data):
        """Crea el ingreso/egreso y, opcionalmente, su entrada de inventario
        vinculada — todo en una sola transacción. Si la entrada de
        inventario falla (ej. producto no encontrado), no se guarda nada,
        ni siquiera el egreso."""
        registro = IngresoEgreso(
            tipo=data["tipo"],
            monto=data["monto"],
            descripcion=data["descripcion"],
            metodo_pago=data.get("metodo_pago"),
            proveedor_id=data.get("proveedor_id"),
        )
        db.session.add(registro)
        db.session.flush()  # para tener registro.id disponible

        entrada = data.get("registrar_entrada")

        if entrada:
            tipo_item = entrada.get("tipo")
            item_id = entrada.get("item_id")
            cantidad = entrada.get("cantidad")

            if tipo_item not in ("producto", "insumo") or not item_id or not cantidad:
                db.session.rollback()
                return None, "Datos incompletos para registrar la entrada de inventario"

            cantidad = float(cantidad)
            if cantidad <= 0:
                db.session.rollback()
                return None, "La cantidad de la entrada debe ser mayor a cero"

            if tipo_item == "producto":
                producto = Producto.query.get(item_id)
                if not producto:
                    db.session.rollback()
                    return None, "Producto no encontrado para la entrada de inventario"

                producto.stock_actual = float(producto.stock_actual) + cantidad

                movimiento = MovimientoInventario(
                    producto_id=producto.id,
                    tipo="entrada",
                    motivo="compra",
                    cantidad=cantidad,
                )
                db.session.add(movimiento)
                db.session.flush()
                registro.movimiento_inventario_id = movimiento.id

            else:  # insumo
                insumo = Insumo.query.get(item_id)
                if not insumo:
                    db.session.rollback()
                    return None, "Insumo no encontrado para la entrada de inventario"

                insumo.stock_actual = float(insumo.stock_actual) + cantidad

                movimiento = MovimientoInsumo(
                    insumo_id=insumo.id,
                    tipo="entrada",
                    motivo="compra",
                    cantidad=cantidad,
                )
                db.session.add(movimiento)
                db.session.flush()
                registro.movimiento_insumo_id = movimiento.id

        db.session.commit()
        return registro, None

    @staticmethod
    def actualizar(registro_id, data):
        registro = IngresoEgreso.query.get(registro_id)
        if not registro:
            return None

        if "tipo" in data:
            registro.tipo = data["tipo"]
        if "monto" in data:
            registro.monto = data["monto"]
        if "descripcion" in data:
            registro.descripcion = data["descripcion"]
        if "metodo_pago" in data:
            registro.metodo_pago = data["metodo_pago"]
        if "proveedor_id" in data:
            registro.proveedor_id = data["proveedor_id"]
        # La entrada de inventario vinculada (si existe) nunca se toca al
        # editar — solo se crea al crear el registro, y se revierte al
        # eliminarlo.

        db.session.commit()
        return registro

    @staticmethod
    def eliminar(registro_id):
        registro = IngresoEgreso.query.get(registro_id)
        if not registro:
            return False

        # Si este egreso generó una entrada de inventario, se revierte
        # el stock y se borra ese movimiento antes de borrar el registro,
        # para que el inventario quede consistente con el dinero.
        if registro.movimiento_inventario_id and registro.movimiento_inventario:
            mov = registro.movimiento_inventario
            if mov.producto:
                mov.producto.stock_actual = float(mov.producto.stock_actual) - float(mov.cantidad)
            db.session.delete(mov)

        if registro.movimiento_insumo_id and registro.movimiento_insumo:
            mov = registro.movimiento_insumo
            if mov.insumo:
                mov.insumo.stock_actual = float(mov.insumo.stock_actual) - float(mov.cantidad)
            db.session.delete(mov)

        db.session.delete(registro)
        db.session.commit()
        return True