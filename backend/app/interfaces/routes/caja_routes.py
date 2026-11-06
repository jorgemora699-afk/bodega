from datetime import date
from flask import Blueprint, request, jsonify
from app.application.caja_service import CajaService
from app.interfaces.auth_helpers import exigir_rol, es_jefe

caja_bp = Blueprint("caja", __name__, url_prefix="/api/caja")


@caja_bp.before_request
def _proteger_caja():
    # Todo lo que cuelga de /turnos (historial y edición) y editar un
    # movimiento es solo del jefe; abrir, cerrar, agregar y borrar
    # movimientos del turno abierto los usan también las trabajadoras.
    if request.path.startswith("/api/caja/turnos"):
        return exigir_rol("jefe")
    if request.method == "PUT":
        return exigir_rol("jefe")
    return exigir_rol("jefe", "trabajadora")


@caja_bp.route("/actual", methods=["GET"])
def turno_actual():
    turno = CajaService.turno_abierto()
    return jsonify({
        "turno": CajaService.serializar(turno, detalle=True) if turno else None,
        "sugerencia_apertura": CajaService.sugerencia_apertura(),
    }), 200


@caja_bp.route("/abrir", methods=["POST"])
def abrir_caja():
    data = request.get_json(silent=True) or {}
    turno, error = CajaService.abrir(
        data.get("trabajadora_id"),
        data.get("monto_apertura"),
    )
    if error:
        return jsonify({"error": error}), 400
    return jsonify(CajaService.serializar(turno, detalle=True)), 201


@caja_bp.route("/cerrar", methods=["POST"])
def cerrar_caja():
    data = request.get_json(silent=True) or {}
    turno, error = CajaService.cerrar(
        data.get("efectivo_contado"),
        data.get("trabajadora_id"),
        es_jefe(),
        data.get("notas"),
    )
    if error:
        return jsonify({"error": error}), 400
    return jsonify(CajaService.serializar(turno, detalle=True)), 200


@caja_bp.route("/movimientos", methods=["POST"])
def crear_movimiento():
    data = request.get_json(silent=True) or {}
    movimiento, error = CajaService.registrar_movimiento(
        data.get("tipo"), data.get("monto"), data.get("motivo"),
    )
    if error:
        return jsonify({"error": error}), 400
    return jsonify(movimiento.to_dict()), 201


@caja_bp.route("/movimientos/<int:movimiento_id>", methods=["DELETE"])
def eliminar_movimiento(movimiento_id):
    exito, error = CajaService.eliminar_movimiento(movimiento_id, es_jefe())
    if not exito:
        status = 404 if error == "Movimiento no encontrado" else 400
        return jsonify({"error": error}), status
    return jsonify({"mensaje": "Movimiento eliminado"}), 200


@caja_bp.route("/turnos", methods=["GET"])
def listar_turnos():
    try:
        desde = date.fromisoformat(request.args["desde"]) if request.args.get("desde") else None
        hasta = date.fromisoformat(request.args["hasta"]) if request.args.get("hasta") else None
    except ValueError:
        return jsonify({"error": "desde y hasta deben tener el formato AAAA-MM-DD"}), 400

    trabajadora_id = request.args.get("trabajadora_id", type=int)
    turnos = CajaService.listar_turnos(desde, hasta, trabajadora_id)
    return jsonify([CajaService.serializar(t) for t in turnos]), 200


@caja_bp.route("/turnos/<int:turno_id>", methods=["GET"])
def obtener_turno(turno_id):
    turno = CajaService.obtener_por_id(turno_id)
    if not turno:
        return jsonify({"error": "Turno no encontrado"}), 404
    return jsonify(CajaService.serializar(turno, detalle=True)), 200

@caja_bp.route("/turnos/<int:turno_id>", methods=["PUT"])
def editar_turno(turno_id):
    data = request.get_json(silent=True) or {}
    turno, error = CajaService.editar_turno(turno_id, data)
    if error:
        status = 404 if error == "Turno no encontrado" else 400
        return jsonify({"error": error}), status
    return jsonify(CajaService.serializar(turno, detalle=True)), 200


@caja_bp.route("/turnos/<int:turno_id>/movimientos", methods=["POST"])
def agregar_movimiento_turno(turno_id):
    data = request.get_json(silent=True) or {}
    movimiento, error = CajaService.agregar_movimiento_a_turno(
        turno_id, data.get("tipo"), data.get("monto"), data.get("motivo"),
    )
    if error:
        status = 404 if error == "Turno no encontrado" else 400
        return jsonify({"error": error}), status
    return jsonify(movimiento.to_dict()), 201


@caja_bp.route("/movimientos/<int:movimiento_id>", methods=["PUT"])
def editar_movimiento(movimiento_id):
    data = request.get_json(silent=True) or {}
    movimiento, error = CajaService.editar_movimiento(movimiento_id, data)
    if error:
        status = 404 if error == "Movimiento no encontrado" else 400
        return jsonify({"error": error}), status
    return jsonify(movimiento.to_dict()), 200