from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt
from app.application.solicitud_pedido_service import SolicitudPedidoService
from app.interfaces.auth_helpers import exigir_rol

solicitud_pedido_bp = Blueprint("solicitudes_pedido", __name__, url_prefix="/api/solicitudes-pedido")

@solicitud_pedido_bp.before_request
def _proteger_solicitudes():
    if request.method == "POST":
        return exigir_rol("arte_frio")
    return exigir_rol("jefe", "trabajadora", "arte_frio")


@solicitud_pedido_bp.route("", methods=["GET"])
def listar_solicitudes():
    solicitudes = SolicitudPedidoService.listar_todas()
    return jsonify([s.to_dict() for s in solicitudes]), 200


@solicitud_pedido_bp.route("/pendientes", methods=["GET"])
def listar_pendientes():
    solicitudes = SolicitudPedidoService.listar_pendientes()
    return jsonify([s.to_dict() for s in solicitudes]), 200


@solicitud_pedido_bp.route("/pendientes/conteo", methods=["GET"])
def contar_pendientes():
    return jsonify({"pendientes": SolicitudPedidoService.contar_pendientes()}), 200


@solicitud_pedido_bp.route("/<int:solicitud_id>", methods=["GET"])
def obtener_solicitud(solicitud_id):
    solicitud = SolicitudPedidoService.obtener_por_id(solicitud_id)
    if not solicitud:
        return jsonify({"error": "Solicitud no encontrada"}), 404
    return jsonify(solicitud.to_dict()), 200


from app.infrastructure.models import Usuario

@solicitud_pedido_bp.route("", methods=["POST"])
def crear_solicitud():
    data = request.get_json()
    claims = get_jwt()
    username = claims.get("username")

    usuario = Usuario.query.filter_by(username=username).first()
    cliente_id = usuario.cliente_id if usuario else None

    solicitud, error = SolicitudPedidoService.crear(data, creado_por=username, cliente_id=cliente_id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(solicitud.to_dict()), 201


@solicitud_pedido_bp.route("/<int:solicitud_id>/atender", methods=["PUT"])
def atender_solicitud(solicitud_id):
    data = request.get_json()
    username = get_jwt().get("username")

    if data.get("orden_id") is None:
        return jsonify({"error": "orden_id es obligatorio"}), 400

    solicitud, error = SolicitudPedidoService.marcar_atendida(solicitud_id, username, data["orden_id"])
    if error:
        status = 404 if error == "Solicitud no encontrada" else 400
        return jsonify({"error": error}), status
    return jsonify(solicitud.to_dict()), 200


@solicitud_pedido_bp.route("/<int:solicitud_id>/rechazar", methods=["PUT"])
def rechazar_solicitud(solicitud_id):
    data = request.get_json() or {}
    username = get_jwt().get("username")

    solicitud, error = SolicitudPedidoService.rechazar(solicitud_id, username, data.get("motivo"))
    if error:
        status = 404 if error == "Solicitud no encontrada" else 400
        return jsonify({"error": error}), status
    return jsonify(solicitud.to_dict()), 200