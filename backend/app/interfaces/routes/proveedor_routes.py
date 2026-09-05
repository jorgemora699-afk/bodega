from flask import Blueprint, request, jsonify
from app.application.proveedor_service import ProveedorService
from app.interfaces.auth_helpers import exigir_rol

proveedor_bp = Blueprint("proveedores", __name__, url_prefix="/api/proveedores")

@proveedor_bp.before_request
def _proteger_proveedores():
    if request.method == "GET":
        return exigir_rol("jefe", "trabajadora")
    return exigir_rol("jefe")


@proveedor_bp.route("", methods=["GET"])
def listar_proveedores():
    proveedores = ProveedorService.listar_todos()
    return jsonify([p.to_dict() for p in proveedores]), 200


@proveedor_bp.route("/<int:proveedor_id>", methods=["GET"])
def obtener_proveedor(proveedor_id):
    proveedor = ProveedorService.obtener_por_id(proveedor_id)
    if not proveedor:
        return jsonify({"error": "Proveedor no encontrado"}), 404
    return jsonify(proveedor.to_dict()), 200


@proveedor_bp.route("", methods=["POST"])
def crear_proveedor():
    data = request.get_json()

    if not data.get("nombre") or not data.get("celular"):
        return jsonify({"error": "nombre y celular son obligatorios"}), 400

    proveedor = ProveedorService.crear(data)
    return jsonify(proveedor.to_dict()), 201


@proveedor_bp.route("/<int:proveedor_id>", methods=["PUT"])
def actualizar_proveedor(proveedor_id):
    data = request.get_json()
    proveedor = ProveedorService.actualizar(proveedor_id, data)
    if not proveedor:
        return jsonify({"error": "Proveedor no encontrado"}), 404
    return jsonify(proveedor.to_dict()), 200


@proveedor_bp.route("/<int:proveedor_id>", methods=["DELETE"])
def eliminar_proveedor(proveedor_id):
    exito = ProveedorService.eliminar(proveedor_id)
    if not exito:
        return jsonify({"error": "Proveedor no encontrado"}), 404
    return jsonify({"mensaje": "Proveedor eliminado"}), 200