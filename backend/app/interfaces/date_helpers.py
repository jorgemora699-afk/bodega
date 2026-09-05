from datetime import datetime


def parsear_fecha(fecha_str, campo="fecha"):
    """Convierte un string 'YYYY-MM-DD' a date. Lanza ValueError con un
    mensaje claro si el formato es inválido, para que la ruta lo atrape
    y devuelva un 400 en vez de un 500."""
    try:
        return datetime.strptime(fecha_str, "%Y-%m-%d").date()
    except ValueError:
        raise ValueError(f"El campo '{campo}' debe tener formato YYYY-MM-DD, recibido: '{fecha_str}'")