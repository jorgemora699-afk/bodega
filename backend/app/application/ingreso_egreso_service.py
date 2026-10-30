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

from datetime import datetime, time
from zoneinfo import ZoneInfo
from sqlalchemy import func, or_
from app.infrastructure.models import IngresoEgreso, Venta, Orden
from app.domain.periodos import rango_mes

ZONA_COLOMBIA = ZoneInfo("America/Bogota")
ZONA_UTC = ZoneInfo("UTC")


class IngresoEgresoService:

    @staticmethod
    def _parsear_fecha(fecha_str):
        """Convierte 'AAAA-MM-DD' en un datetime, combinando ese día con
        la hora actual (para que el orden dentro del listado tenga sentido
        sin tener que pedirle al jefe que también elija la hora).
        Devuelve (datetime, error)."""
        if not fecha_str:
            return None, None

        try:
            dia_elegido = datetime.strptime(fecha_str, "%Y-%m-%d").date()
        except ValueError:
            return None, "fecha debe tener el formato AAAA-MM-DD"

        ahora = datetime.utcnow()
        return datetime.combine(dia_elegido, ahora.time()), None

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
        fecha, error = IngresoEgresoService._parsear_fecha(data.get("fecha"))
        if error:
            return None, error

        kwargs = dict(
            tipo=data["tipo"],
            monto=data["monto"],
            descripcion=data["descripcion"],
            metodo_pago=data.get("metodo_pago"),
            proveedor_id=data.get("proveedor_id"),
        )
        if fecha is not None:
            kwargs["fecha"] = fecha  # si no se pasa, se usa el default (ahora)

        registro = IngresoEgreso(**kwargs)
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

        if "fecha" in data:
            fecha, error = IngresoEgresoService._parsear_fecha(data["fecha"])
            if error:
                return None, error
            if fecha is not None:
                registro.fecha = fecha

        for detalle_id in data.get("eliminar_detalle_ids") or []:
            detalle = IngresoEgresoDetalleInventario.query.get(detalle_id)
            if not detalle or detalle.ingreso_egreso_id != registro.id:
                continue

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

    @staticmethod
    def resumen_mes(anio, mes):
        inicio, fin = rango_mes(anio, mes)

        manuales = IngresoEgreso.query.filter(
            IngresoEgreso.fecha.between(inicio, fin)
        ).all()

        # Día calendario en hora Colombia, no en UTC
        dia_colombia = func.date(func.timezone("America/Bogota", func.timezone("UTC", Venta.fecha)))

        filas = (
            db.session.query(dia_colombia.label("dia"), func.sum(Venta.total).label("total"))
            .outerjoin(Orden, Venta.orden_id == Orden.id)
            .filter(Venta.fecha.between(inicio, fin))
            # ventas sueltas (sin orden) o pedidos ya pagados; las cuentas por cobrar pendientes no cuentan
            .filter(or_(Orden.id.is_(None), Orden.pagada.is_(True)))
            .group_by(dia_colombia)
            .all()
        )

        registros = []
        for r in manuales:
            d = r.to_dict()
            d["origen"] = "manual"
            registros.append(d)

        total_ventas = 0.0
        for f in filas:
            total = float(f.total)
            total_ventas += total

            # Se envía al mediodía de Colombia para que el navegador muestre
            # el día correcto sin importar su zona horaria.
            mediodia = datetime.combine(f.dia, time(12, 0), tzinfo=ZONA_COLOMBIA)
            fecha_iso = mediodia.astimezone(ZONA_UTC).replace(tzinfo=None).isoformat() + "Z"

            registros.append({
                "id": f"ventas-{f.dia.isoformat()}",
                "origen": "ventas",
                "tipo": "ingreso",
                "monto": total,
                "descripcion": f"Ventas del {f.dia.strftime('%d/%m')}",
                "metodo_pago": None,
                "proveedor_id": None,
                "proveedor_nombre": None,
                "fecha": fecha_iso,
            })

        registros.sort(key=lambda x: x["fecha"], reverse=True)

        ingresos_manuales = sum(float(r.monto) for r in manuales if r.tipo == "ingreso")
        total_egresos = sum(float(r.monto) for r in manuales if r.tipo == "egreso")
        total_ingresos = ingresos_manuales + total_ventas

        return {
            "mes": f"{anio}-{mes:02d}",
            "registros": registros,
            "total_ventas": total_ventas,
            "ingresos_manuales": ingresos_manuales,
            "total_ingresos": total_ingresos,
            "total_egresos": total_egresos,
            "balance_neto": total_ingresos - total_egresos,
        }