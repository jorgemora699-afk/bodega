class TurnoYaAbiertoError(Exception):
    pass


class TurnoNoAbiertoError(Exception):
    pass


def validar_marcar_entrada(turno_abierto_existente):
    """Recibe el turno de hoy sin salida marcada (o None) y valida si se puede abrir uno nuevo."""
    if turno_abierto_existente is not None:
        raise TurnoYaAbiertoError("Ya hay una entrada registrada hoy sin salida marcada")


def validar_marcar_salida(turno_abierto):
    """Recibe el turno abierto de hoy (o None) y valida si se puede cerrar."""
    if turno_abierto is None:
        raise TurnoNoAbiertoError("No hay una entrada abierta hoy para marcar salida")