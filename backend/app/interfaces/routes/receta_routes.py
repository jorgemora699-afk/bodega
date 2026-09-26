from flask import Blueprint, request, jsonify
from app.application.receta_service import RecetaService
from app.interfaces.auth_helpers import exigir_rol

receta_bp = Blueprint("recetas", __name__, url_prefix="/api/recetas")

@receta_bp.before_request
def _proteger_receta():
    if request.method == "GET":
        return exigir_rol("jefe", "trabajadora")
    return exigir_rol("jefe")


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

@receta_bp.route("", methods=["GET"])
def listar_recetas():
    recetas = RecetaService.listar_todas()
    return jsonify([r.to_dict() for r in recetas]), 200


@receta_bp.route("/standalone", methods=["POST"])
def crear_receta_standalone():
    data = request.get_json()
    nombre = data.get("nombre")
    ingredientes = data.get("ingredientes", [])

    if not ingredientes:
        return jsonify({"error": "Debes enviar al menos un ingrediente"}), 400
    for item in ingredientes:
        if not item.get("nombre_ingrediente") or item.get("cantidad") is None or not item.get("unidad"):
            return jsonify({"error": "Cada ingrediente necesita nombre_ingrediente, cantidad y unidad"}), 400

    receta, error = RecetaService.crear_standalone(nombre, ingredientes)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(receta.to_dict()), 201


@receta_bp.route("/<int:receta_id>", methods=["GET"])
def obtener_receta_por_id(receta_id):
    receta = RecetaService.obtener_por_id(receta_id)
    if not receta:
        return jsonify({"error": "Receta no encontrada"}), 404
    return jsonify(receta.to_dict()), 200


@receta_bp.route("/<int:receta_id>", methods=["PUT"])
def actualizar_receta_por_id(receta_id):
    data = request.get_json()
    nombre = data.get("nombre")
    ingredientes = data.get("ingredientes", [])

    if not ingredientes:
        return jsonify({"error": "Debes enviar al menos un ingrediente"}), 400
    for item in ingredientes:
        if not item.get("nombre_ingrediente") or item.get("cantidad") is None or not item.get("unidad"):
            return jsonify({"error": "Cada ingrediente necesita nombre_ingrediente, cantidad y unidad"}), 400

    receta, error = RecetaService.actualizar_por_id(receta_id, nombre, ingredientes)
    if error:
        status = 404 if error == "Receta no encontrada" else 400
        return jsonify({"error": error}), status
    return jsonify(receta.to_dict()), 200


@receta_bp.route("/<int:receta_id>", methods=["DELETE"])
def eliminar_receta_por_id(receta_id):
    exito = RecetaService.eliminar_por_id(receta_id)
    if not exito:
        return jsonify({"error": "Receta no encontrada"}), 404
    return jsonify({"mensaje": "Receta eliminada"}), 200