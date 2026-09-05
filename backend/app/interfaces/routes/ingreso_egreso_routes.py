from flask import Blueprint, request, jsonify
from datetime import datetime
from app.application.ingreso_egreso_service import IngresoEgresoService
from app.interfaces.auth_helpers import exigir_rol
from app.interfaces.date_helpers import parsear_datetime

ingreso_egreso_bp = Blueprint("ingresos_egresos", __name__, url_prefix="/api/ingresos-egresos")

@ingreso_egreso_bp.before_request
def _proteger_ingreso_egreso():
    return exigir_rol("jefe")


@ingreso_egreso_bp.route("", methods=["GET"])
def listar():
    tipo = request.args.get("tipo")
    desde_str = request.args.get("desde")
    hasta_str = request.args.get("hasta")

    try:
        desde = parsear_datetime(desde_str, "desde") if desde_str else None
        hasta = parsear_datetime(hasta_str, "hasta") if hasta_str else None
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    registros = IngresoEgresoService.listar(tipo, desde, hasta)
    return jsonify([r.to_dict() for r in registros]), 200


@ingreso_egreso_bp.route("/<int:registro_id>", methods=["GET"])
def obtener(registro_id):
    registro = IngresoEgresoService.obtener_por_id(registro_id)
    if not registro:
        return jsonify({"error": "Registro no encontrado"}), 404
    return jsonify(registro.to_dict()), 200


@ingreso_egreso_bp.route("", methods=["POST"])
def crear():
    data = request.get_json()

    if data.get("tipo") not in ("ingreso", "egreso"):
        return jsonify({"error": "tipo debe ser 'ingreso' o 'egreso'"}), 400
    if data.get("monto") is None or not data.get("descripcion"):
        return jsonify({"error": "monto y descripcion son obligatorios"}), 400

    registro = IngresoEgresoService.crear(data)
    return jsonify(registro.to_dict()), 201


@ingreso_egreso_bp.route("/<int:registro_id>", methods=["PUT"])
def actualizar(registro_id):
    data = request.get_json()
    registro = IngresoEgresoService.actualizar(registro_id, data)
    if not registro:
        return jsonify({"error": "Registro no encontrado"}), 404
    return jsonify(registro.to_dict()), 200


@ingreso_egreso_bp.route("/<int:registro_id>", methods=["DELETE"])
def eliminar(registro_id):
    exito = IngresoEgresoService.eliminar(registro_id)
    if not exito:
        return jsonify({"error": "Registro no encontrado"}), 404
    return jsonify({"mensaje": "Registro eliminado"}), 200