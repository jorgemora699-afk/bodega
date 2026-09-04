from flask import Blueprint, request, jsonify
from app.application.producto_service import ProductoService

producto_bp = Blueprint("productos", __name__, url_prefix="/api/productos")


@producto_bp.route("", methods=["GET"])
def listar_productos():
    productos = ProductoService.listar_todos()
    return jsonify([p.to_dict() for p in productos]), 200


@producto_bp.route("/<int:producto_id>", methods=["GET"])
def obtener_producto(producto_id):
    producto = ProductoService.obtener_por_id(producto_id)
    if not producto:
        return jsonify({"error": "Producto no encontrado"}), 404
    return jsonify(producto.to_dict()), 200


@producto_bp.route("", methods=["POST"])
def crear_producto():
    data = request.get_json()

    if not data.get("nombre") or data.get("precio_unitario") is None:
        return jsonify({"error": "nombre y precio_unitario son obligatorios"}), 400

    producto = ProductoService.crear(data)
    return jsonify(producto.to_dict()), 201


@producto_bp.route("/<int:producto_id>", methods=["PUT"])
def actualizar_producto(producto_id):
    data = request.get_json()
    producto = ProductoService.actualizar(producto_id, data)
    if not producto:
        return jsonify({"error": "Producto no encontrado"}), 404
    return jsonify(producto.to_dict()), 200


@producto_bp.route("/<int:producto_id>", methods=["DELETE"])
def eliminar_producto(producto_id):
    exito = ProductoService.eliminar(producto_id)
    if not exito:
        return jsonify({"error": "Producto no encontrado"}), 404
    return jsonify({"mensaje": "Producto eliminado"}), 200

from app.application.proveedor_service import ProveedorService

@producto_bp.route("/<int:producto_id>/proveedores", methods=["GET"])
def proveedores_del_producto(producto_id):
    proveedores = ProveedorService.listar_por_producto(producto_id)
    return jsonify([p.to_dict() for p in proveedores]), 200