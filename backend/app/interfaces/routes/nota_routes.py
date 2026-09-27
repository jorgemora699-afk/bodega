from flask import Blueprint, request, jsonify
from app.application.nota_service import NotaService
from app.interfaces.auth_helpers import exigir_rol

nota_bp = Blueprint("notas", __name__, url_prefix="/api/notas")

@nota_bp.before_request
def _proteger_notas():
    return exigir_rol("jefe", "trabajadora")


@nota_bp.route("", methods=["GET"])
def listar_notas():
    notas = NotaService.listar_todas()
    return jsonify([n.to_dict() for n in notas]), 200


@nota_bp.route("", methods=["POST"])
def crear_nota():
    data = request.get_json()
    nota, error = NotaService.crear(data)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(nota.to_dict()), 201


@nota_bp.route("/<int:nota_id>/resolver", methods=["PUT"])
def resolver_nota(nota_id):
    data = request.get_json()
    trabajadora_id = data.get("trabajadora_id")

    if not trabajadora_id:
        return jsonify({"error": "trabajadora_id es obligatorio"}), 400

    nota, error = NotaService.marcar_resuelta(nota_id, trabajadora_id)
    if error:
        status = 404 if error == "Nota no encontrada" else 400
        return jsonify({"error": error}), status
    return jsonify(nota.to_dict()), 200


@nota_bp.route("/<int:nota_id>", methods=["DELETE"])
def eliminar_nota(nota_id):
    exito = NotaService.eliminar(nota_id)
    if not exito:
        return jsonify({"error": "Nota no encontrada"}), 404
    return jsonify({"mensaje": "Nota eliminada"}), 200