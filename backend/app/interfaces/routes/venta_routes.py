from flask import Blueprint, request, jsonify
from app.application.venta_service import VentaService
from app.interfaces.auth_helpers import exigir_rol

venta_bp = Blueprint("ventas", __name__, url_prefix="/api/ventas")

@venta_bp.before_request
def _proteger_ventas():
    return exigir_rol("jefe", "trabajadora")


@venta_bp.route("", methods=["GET"])
def listar_ventas():
    periodo = request.args.get("periodo", default="todas")
    ventas = VentaService.listar_todas(periodo)
    return jsonify([v.to_dict() for v in ventas]), 200


@venta_bp.route("/<int:venta_id>", methods=["GET"])
def obtener_venta(venta_id):
    venta = VentaService.obtener_por_id(venta_id)
    if not venta:
        return jsonify({"error": "Venta no encontrada"}), 404
    return jsonify(venta.to_dict()), 200


@venta_bp.route("", methods=["POST"])
def crear_venta():
    data = request.get_json()

    campos_requeridos = ["producto_id", "trabajadora_id", "cantidad", "metodo_pago"]
    faltantes = [c for c in campos_requeridos if data.get(c) is None]
    if faltantes:
        return jsonify({"error": f"Campos obligatorios faltantes: {', '.join(faltantes)}"}), 400

    venta, error = VentaService.crear(data)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(venta.to_dict()), 201


@venta_bp.route("/<int:venta_id>", methods=["PUT"])
def actualizar_venta(venta_id):
    data = request.get_json()
    venta, error = VentaService.actualizar(venta_id, data)
    if error:
        status = 404 if error == "Venta no encontrada" else 400
        return jsonify({"error": error}), status
    return jsonify(venta.to_dict()), 200


@venta_bp.route("/<int:venta_id>", methods=["DELETE"])
def eliminar_venta(venta_id):
    exito, error = VentaService.eliminar(venta_id)
    if not exito:
        return jsonify({"error": error}), 404
    return jsonify({"mensaje": "Venta eliminada"}), 200