from datetime import datetime
from app import db
from app.infrastructure.models import (
    IngresoEgreso,
    IngresoEgresoDetalleInventario,
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
    def _crear_entrada(registro, tipo_item, item_id, cantidad):
        """Crea UNA entrada de inventario (producto o insumo) vinculada al
        registro, dentro de la misma transacción. Devuelve un mensaje de
        error si algo falla, o None si todo salió bien."""
        try:
            cantidad = float(cantidad)
        except (TypeError, ValueError):
            return "La cantidad de una de las entradas no es válida"

        if cantidad <= 0:
            return "La cantidad de una de las entradas debe ser mayor a cero"

        if tipo_item == "producto":
            producto = Producto.query.get(item_id)
            if not producto:
                return "Producto no encontrado en una de las entradas"

            producto.stock_actual = float(producto.stock_actual) + cantidad

            movimiento = MovimientoInventario(
                producto_id=producto.id, tipo="entrada", motivo="compra", cantidad=cantidad,
            )
            db.session.add(movimiento)
            db.session.flush()

            detalle = IngresoEgresoDetalleInventario(
                ingreso_egreso_id=registro.id, movimiento_inventario_id=movimiento.id,
            )

        elif tipo_item == "insumo":
            insumo = Insumo.query.get(item_id)
            if not insumo:
                return "Insumo no encontrado en una de las entradas"

            insumo.stock_actual = float(insumo.stock_actual) + cantidad

            movimiento = MovimientoInsumo(
                insumo_id=insumo.id, tipo="entrada", motivo="compra", cantidad=cantidad,
            )
            db.session.add(movimiento)
            db.session.flush()

            detalle = IngresoEgresoDetalleInventario(
                ingreso_egreso_id=registro.id, movimiento_insumo_id=movimiento.id,
            )

        else:
            return "El tipo de una de las entradas debe ser 'producto' o 'insumo'"

        db.session.add(detalle)
        return None

    @staticmethod
    def crear(data):
        """Crea el ingreso/egreso y, opcionalmente, varias entradas de
        inventario vinculadas (una factura puede traer varios productos
        o insumos). Todo en una sola transacción: si cualquier entrada
        falla, no se guarda nada, ni siquiera el egreso."""
        registro = IngresoEgreso(
            tipo=data["tipo"],
            monto=data["monto"],
            descripcion=data["descripcion"],
            metodo_pago=data.get("metodo_pago"),
            proveedor_id=data.get("proveedor_id"),
        )
        db.session.add(registro)
        db.session.flush()

        for entrada in data.get("registrar_entradas") or []:
            error = IngresoEgresoService._crear_entrada(
                registro, entrada.get("tipo"), entrada.get("item_id"), entrada.get("cantidad"),
            )
            if error:
                db.session.rollback()
                return None, error

        db.session.commit()
        return registro, None

    @staticmethod
    def actualizar(registro_id, data):
        """Actualiza los campos simples del registro y, opcionalmente:
        - elimina entradas de inventario existentes (revierte su stock)
        - agrega entradas de inventario nuevas
        Todo en una sola transacción."""
        registro = IngresoEgreso.query.get(registro_id)
        if not registro:
            return None, "Registro no encontrado"

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

        for detalle_id in data.get("eliminar_detalle_ids") or []:
            detalle = IngresoEgresoDetalleInventario.query.get(detalle_id)
            if not detalle or detalle.ingreso_egreso_id != registro.id:
                continue  # ignora ids que no existan o no sean de este registro

            if detalle.movimiento_inventario_id and detalle.movimiento_inventario:
                mov = detalle.movimiento_inventario
                if mov.producto:
                    mov.producto.stock_actual = float(mov.producto.stock_actual) - float(mov.cantidad)
                db.session.delete(mov)

            if detalle.movimiento_insumo_id and detalle.movimiento_insumo:
                mov = detalle.movimiento_insumo
                if mov.insumo:
                    mov.insumo.stock_actual = float(mov.insumo.stock_actual) - float(mov.cantidad)
                db.session.delete(mov)

            db.session.delete(detalle)

        for entrada in data.get("nuevas_entradas") or []:
            error = IngresoEgresoService._crear_entrada(
                registro, entrada.get("tipo"), entrada.get("item_id"), entrada.get("cantidad"),
            )
            if error:
                db.session.rollback()
                return None, error

        db.session.commit()
        return registro, None

    @staticmethod
    def eliminar(registro_id):
        registro = IngresoEgreso.query.get(registro_id)
        if not registro:
            return False

        for detalle in list(registro.detalles_inventario):
            if detalle.movimiento_inventario_id and detalle.movimiento_inventario:
                mov = detalle.movimiento_inventario
                if mov.producto:
                    mov.producto.stock_actual = float(mov.producto.stock_actual) - float(mov.cantidad)
                db.session.delete(mov)

            if detalle.movimiento_insumo_id and detalle.movimiento_insumo:
                mov = detalle.movimiento_insumo
                if mov.insumo:
                    mov.insumo.stock_actual = float(mov.insumo.stock_actual) - float(mov.cantidad)
                db.session.delete(mov)

            db.session.delete(detalle)

        db.session.delete(registro)
        db.session.commit()
        return True