class TurnoYaAbiertoError(Exception):
    pass


class TurnoNoAbiertoError(Exception):
    pass


class RangoHorarioInvalidoError(Exception):
    pass


def validar_marcar_entrada(turno_abierto_existente):
    if turno_abierto_existente is not None:
        raise TurnoYaAbiertoError("Ya hay una entrada registrada hoy sin salida marcada")


def validar_marcar_salida(turno_abierto):
    if turno_abierto is None:
        raise TurnoNoAbiertoError("No hay una entrada abierta hoy para marcar salida")


def validar_rango_horario(hora_entrada, hora_salida):
    if hora_entrada and hora_salida and hora_salida <= hora_entrada:
        raise RangoHorarioInvalidoError("La hora de salida debe ser posterior a la hora de entrada")