from flask import Blueprint, request, jsonify
from app.application.horario_service import HorarioService
from app.interfaces.date_helpers import parsear_fecha
from app.interfaces.auth_helpers import exigir_rol

horario_bp = Blueprint("horarios", __name__, url_prefix="/api/horarios")

@horario_bp.before_request
def _proteger_horarios():
    if request.method == "PUT":
        return exigir_rol("jefe")
    return exigir_rol("jefe", "trabajadora")


@horario_bp.route("", methods=["GET"])
def listar_horarios():
    trabajadora_id = request.args.get("trabajadora_id", type=int)
    fecha_str = request.args.get("fecha")

    fecha = None
    if fecha_str:
        try:
            fecha = parsear_fecha(fecha_str, "fecha")
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    horarios = HorarioService.listar(trabajadora_id, fecha)
    return jsonify([h.to_dict() for h in horarios]), 200


@horario_bp.route("/entrada", methods=["POST"])
def marcar_entrada():
    data = request.get_json()
    if data.get("trabajadora_id") is None:
        return jsonify({"error": "trabajadora_id es obligatorio"}), 400

    horario, error = HorarioService.marcar_entrada(data["trabajadora_id"])
    if error:
        return jsonify({"error": error}), 400
    return jsonify(horario.to_dict()), 201


@horario_bp.route("/salida", methods=["POST"])
def marcar_salida():
    data = request.get_json()
    if data.get("trabajadora_id") is None:
        return jsonify({"error": "trabajadora_id es obligatorio"}), 400

    horario, error = HorarioService.marcar_salida(data["trabajadora_id"])
    if error:
        return jsonify({"error": error}), 400
    return jsonify(horario.to_dict()), 200


@horario_bp.route("/<int:horario_id>", methods=["PUT"])
def actualizar_horario(horario_id):
    data = request.get_json()
    horario, error = HorarioService.actualizar(horario_id, data)
    if error:
        status = 404 if error == "Turno no encontrado" else 400
        return jsonify({"error": error}), status
    return jsonify(horario.to_dict()), 200