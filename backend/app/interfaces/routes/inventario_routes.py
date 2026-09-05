from flask import Blueprint, request, jsonify
from app.application.inventario_service import InventarioService
from app.interfaces.auth_helpers import exigir_rol

inventario_bp = Blueprint("inventario", __name__, url_prefix="/api/inventario")

@inventario_bp.before_request
def _proteger_inventario():
    return exigir_rol("jefe", "trabajadora")


@inventario_bp.route("/movimientos", methods=["GET"])
def listar_movimientos():
    producto_id = request.args.get("producto_id", type=int)
    movimientos = InventarioService.listar_movimientos(producto_id)
    return jsonify([m.to_dict() for m in movimientos]), 200


@inventario_bp.route("/entrada", methods=["POST"])
def registrar_entrada():
    data = request.get_json()

    if data.get("producto_id") is None or data.get("cantidad") is None:
        return jsonify({"error": "producto_id y cantidad son obligatorios"}), 400

    movimiento, error = InventarioService.registrar_entrada(data)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(movimiento.to_dict()), 201


@inventario_bp.route("/salida", methods=["POST"])
def registrar_salida():
    data = request.get_json()

    if data.get("producto_id") is None or data.get("cantidad") is None:
        return jsonify({"error": "producto_id y cantidad son obligatorios"}), 400

    movimiento, error = InventarioService.registrar_salida_manual(data)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(movimiento.to_dict()), 201


@inventario_bp.route("/bajo-stock", methods=["GET"])
def productos_bajo_stock():
    umbral = request.args.get("umbral", default=5, type=int)
    productos = InventarioService.productos_bajo_stock(umbral)
    return jsonify([p.to_dict() for p in productos]), 200