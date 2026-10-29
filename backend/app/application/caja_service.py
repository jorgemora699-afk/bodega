import json
import math
from datetime import datetime, timedelta, timezone

from sqlalchemy import func

from app import db
from app.infrastructure.models import TurnoCaja, MovimientoCaja, Orden, Trabajadora

# Colombia está en UTC-5 todo el año (no hay horario de verano)
ZONA_LOCAL = timezone(timedelta(hours=-5))

ERROR_SIN_TURNO = "No hay un turno de caja abierto. Abre la caja antes de continuar"


def _hoy_local():
    return datetime.now(ZONA_LOCAL).date()


def _parsear_monto(valor, nombre, permitir_cero):
    try:
        monto = round(float(valor), 2)
    except (TypeError, ValueError):
        return None, f"{nombre} no es un número válido"

    if not math.isfinite(monto):
        return None, f"{nombre} no es un número válido"
    if monto < 0:
        return None, f"{nombre} no puede ser negativo"
    if monto == 0 and not permitir_cero:
        return None, f"{nombre} debe ser mayor a cero"
    return monto, None


class CajaService:

    # ---------- consultas ----------

    @staticmethod
    def turno_abierto():
        return TurnoCaja.query.filter_by(estado="abierto").first()

    @staticmethod
    def sugerencia_apertura():
        """Lo que se contó en el último cierre: normalmente es con lo que
        arranca el turno siguiente."""
        ultimo = (
            TurnoCaja.query.filter_by(estado="cerrado")
            .order_by(TurnoCaja.cerrado_en.desc())
            .first()
        )
        return float(ultimo.efectivo_contado) if ultimo and ultimo.efectivo_contado is not None else None

    @staticmethod
    def calcular_resumen(turno):
        """Desglose del turno calculado con los datos actuales.
        Efectivo esperado = apertura + ventas en efectivo + cobros en efectivo
        de cuentas por cobrar + ingresos - egresos."""

        def suma(columna, *filtros):
            return float(
                db.session.query(func.coalesce(func.sum(columna), 0)).filter(*filtros).scalar()
            )

        ventas_efectivo = suma(Orden.total, Orden.turno_id == turno.id, Orden.metodo_pago == "efectivo")
        ventas_transferencia = suma(Orden.total, Orden.turno_id == turno.id, Orden.metodo_pago == "transferencia")
        ventas_credito = suma(Orden.total, Orden.turno_id == turno.id, Orden.metodo_pago == "credito")
        cobros_efectivo = suma(Orden.total, Orden.turno_cobro_id == turno.id, Orden.metodo_cobro == "efectivo")
        cobros_transferencia = suma(Orden.total, Orden.turno_cobro_id == turno.id, Orden.metodo_cobro == "transferencia")
        ingresos = suma(MovimientoCaja.monto, MovimientoCaja.turno_id == turno.id, MovimientoCaja.tipo == "ingreso")
        egresos = suma(MovimientoCaja.monto, MovimientoCaja.turno_id == turno.id, MovimientoCaja.tipo == "egreso")
        num_ordenes = Orden.query.filter_by(turno_id=turno.id).count()

        apertura = float(turno.monto_apertura)
        esperado = apertura + ventas_efectivo + cobros_efectivo + ingresos - egresos

        return {
            "monto_apertura": round(apertura, 2),
            "ventas_efectivo": round(ventas_efectivo, 2),
            "ventas_transferencia": round(ventas_transferencia, 2),
            "ventas_credito": round(ventas_credito, 2),
            "cobros_efectivo": round(cobros_efectivo, 2),
            "cobros_transferencia": round(cobros_transferencia, 2),
            "ingresos": round(ingresos, 2),
            "egresos": round(egresos, 2),
            "num_ordenes": num_ordenes,
            "efectivo_esperado": round(esperado, 2),
        }

    @staticmethod
    def serializar(turno, detalle=False):
        data = turno.to_dict()

        if turno.estado == "abierto":
            data["resumen"] = CajaService.calcular_resumen(turno)
        else:
            data["resumen"] = json.loads(turno.resumen_cierre) if turno.resumen_cierre else None

        if detalle:
            data["movimientos"] = [m.to_dict() for m in turno.movimientos]
            ordenes = Orden.query.filter_by(turno_id=turno.id).order_by(Orden.fecha.asc()).all()
            data["ordenes"] = [
                {
                    "id": o.id,
                    "total": float(o.total),
                    "metodo_pago": o.metodo_pago,
                    "pagada": o.pagada,
                    "fecha": o.fecha.isoformat() + "Z",
                }
                for o in ordenes
            ]

        return data

    @staticmethod
    def listar_turnos(desde=None, hasta=None, trabajadora_id=None):
        query = TurnoCaja.query
        if desde:
            query = query.filter(TurnoCaja.fecha >= desde)
        if hasta:
            query = query.filter(TurnoCaja.fecha <= hasta)
        if trabajadora_id:
            query = query.filter(TurnoCaja.trabajadora_id == trabajadora_id)
        return query.order_by(TurnoCaja.abierto_en.desc()).all()

    @staticmethod
    def obtener_por_id(turno_id):
        return TurnoCaja.query.get(turno_id)

    # ---------- abrir / cerrar ----------

    @staticmethod
    def abrir(trabajadora_id, monto_apertura):
        if CajaService.turno_abierto():
            return None, "Ya hay un turno de caja abierto; ciérralo antes de abrir otro"

        trabajadora = Trabajadora.query.get(trabajadora_id) if trabajadora_id else None
        if not trabajadora or not trabajadora.activa:
            return None, "Trabajadora no encontrada o inactiva"

        monto, error = _parsear_monto(monto_apertura, "El monto de apertura", permitir_cero=True)
        if error:
            return None, error

        hoy = _hoy_local()
        numero = TurnoCaja.query.filter_by(fecha=hoy).count() + 1

        turno = TurnoCaja(
            fecha=hoy,
            numero_dia=numero,
            trabajadora_id=trabajadora.id,
            monto_apertura=monto,
            estado="abierto",
        )
        db.session.add(turno)
        db.session.commit()
        return turno, None

    @staticmethod
    def cerrar(efectivo_contado, trabajadora_id, es_jefe, notas=None):
        """Cierra el turno abierto. trabajadora_id es quien hace el cierre;
        si no llega, se asume la misma que abrió. El jefe figura como
        'Administrador'."""
        turno = CajaService.turno_abierto()
        if not turno:
            return None, ERROR_SIN_TURNO

        if es_jefe:
            cerrado_por = "Administrador"
        else:
            quien = None
            if trabajadora_id:
                quien = Trabajadora.query.get(trabajadora_id)
                if not quien or not quien.activa:
                    return None, "Trabajadora no encontrada o inactiva"
            cerrado_por = (quien or turno.trabajadora).nombre

        contado, error = _parsear_monto(efectivo_contado, "El efectivo contado", permitir_cero=True)
        if error:
            return None, error

        resumen = CajaService.calcular_resumen(turno)
        esperado = resumen["efectivo_esperado"]

        turno.estado = "cerrado"
        turno.cerrado_en = datetime.utcnow()
        turno.cerrado_por = cerrado_por
        turno.efectivo_contado = contado
        turno.efectivo_esperado = esperado
        turno.diferencia = round(contado - esperado, 2)
        turno.resumen_cierre = json.dumps(resumen)
        turno.notas = (notas or "").strip() or None

        db.session.commit()
        return turno, None

    # ---------- movimientos de caja ----------

    @staticmethod
    def registrar_movimiento(tipo, monto, motivo):
        turno = CajaService.turno_abierto()
        if not turno:
            return None, ERROR_SIN_TURNO

        if tipo not in ("ingreso", "egreso"):
            return None, "tipo debe ser 'ingreso' o 'egreso'"

        monto, error = _parsear_monto(monto, "El monto", permitir_cero=False)
        if error:
            return None, error

        motivo = (motivo or "").strip()
        if not motivo:
            return None, "El motivo es obligatorio"
        if len(motivo) > 200:
            return None, "El motivo no puede superar 200 caracteres"

        movimiento = MovimientoCaja(turno_id=turno.id, tipo=tipo, monto=monto, motivo=motivo)
        db.session.add(movimiento)
        db.session.commit()
        return movimiento, None

    @staticmethod
    def eliminar_movimiento(movimiento_id):
        movimiento = MovimientoCaja.query.get(movimiento_id)
        if not movimiento:
            return False, "Movimiento no encontrado"
        if movimiento.turno.estado != "abierto":
            return False, "No se puede eliminar un movimiento de un turno cerrado"

        db.session.delete(movimiento)
        db.session.commit()
        return True, None