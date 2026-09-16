from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

ZONA_COLOMBIA = ZoneInfo("America/Bogota")
ZONA_UTC = ZoneInfo("UTC")


def rango_por_periodo(periodo):
    hoy = datetime.now(ZONA_COLOMBIA).date()

    if periodo == "dia":
        inicio = hoy
    elif periodo == "semana":
        inicio = hoy - timedelta(days=hoy.weekday())  # lunes de esta semana
    elif periodo == "mes":
        inicio = hoy.replace(day=1)
    else:
        raise ValueError("periodo debe ser 'dia', 'semana' o 'mes'")

    # límites del día en hora de Colombia...
    inicio_local = datetime.combine(inicio, datetime.min.time(), tzinfo=ZONA_COLOMBIA)
    fin_local = datetime.combine(hoy, datetime.max.time(), tzinfo=ZONA_COLOMBIA)

    # ...convertidos a UTC naive, para comparar contra columnas guardadas con datetime.utcnow()
    inicio_utc = inicio_local.astimezone(ZONA_UTC).replace(tzinfo=None)
    fin_utc = fin_local.astimezone(ZONA_UTC).replace(tzinfo=None)

    return inicio_utc, fin_utc