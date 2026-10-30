from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from calendar import monthrange

ZONA_COLOMBIA = ZoneInfo("America/Bogota")
ZONA_UTC = ZoneInfo("UTC")


def _utc_desde_fecha_local(fecha_inicio, fecha_fin):
    inicio_local = datetime.combine(fecha_inicio, datetime.min.time(), tzinfo=ZONA_COLOMBIA)
    fin_local = datetime.combine(fecha_fin, datetime.max.time(), tzinfo=ZONA_COLOMBIA)
    inicio_utc = inicio_local.astimezone(ZONA_UTC).replace(tzinfo=None)
    fin_utc = fin_local.astimezone(ZONA_UTC).replace(tzinfo=None)
    return inicio_utc, fin_utc


def _fechas_por_periodo(periodo):
    hoy = datetime.now(ZONA_COLOMBIA).date()

    if periodo == "dia":
        inicio = hoy
    elif periodo == "semana":
        inicio = hoy - timedelta(days=hoy.weekday())  # lunes de esta semana
    elif periodo == "mes":
        inicio = hoy.replace(day=1)
    else:
        raise ValueError("periodo debe ser 'dia', 'semana' o 'mes'")

    return inicio, hoy


def rango_por_periodo(periodo):
    inicio, fin = _fechas_por_periodo(periodo)
    return _utc_desde_fecha_local(inicio, fin)


def rango_periodo_anterior(periodo):
    """Rango de fechas del mismo tamaño (en días) que el periodo actual,
    inmediatamente anterior a él — para calcular variaciones porcentuales.
    Ej: si 'semana' va de lunes a hoy (miércoles = 3 días), el periodo
    anterior son los 3 días inmediatamente antes del lunes."""
    inicio, fin = _fechas_por_periodo(periodo)
    dias = (fin - inicio).days + 1

    fin_anterior = inicio - timedelta(days=1)
    inicio_anterior = fin_anterior - timedelta(days=dias - 1)

    return _utc_desde_fecha_local(inicio_anterior, fin_anterior)

from calendar import monthrange

def rango_por_mes(anio, mes):
    """Rango de fechas (en UTC) para un mes calendario completo, dado su
    año y número de mes (1-12). Usado para que el admin pueda ver el
    reporte de cualquier mes específico, no solo el actual."""
    inicio = date(anio, mes, 1)
    ultimo_dia = monthrange(anio, mes)[1]
    fin = date(anio, mes, ultimo_dia)
    return _utc_desde_fecha_local(inicio, fin)

def rango_mes(anio, mes):
    """Límites de un mes completo en hora Colombia, convertidos a UTC naive
    para compararlos contra columnas guardadas con datetime.utcnow()."""
    ultimo_dia = monthrange(anio, mes)[1]
    return _utc_desde_fecha_local(date(anio, mes, 1), date(anio, mes, ultimo_dia))