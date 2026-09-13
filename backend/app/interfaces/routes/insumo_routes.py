from flask import Blueprint, request, jsonify
from app.application.insumo_service import InsumoService
from app.interfaces.auth_helpers import exigir_rol

insumo_bp = Blueprint("insumos", __name__, url_prefix="/api/insumos")

@insumo_bp.before_request
def _proteger_insumos():
    if request.method == "GET":
        return exigir_rol("jefe", "trabajadora")
    if request.path.endswith("/entrada") or request.path.endswith("/salida"):
        return exigir_rol("jefe", "trabajadora")
    return exigir_rol("jefe")


@insumo_bp.route("", methods=["GET"])
def listar_insumos():
    insumos = InsumoService.listar_todos()
    return jsonify([i.to_dict() for i in insumos]), 200


@insumo_bp.route("/<int:insumo_id>", methods=["GET"])
def obtener_insumo(insumo_id):
    insumo = InsumoService.obtener_por_id(insumo_id)
    if not insumo:
        return jsonify({"error": "Insumo no encontrado"}), 404
    return jsonify(insumo.to_dict()), 200


@insumo_bp.route("", methods=["POST"])
def crear_insumo():
    data = request.get_json()

    if not data.get("nombre"):
        return jsonify({"error": "nombre es obligatorio"}), 400

    insumo = InsumoService.crear(data)
    return jsonify(insumo.to_dict()), 201


@insumo_bp.route("/<int:insumo_id>", methods=["PUT"])
def actualizar_insumo(insumo_id):
    data = request.get_json()
    insumo = InsumoService.actualizar(insumo_id, data)
    if not insumo:
        return jsonify({"error": "Insumo no encontrado"}), 404
    return jsonify(insumo.to_dict()), 200


@insumo_bp.route("/<int:insumo_id>", methods=["DELETE"])
def eliminar_insumo(insumo_id):
    exito = InsumoService.eliminar(insumo_id)
    if not exito:
        return jsonify({"error": "Insumo no encontrado"}), 404
    return jsonify({"mensaje": "Insumo desactivado"}), 200


@insumo_bp.route("/movimientos", methods=["GET"])
def listar_movimientos():
    insumo_id = request.args.get("insumo_id", type=int)
    movimientos = InsumoService.listar_movimientos(insumo_id)
    return jsonify([m.to_dict() for m in movimientos]), 200


@insumo_bp.route("/entrada", methods=["POST"])
def registrar_entrada():
    data = request.get_json()

    if data.get("insumo_id") is None or data.get("cantidad") is None:
        return jsonify({"error": "insumo_id y cantidad son obligatorios"}), 400

    movimiento, error = InsumoService.registrar_entrada(data)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(movimiento.to_dict()), 201


@insumo_bp.route("/salida", methods=["POST"])
def registrar_salida():
    data = request.get_json()

    if data.get("insumo_id") is None or data.get("cantidad") is None:
        return jsonify({"error": "insumo_id y cantidad son obligatorios"}), 400

    movimiento, error = InsumoService.registrar_salida(data)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(movimiento.to_dict()), 201


@insumo_bp.route("/bajo-stock", methods=["GET"])
def bajo_stock():
    insumos = InsumoService.bajo_stock()
    return jsonify([i.to_dict() for i in insumos]), 200