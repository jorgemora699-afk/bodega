import os
from functools import wraps
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify

from app.infrastructure.models import Venta, Producto

alexa_bp = Blueprint("alexa", __name__, url_prefix="/api/alexa")


# =====================================================
# PROTECCIÓN POR API KEY (no por login de usuario)
# =====================================================
#
# Alexa no puede "iniciar sesión" como una persona en el navegador, así que
# estas rutas se protegen con una llave fija que se manda en el header
# X-Api-Key. Esa llave se guarda en la variable de entorno ALEXA_API_KEY
# (en Railway, en tu servicio de backend) y en la función Lambda de Alexa,
# nunca en el código.

def exigir_api_key(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        clave_esperada = os.environ.get("ALEXA_API_KEY")
        clave_recibida = request.headers.get("X-Api-Key")

        if not clave_esperada or clave_recibida != clave_esperada:
            return jsonify({"error": "No autorizado"}), 401

        return f(*args, **kwargs)
    return wrapper


def _rango_hoy_bogota():
    """
    Calcula el inicio y fin del día de HOY según la hora de Bogotá
    (UTC-5, sin horario de verano), y los devuelve ya convertidos a UTC
    para poder compararlos contra Venta.fecha (que se guarda en UTC).
    """
    ahora_utc = datetime.utcnow()
    ahora_bogota = ahora_utc - timedelta(hours=5)

    inicio_bogota = datetime(ahora_bogota.year, ahora_bogota.month, ahora_bogota.day)
    inicio_utc = inicio_bogota + timedelta(hours=5)
    fin_utc = inicio_utc + timedelta(days=1)

    return inicio_utc, fin_utc


@alexa_bp.route("/ventas-hoy", methods=["GET"])
@exigir_api_key
def ventas_hoy():
    inicio_utc, fin_utc = _rango_hoy_bogota()

    ventas = Venta.query.filter(
        Venta.fecha >= inicio_utc, Venta.fecha < fin_utc
    ).all()

    total = sum(float(v.total) for v in ventas)

    # Cuenta "transacciones": cada pedido con varios productos cuenta una
    # sola vez (no una por cada línea), más las ventas sueltas sin pedido.
    ordenes_ids = {v.orden_id for v in ventas if v.orden_id}
    ventas_sueltas = [v for v in ventas if not v.orden_id]
    numero_ventas = len(ordenes_ids) + len(ventas_sueltas)

    return jsonify({
        "numero_ventas": numero_ventas,
        "total": total,
    }), 200


@alexa_bp.route("/stock", methods=["GET"])
@exigir_api_key
def stock_producto():
    nombre_buscado = request.args.get("producto", "").strip()

    if not nombre_buscado:
        return jsonify({"error": "Falta el parámetro 'producto'"}), 400

    productos = (
        Producto.query
        .filter(Producto.activo == True)  # noqa: E712
        .filter(Producto.nombre.ilike(f"%{nombre_buscado}%"))
        .order_by(Producto.nombre)
        .limit(5)
        .all()
    )

    return jsonify({
        "encontrados": [
            {
                "id": p.id,
                "nombre": p.nombre,
                "stock_actual": p.to_dict()["stock_actual"],
                "stock_minimo": float(p.stock_minimo),
            }
            for p in productos
        ]
    }), 200