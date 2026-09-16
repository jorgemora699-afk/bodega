from datetime import datetime, date
from sqlalchemy import func
from app import db
from app.infrastructure.models import Venta, Producto, Horario, IngresoEgreso, Trabajadora
from app.domain.salario import (
    calcular_horas_trabajadas,
    calcular_salario as calcular_salario_domain,
    calcular_salario_mensual_prorrateado,
)
from calendar import monthrange
from app.domain.periodos import rango_por_periodo
from app.domain.periodos import rango_por_periodo as _rango_por_periodo
from zoneinfo import ZoneInfo


class AdminService:

    @staticmethod
    def resumen_ventas(periodo="dia"):
        inicio, fin = _rango_por_periodo(periodo)

        total = db.session.query(func.coalesce(func.sum(Venta.total), 0)).filter(
            Venta.fecha.between(inicio, fin)
        ).scalar()

        cantidad_ventas = db.session.query(func.count(Venta.id)).filter(
            Venta.fecha.between(inicio, fin)
        ).scalar()

        return {
            "periodo": periodo,
            "desde": inicio.isoformat(),
            "hasta": fin.isoformat(),
            "total_ventas": float(total),
            "cantidad_ventas": cantidad_ventas,
        }

    @staticmethod
    def productos_mas_vendidos(periodo="dia", limite=10):
        inicio, fin = _rango_por_periodo(periodo)

        resultados = db.session.query(
            Producto.id,
            Producto.nombre,
            func.sum(Venta.cantidad).label("cantidad_vendida"),
            func.sum(Venta.total).label("total_generado"),
        ).join(Venta, Venta.producto_id == Producto.id).filter(
            Venta.fecha.between(inicio, fin)
        ).group_by(Producto.id, Producto.nombre).order_by(
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
    def balance(periodo="mes"):
        inicio, fin = _rango_por_periodo(periodo)

        ingresos_ventas = db.session.query(func.coalesce(func.sum(Venta.total), 0)).filter(
            Venta.fecha.between(inicio, fin)
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
    def ventas_por_trabajadora(periodo="dia"):
        inicio, fin = rango_por_periodo(periodo)

        resultados = db.session.query(
            Trabajadora.id,
            Trabajadora.nombre,
            func.sum(Venta.total).label("total_vendido"),
            func.count(Venta.id).label("cantidad_ventas"),
        ).join(Venta, Venta.trabajadora_id == Trabajadora.id).filter(
            Venta.fecha.between(inicio, fin)
        ).group_by(Trabajadora.id, Trabajadora.nombre).order_by(
            func.sum(Venta.total).desc()
        ).all()

        return [
            {
                "trabajadora_id": r.id,
                "trabajadora_nombre": r.nombre,
                "total_vendido": float(r.total_vendido),
                "cantidad_ventas": r.cantidad_ventas,
            }
            for r in resultados
        ]

    @staticmethod
    def ventas_por_dia(periodo="semana"):
        inicio, fin = rango_por_periodo(periodo)

        fecha_colombia = func.date(func.timezone("America/Bogota", func.timezone("UTC", Venta.fecha)))

        resultados = db.session.query(
            fecha_colombia.label("fecha"),
            func.sum(Venta.total).label("total"),
        ).filter(
            Venta.fecha.between(inicio, fin)
        ).group_by(fecha_colombia).order_by(fecha_colombia).all()

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
                Venta.fecha.between(inicio_dt, fin_dt)
            ).scalar()

            resultado.append({
                "etiqueta": inicio.strftime("%b %Y"),
                "total_ventas": float(total_ventas),
            })

        return resultado

    @staticmethod
    def calcular_salarios(desde, hasta):
        trabajadoras = Trabajadora.query.filter_by(activa=True, incluye_nomina=True).order_by(Trabajadora.nombre).all()
        resultados = []
        for t in trabajadoras:
            resultado, _ = AdminService.calcular_salario(t.id, desde, hasta)
            resultados.append(resultado)
        return resultados

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