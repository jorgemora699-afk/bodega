def calcular_horas_trabajadas(hora_entrada, hora_salida):
    """Recibe dos datetime y devuelve las horas trabajadas, redondeadas a 2 decimales."""
    if hora_entrada is None or hora_salida is None:
        return None
    delta = hora_salida - hora_entrada
    return round(delta.total_seconds() / 3600, 2)


def calcular_salario(total_horas, valor_hora):
    """Devuelve None si no hay valor_hora configurado, para que la capa superior
    decida cómo comunicar que falta ese dato."""
    if valor_hora is None:
        return None
    return round(total_horas * float(valor_hora), 2)


def calcular_salario_mensual_prorrateado(salario_mensual, dias_periodo, dias_mes=30):
    """Calcula la parte proporcional de un sueldo fijo mensual según cuántos
    días abarca el período seleccionado, usando 30 días como mes estándar
    (ej: 2.000.000 / 30 x 7 días de 'esta semana')."""
    if salario_mensual is None:
        return None
    return round((float(salario_mensual) / dias_mes) * dias_periodo, 2)