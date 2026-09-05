from datetime import date, datetime, timedelta


def rango_por_periodo(periodo):
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