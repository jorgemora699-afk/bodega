from flask import Blueprint, request, jsonify
from app.application.trabajadora_service import TrabajadoraService

trabajadora_bp = Blueprint("trabajadoras", __name__, url_prefix="/api/trabajadoras")


@trabajadora_bp.route("", methods=["GET"])
def listar_trabajadoras():
    trabajadoras = TrabajadoraService.listar_todas()
    return jsonify([t.to_dict() for t in trabajadoras]), 200


@trabajadora_bp.route("/<int:trabajadora_id>", methods=["GET"])
def obtener_trabajadora(trabajadora_id):
    trabajadora = TrabajadoraService.obtener_por_id(trabajadora_id)
    if not trabajadora:
        return jsonify({"error": "Trabajadora no encontrada"}), 404
    return jsonify(trabajadora.to_dict()), 200


@trabajadora_bp.route("", methods=["POST"])
def crear_trabajadora():
    data = request.get_json()

    if not data.get("nombre"):
        return jsonify({"error": "nombre es obligatorio"}), 400

    trabajadora = TrabajadoraService.crear(data)
    return jsonify(trabajadora.to_dict()), 201


@trabajadora_bp.route("/<int:trabajadora_id>", methods=["PUT"])
def actualizar_trabajadora(trabajadora_id):
    data = request.get_json()
    trabajadora = TrabajadoraService.actualizar(trabajadora_id, data)
    if not trabajadora:
        return jsonify({"error": "Trabajadora no encontrada"}), 404
    return jsonify(trabajadora.to_dict()), 200


@trabajadora_bp.route("/<int:trabajadora_id>", methods=["DELETE"])
def eliminar_trabajadora(trabajadora_id):
    exito = TrabajadoraService.eliminar(trabajadora_id)
    if not exito:
        return jsonify({"error": "Trabajadora no encontrada"}), 404
    return jsonify({"mensaje": "Trabajadora eliminada"}), 200