from datetime import datetime, date, timedelta
from sqlalchemy import func
from app import db
from app.infrastructure.models import Venta, Producto, Horario, IngresoEgreso, Trabajadora
from app.domain.salario import calcular_horas_trabajadas, calcular_salario as calcular_salario_domain



def _rango_por_periodo(periodo):
    hoy = date.today()
    if periodo == "dia":
        inicio = hoy
    elif periodo == "semana":
        inicio = hoy - timedelta(days=hoy.weekday())  # lunes de esta semana
    elif periodo == "mes":
        inicio = hoy.replace(day=1)
    else:
        raise ValueError("periodo debe ser 'dia', 'semana' o 'mes'")

    inicio_dt = datetime.combine(inicio, datetime.min.time())
    fin_dt = datetime.combine(hoy, datetime.max.time())
    return inicio_dt, fin_dt


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

        valor_hora = float(trabajadora.valor_hora) if trabajadora.valor_hora is not None else None
        salario_calculado = calcular_salario_domain(total_horas, valor_hora)

        return {
            "trabajadora_id": trabajadora.id,
            "trabajadora_nombre": trabajadora.nombre,
            "desde": desde.isoformat(),
            "hasta": hasta.isoformat(),
            "total_horas": total_horas,
            "valor_hora": valor_hora,
            "salario_calculado": salario_calculado,
            "nota": None if valor_hora is not None else "Falta configurar el valor por hora de esta trabajadora",
        }, None