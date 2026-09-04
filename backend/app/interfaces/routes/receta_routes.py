from flask import Blueprint, request, jsonify
from app.application.receta_service import RecetaService

receta_bp = Blueprint("recetas", __name__, url_prefix="/api/recetas")


@receta_bp.route("/producto/<int:producto_id>", methods=["GET"])
def obtener_receta(producto_id):
    receta = RecetaService.obtener_por_producto(producto_id)
    if not receta:
        return jsonify({"error": "Este producto no tiene receta registrada"}), 404
    return jsonify(receta.to_dict()), 200


@receta_bp.route("/producto/<int:producto_id>", methods=["POST"])
def guardar_receta(producto_id):
    data = request.get_json()
    ingredientes = data.get("ingredientes", [])

    if not ingredientes:
        return jsonify({"error": "Debes enviar al menos un ingrediente"}), 400

    for item in ingredientes:
        if not item.get("nombre_ingrediente") or item.get("cantidad") is None or not item.get("unidad"):
            return jsonify({"error": "Cada ingrediente necesita nombre_ingrediente, cantidad y unidad"}), 400

    receta, error = RecetaService.guardar(producto_id, ingredientes)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(receta.to_dict()), 201


@receta_bp.route("/producto/<int:producto_id>", methods=["DELETE"])
def eliminar_receta(producto_id):
    exito = RecetaService.eliminar(producto_id)
    if not exito:
        return jsonify({"error": "Este producto no tiene receta registrada"}), 404
    return jsonify({"mensaje": "Receta eliminada"}), 200