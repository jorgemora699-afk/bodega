from datetime import datetime, date
from sqlalchemy import func, exists, and_, or_, case
from app import db
from app.infrastructure.models import Venta, Producto, Horario, IngresoEgreso, Trabajadora, Orden
from app.domain.salario import (
    calcular_horas_trabajadas,
    calcular_salario as calcular_salario_domain,
    calcular_salario_mensual_prorrateado,
)
from calendar import monthrange
from app.domain.periodos import rango_por_periodo
from app.domain.periodos import rango_por_periodo as _rango_por_periodo
from zoneinfo import ZoneInfo
from app.domain.periodos import rango_por_periodo, rango_periodo_anterior
from app.domain.periodos import rango_por_mes


def _venta_excluye_credito_pendiente():
    """Condición para usar en .filter() sobre consultas que parten de Venta.
    Excluye las ventas cuya orden es a crédito y aún no ha sido pagada —
    esas no deben sumar en ningún reporte hasta que se marquen como pagadas.
    Una venta sin orden asociada (orden_id nulo) nunca se excluye."""
    return ~exists().where(
        and_(
            Orden.id == Venta.orden_id,
            Orden.metodo_pago == "credito",
            Orden.pagada == False,
        )
    )

def _resolver_rango(periodo, anio=None, mes=None):
    """Si se especifica anio y mes, usa ese mes calendario completo
    (reporte de un mes específico elegido por el admin). Si no, usa
    el periodo relativo de siempre (dia/semana/mes)."""
    if anio and mes:
        return rango_por_mes(anio, mes)
    return rango_por_periodo(periodo)


def _orden_excluye_credito_pendiente():
    """Misma exclusión, para consultas que parten directamente de Orden."""
    return or_(Orden.metodo_pago != "credito", Orden.pagada == True)


class AdminService:

    @staticmethod
    def resumen_ventas(periodo="dia", anio=None, mes=None, trabajadora_id=None):
        inicio, fin = _resolver_rango(periodo, anio, mes)

        def _totales(ini, fin_):
            venta_q = db.session.query(func.coalesce(func.sum(Venta.total), 0)).filter(
                Venta.fecha.between(ini, fin_),
                _venta_excluye_credito_pendiente(),
            )
            orden_q = db.session.query(func.count(Orden.id)).filter(
                Orden.fecha.between(ini, fin_),
                _orden_excluye_credito_pendiente(),
            )
            suelta_q = db.session.query(func.count(Venta.id)).filter(
                Venta.orden_id.is_(None),
                Venta.fecha.between(ini, fin_),
            )

            if trabajadora_id:
                venta_q = venta_q.filter(Venta.trabajadora_id == trabajadora_id)
                orden_q = orden_q.filter(Orden.trabajadora_id == trabajadora_id)
                suelta_q = suelta_q.filter(Venta.trabajadora_id == trabajadora_id)

            total = float(venta_q.scalar())
            cantidad_pedidos = orden_q.scalar() + suelta_q.scalar()
            return total, cantidad_pedidos

        total, cantidad_pedidos = _totales(inicio, fin)

        if anio and mes:
            anio_ant, mes_ant = AdminService._mes_anterior(anio, mes)
            inicio_ant, fin_ant = rango_por_mes(anio_ant, mes_ant)
        else:
            inicio_ant, fin_ant = rango_periodo_anterior(periodo)

        total_ant, pedidos_ant = _totales(inicio_ant, fin_ant)

        def _variacion(actual, anterior):
            if not anterior:
                return None
            return round(((actual - anterior) / anterior) * 100, 1)

        return {
            "periodo": periodo,
            "desde": inicio.isoformat(),
            "hasta": fin.isoformat(),
            "total_ventas": total,
            "cantidad_pedidos": cantidad_pedidos,
            "total_ventas_variacion_pct": _variacion(total, total_ant),
            "cantidad_pedidos_variacion_pct": _variacion(cantidad_pedidos, pedidos_ant),
        }

    @staticmethod
    def productos_mas_vendidos(periodo="dia", limite=10, anio=None, mes=None, trabajadora_id=None):
        inicio, fin = _resolver_rango(periodo, anio, mes)

        query = db.session.query(
            Producto.id,
            Producto.nombre,
            func.sum(Venta.cantidad).label("cantidad_vendida"),
            func.sum(Venta.total).label("total_generado"),
        ).join(Venta, Venta.producto_id == Producto.id).filter(
            Venta.fecha.between(inicio, fin),
            _venta_excluye_credito_pendiente(),
        )

        if trabajadora_id:
            query = query.filter(Venta.trabajadora_id == trabajadora_id)

        resultados = query.group_by(Producto.id, Producto.nombre).order_by(
            func.sum(Venta.cantidad).desc()
        ).limit(limite).all()

        return [
            {
                "producto_id": r.id,
                "producto_nombre": r.nombre,
                "cantidad_vendida": float(r.cantidad_vendida),
                "total_generado": float(r.total_generado),
            }
            for r in resultados
        ]

    @staticmethod
    def balance(periodo="mes", anio=None, mes=None):
        inicio, fin = _resolver_rango(periodo, anio, mes)

        ingresos_ventas = db.session.query(func.coalesce(func.sum(Venta.total), 0)).filter(
            Venta.fecha.between(inicio, fin),
            _venta_excluye_credito_pendiente(),
        ).scalar()

        ingresos_manuales = db.session.query(func.coalesce(func.sum(IngresoEgreso.monto), 0)).filter(
            IngresoEgreso.tipo == "ingreso",
            IngresoEgreso.fecha.between(inicio, fin)
        ).scalar()

        egresos = db.session.query(func.coalesce(func.sum(IngresoEgreso.monto), 0)).filter(
            IngresoEgreso.tipo == "egreso",
            IngresoEgreso.fecha.between(inicio, fin)
        ).scalar()

        total_ingresos = float(ingresos_ventas) + float(ingresos_manuales)
        total_egresos = float(egresos)

        return {
            "periodo": periodo,
            "desde": inicio.isoformat(),
            "hasta": fin.isoformat(),
            "ingresos_por_ventas": float(ingresos_ventas),
            "ingresos_manuales": float(ingresos_manuales),
            "total_ingresos": total_ingresos,
            "total_egresos": total_egresos,
            "balance_neto": total_ingresos - total_egresos,
        }

    @staticmethod
    def ventas_por_trabajadora(periodo="dia", anio=None, mes=None):
        inicio, fin = _resolver_rango(periodo, anio, mes)

        # Igual que en resumen_ventas: pedidos con Orden (distinct orden_id)
        # + ventas sueltas del sistema antiguo (orden_id nulo, cada una su propio pedido).
        ventas_sueltas_expr = func.count(case((Venta.orden_id.is_(None), Venta.id)))

        resultados = db.session.query(
            Trabajadora.id,
            Trabajadora.nombre,
            func.sum(Venta.total).label("total_vendido"),
            func.count(func.distinct(Venta.orden_id)).label("pedidos_con_orden"),
            ventas_sueltas_expr.label("ventas_sueltas"),
        ).join(Venta, Venta.trabajadora_id == Trabajadora.id).filter(
            Venta.fecha.between(inicio, fin),
            _venta_excluye_credito_pendiente(),
        ).group_by(Trabajadora.id, Trabajadora.nombre).order_by(
            func.sum(Venta.total).desc()
        ).all()

        return [
            {
                "trabajadora_id": r.id,
                "trabajadora_nombre": r.nombre,
                "total_vendido": float(r.total_vendido),
                "cantidad_pedidos": r.pedidos_con_orden + r.ventas_sueltas,
            }
            for r in resultados
        ]

    @staticmethod
    def ventas_por_dia(periodo="semana", anio=None, mes=None, trabajadora_id=None):
        inicio, fin = _resolver_rango(periodo, anio, mes)

        fecha_colombia = func.date(func.timezone("America/Bogota", func.timezone("UTC", Venta.fecha)))

        query = db.session.query(
            fecha_colombia.label("fecha"),
            func.sum(Venta.total).label("total"),
        ).filter(
            Venta.fecha.between(inicio, fin),
            _venta_excluye_credito_pendiente(),
        )

        if trabajadora_id:
            query = query.filter(Venta.trabajadora_id == trabajadora_id)

        resultados = query.group_by(fecha_colombia).order_by(fecha_colombia).all()

        return [
            {"fecha": r.fecha.isoformat(), "total": float(r.total)}
            for r in resultados
        ]

    @staticmethod
    def tendencia_mensual(meses=6):
        zona_colombia = ZoneInfo("America/Bogota")
        zona_utc = ZoneInfo("UTC")

        hoy = datetime.now(zona_colombia).date()
        resultado = []

        for i in range(meses - 1, -1, -1):
            mes = hoy.month - i
            anio = hoy.year
            while mes <= 0:
                mes += 12
                anio -= 1

            inicio = date(anio, mes, 1)
            ultimo_dia = monthrange(anio, mes)[1]
            fin = date(anio, mes, ultimo_dia)

            inicio_local = datetime.combine(inicio, datetime.min.time(), tzinfo=zona_colombia)
            fin_local = datetime.combine(fin, datetime.max.time(), tzinfo=zona_colombia)

            inicio_dt = inicio_local.astimezone(zona_utc).replace(tzinfo=None)
            fin_dt = fin_local.astimezone(zona_utc).replace(tzinfo=None)

            total_ventas = db.session.query(func.coalesce(func.sum(Venta.total), 0)).filter(
                Venta.fecha.between(inicio_dt, fin_dt),
                _venta_excluye_credito_pendiente(),
            ).scalar()

            resultado.append({
                "etiqueta": inicio.strftime("%b %Y"),
                "total_ventas": float(total_ventas),
            })

        return resultado

    @staticmethod
    def calcular_salarios(desde, hasta):
        trabajadoras = Trabajadora.query.filter_by(activa=True, incluye_nomina=True).order_by(Trabajadora.nombre).all()
        pagos_por_trabajadora = AdminService.pagos_solapados_por_trabajadora(desde, hasta)

        resultados = []
        for t in trabajadoras:
            resultado, _ = AdminService.calcular_salario(t.id, desde, hasta)

            total_pagado = pagos_por_trabajadora.get(t.id, 0)
            calculado = resultado["salario_calculado"] or 0
            pendiente = round(calculado - total_pagado, 2)

            if total_pagado <= 0:
                estado_pago = "sin_pagar"
            elif pendiente <= 0:
                estado_pago = "pagado_completo"
            else:
                estado_pago = "parcial"

            resultado["total_pagado"] = total_pagado
            resultado["pendiente"] = max(pendiente, 0)
            resultado["estado_pago"] = estado_pago

            resultados.append(resultado)
        return resultados

    @staticmethod
    def marcar_salario_pagado(trabajadora_id, desde, hasta, monto):
        from app.infrastructure.models import PagoSalario

        trabajadora = Trabajadora.query.get(trabajadora_id)
        if not trabajadora:
            return None, "Trabajadora no encontrada"

        if monto is None or monto <= 0:
            return None, "El monto debe ser mayor a 0"

        resultado, error = AdminService.calcular_salario(trabajadora_id, desde, hasta)
        if error:
            return None, error

        salario_calculado = resultado["salario_calculado"]
        if salario_calculado is None:
            return None, "Falta configurar el valor de pago de esta trabajadora"

        total_pagado_actual = AdminService.pagos_solapados_por_trabajadora(desde, hasta).get(trabajadora_id, 0)
        pendiente = round(salario_calculado - total_pagado_actual, 2)

        if monto > pendiente + 0.01:  # margen mínimo por redondeo
            return None, f"El monto (${monto:,.0f}) supera el pendiente (${pendiente:,.0f})"

        pago = PagoSalario(
            trabajadora_id=trabajadora_id,
            periodo_desde=desde,
            periodo_hasta=hasta,
            monto=monto,
        )
        db.session.add(pago)
        db.session.commit()
        return pago, None

    @staticmethod
    def listar_pagos_de_trabajadora(trabajadora_id, desde, hasta):
        """Pagos cuyo periodo se solapa con [desde, hasta] para una trabajadora."""
        from app.infrastructure.models import PagoSalario

        return PagoSalario.query.filter(
            PagoSalario.trabajadora_id == trabajadora_id,
            PagoSalario.periodo_desde <= hasta,
            PagoSalario.periodo_hasta >= desde,
        ).order_by(PagoSalario.fecha_pago.desc()).all()

    @staticmethod
    def eliminar_pago(pago_id):
        from app.infrastructure.models import PagoSalario

        pago = PagoSalario.query.get(pago_id)
        if not pago:
            return False, "Pago no encontrado"

        db.session.delete(pago)
        db.session.commit()
        return True, None

    @staticmethod
    def pagos_solapados_por_trabajadora(desde, hasta):
        """Para cada trabajadora, suma el monto de todos los pagos registrados
        cuyo rango se solapa con [desde, hasta] — sin importar si el pago fue
        por el periodo completo o por una parte de él (ej. dos quincenas)."""
        from app.infrastructure.models import PagoSalario

        resultados = db.session.query(
            PagoSalario.trabajadora_id,
            func.coalesce(func.sum(PagoSalario.monto), 0).label("total_pagado"),
        ).filter(
            PagoSalario.periodo_desde <= hasta,
            PagoSalario.periodo_hasta >= desde,
        ).group_by(PagoSalario.trabajadora_id).all()

        return {r.trabajadora_id: float(r.total_pagado) for r in resultados}

    @staticmethod
    def calcular_salario(trabajadora_id, desde, hasta):
        trabajadora = Trabajadora.query.get(trabajadora_id)
        if not trabajadora:
            return None, "Trabajadora no encontrada"

        turnos = Horario.query.filter(
            Horario.trabajadora_id == trabajadora_id,
            Horario.fecha.between(desde, hasta),
            Horario.hora_salida.isnot(None),
        ).all()

        total_horas = sum(
            calcular_horas_trabajadas(t.hora_entrada, t.hora_salida) for t in turnos
        )
        total_horas = round(total_horas, 2)

        dias_periodo = (hasta - desde).days + 1

        if trabajadora.tipo_pago == "mensual":
            salario_mensual = (
                float(trabajadora.salario_mensual) if trabajadora.salario_mensual is not None else None
            )
            salario_calculado = calcular_salario_mensual_prorrateado(salario_mensual, dias_periodo)
            valor_hora = None
            nota = None if salario_mensual is not None else "Falta configurar el salario mensual de esta trabajadora"
        else:
            valor_hora = float(trabajadora.valor_hora) if trabajadora.valor_hora is not None else None
            salario_calculado = calcular_salario_domain(total_horas, valor_hora)
            salario_mensual = None
            nota = None if valor_hora is not None else "Falta configurar el valor por hora de esta trabajadora"

        return {
            "trabajadora_id": trabajadora.id,
            "trabajadora_nombre": trabajadora.nombre,
            "tipo_pago": trabajadora.tipo_pago,
            "desde": desde.isoformat(),
            "hasta": hasta.isoformat(),
            "total_horas": total_horas,
            "valor_hora": valor_hora,
            "salario_mensual": salario_mensual,
            "salario_calculado": salario_calculado,
            "nota": nota,
        }, None

    @staticmethod
    def _mes_anterior(anio, mes):
        if mes == 1:
            return anio - 1, 12
        return anio, mes - 1

    @staticmethod
    def dashboard_resumen(periodo="dia", anio=None, mes=None):
        inicio, fin = _resolver_rango(periodo, anio, mes)

        if anio and mes:
            anio_ant, mes_ant = AdminService._mes_anterior(anio, mes)
            inicio_ant, fin_ant = rango_por_mes(anio_ant, mes_ant)
        else:
            inicio_ant, fin_ant = rango_periodo_anterior(periodo)

        def _totales(ini, fn):
            total_ventas = db.session.query(func.coalesce(func.sum(Venta.total), 0)).filter(
                Venta.fecha.between(ini, fn),
                _venta_excluye_credito_pendiente(),
            ).scalar()
            cantidad_pedidos = db.session.query(func.count(Orden.id)).filter(
                Orden.fecha.between(ini, fn),
                _orden_excluye_credito_pendiente(),
            ).scalar()
            return float(total_ventas), cantidad_pedidos

        def _variacion(actual, anterior):
            if not anterior:
                return None
            return round(((actual - anterior) / anterior) * 100, 1)

        ventas_actual, pedidos_actual = _totales(inicio, fin)
        ventas_anterior, pedidos_anterior = _totales(inicio_ant, fin_ant)

        balance = AdminService.balance(periodo, anio=anio, mes=mes)

        productos_activos = Producto.query.filter(Producto.activo == True).all()
        stock_bajo_cantidad = sum(
            1 for p in productos_activos if float(p.stock_actual) <= float(p.stock_minimo)
        )

        return {
            "periodo": periodo,
            "ventas_total": ventas_actual,
            "ventas_variacion_pct": _variacion(ventas_actual, ventas_anterior),
            "pedidos_total": pedidos_actual,
            "pedidos_variacion_pct": _variacion(pedidos_actual, pedidos_anterior),
            "balance_neto": balance["balance_neto"],
            "total_ingresos": balance["total_ingresos"],
            "total_egresos": balance["total_egresos"],
            "stock_bajo_cantidad": stock_bajo_cantidad,
        }

    @staticmethod
    def metodos_pago(periodo="dia", anio=None, mes=None, trabajadora_id=None):
        inicio, fin = _resolver_rango(periodo, anio, mes)

        ventas_sueltas_expr = func.count(case((Venta.orden_id.is_(None), Venta.id)))

        query = db.session.query(
            Venta.metodo_pago,
            func.sum(Venta.total).label("total"),
            func.count(func.distinct(Venta.orden_id)).label("pedidos_con_orden"),
            ventas_sueltas_expr.label("ventas_sueltas"),
        ).filter(
            Venta.fecha.between(inicio, fin),
            _venta_excluye_credito_pendiente(),
        )

        if trabajadora_id:
            query = query.filter(Venta.trabajadora_id == trabajadora_id)

        resultados = query.group_by(Venta.metodo_pago).all()

        total_general = sum(float(r.total) for r in resultados)

        salida = []
        for r in resultados:
            cantidad_pedidos = r.pedidos_con_orden + r.ventas_sueltas
            salida.append({
                "metodo_pago": r.metodo_pago,
                "total": float(r.total),
                "porcentaje": round((float(r.total) / total_general) * 100, 1) if total_general > 0 else 0,
                "cantidad_pedidos": cantidad_pedidos,
                "ticket_promedio": round(float(r.total) / cantidad_pedidos, 2) if cantidad_pedidos > 0 else 0,
            })

        return salida