from flask import Blueprint, request, jsonify
from app.application.cliente_service import ClienteService
from app.interfaces.auth_helpers import exigir_rol
from app.application.precio_especial_service import PrecioEspecialService

cliente_bp = Blueprint("clientes", __name__, url_prefix="/api/clientes")

@cliente_bp.before_request
def _proteger_clientes():
    # Jefe y trabajadora pueden ver y crear clientes (se crean sobre la marcha
    # durante una venta). Editar y eliminar queda solo para el jefe.
    if request.method in ("GET", "POST"):
        return exigir_rol("jefe", "trabajadora")
    return exigir_rol("jefe")


@cliente_bp.route("", methods=["GET"])
def listar_clientes():
    buscar = request.args.get("buscar")
    clientes = ClienteService.listar_todos(buscar=buscar)
    return jsonify([c.to_dict() for c in clientes]), 200


@cliente_bp.route("/predeterminado", methods=["GET"])
def obtener_cliente_predeterminado():
    cliente = ClienteService.obtener_predeterminado()
    if not cliente:
        return jsonify({"error": "No hay un cliente predeterminado configurado"}), 404
    return jsonify(cliente.to_dict()), 200


@cliente_bp.route("/<int:cliente_id>", methods=["GET"])
def obtener_cliente(cliente_id):
    cliente = ClienteService.obtener_por_id(cliente_id)
    if not cliente:
        return jsonify({"error": "Cliente no encontrado"}), 404
    return jsonify(cliente.to_dict()), 200


@cliente_bp.route("", methods=["POST"])
def crear_cliente():
    data = request.get_json()
    cliente, error = ClienteService.crear(data)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(cliente.to_dict()), 201


@cliente_bp.route("/<int:cliente_id>", methods=["PUT"])
def actualizar_cliente(cliente_id):
    data = request.get_json()
    cliente, error = ClienteService.actualizar(cliente_id, data)
    if error:
        status = 404 if error == "Cliente no encontrado" else 400
        return jsonify({"error": error}), status
    return jsonify(cliente.to_dict()), 200


@cliente_bp.route("/<int:cliente_id>", methods=["DELETE"])
def eliminar_cliente(cliente_id):
    exito, error = ClienteService.eliminar(cliente_id)
    if not exito:
        status = 404 if error == "Cliente no encontrado" else 400
        return jsonify({"error": error}), status
    return jsonify({"mensaje": "Cliente eliminado"}), 200

@cliente_bp.route("/<int:cliente_id>/precios-especiales", methods=["GET"])
def listar_precios_especiales(cliente_id):
    if not ClienteService.obtener_por_id(cliente_id):
        return jsonify({"error": "Cliente no encontrado"}), 404
    precios = PrecioEspecialService.listar_por_cliente(cliente_id)
    return jsonify([p.to_dict() for p in precios]), 200


@cliente_bp.route("/<int:cliente_id>/precios-especiales", methods=["POST"])
def crear_precio_especial(cliente_id):
    data = request.get_json()
    producto_id = data.get("producto_id")
    precio = data.get("precio")

    if not producto_id or precio is None:
        return jsonify({"error": "producto_id y precio son obligatorios"}), 400

    pe, error = PrecioEspecialService.crear_o_actualizar(cliente_id, producto_id, precio)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(pe.to_dict()), 201


@cliente_bp.route("/precios-especiales/<int:precio_especial_id>", methods=["DELETE"])
def eliminar_precio_especial(precio_especial_id):
    exito = PrecioEspecialService.eliminar(precio_especial_id)
    if not exito:
        return jsonify({"error": "Precio especial no encontrado"}), 404
    return jsonify({"mensaje": "Precio especial eliminado"}), 200