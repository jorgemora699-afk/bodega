from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
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
@jwt_required()
def crear_nota():
    data = request.get_json()
    rol = get_jwt().get("rol")
    usuario_id = int(get_jwt_identity())

    nota, error = NotaService.crear(data, usuario_id, rol)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(nota.to_dict()), 201


@nota_bp.route("/<int:nota_id>/resolver", methods=["PUT"])
@jwt_required()
def resolver_nota(nota_id):
    data = request.get_json() or {}
    rol = get_jwt().get("rol")
    usuario_id = int(get_jwt_identity())

    nota, error = NotaService.marcar_resuelta(
        nota_id, usuario_id, rol, trabajadora_id=data.get("trabajadora_id")
    )
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