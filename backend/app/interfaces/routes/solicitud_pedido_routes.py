from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity
from app.infrastructure.models import Usuario
from app.application.solicitud_pedido_service import SolicitudPedidoService
from app.interfaces.auth_helpers import exigir_rol

solicitud_pedido_bp = Blueprint("solicitudes_pedido", __name__, url_prefix="/api/solicitudes-pedido")

def _cliente_id_actual():
    usuario = Usuario.query.get(int(get_jwt_identity()))
    return usuario.cliente_id if usuario else None


@solicitud_pedido_bp.before_request
def _proteger_solicitudes():
    if request.method == "OPTIONS":
        return None

    path = request.path

    # Endpoints propios del cliente de Arte Frío
    if "/mis-solicitudes" in path or path.endswith("/ocultar") or path.endswith("/mostrar"):
        return exigir_rol("arte_frio")

    # Crear un pedido: solo Arte Frío
    if request.method == "POST":
        return exigir_rol("arte_frio")

    # Atender/rechazar y ver todo: solo el equipo interno
    return exigir_rol("jefe", "trabajadora")


@solicitud_pedido_bp.route("/mis-solicitudes", methods=["GET"])
def listar_mis_solicitudes():
    cliente_id = _cliente_id_actual()
    if not cliente_id:
        return jsonify({"error": "Esta cuenta no tiene un cliente asociado"}), 404

    incluir_ocultas = request.args.get("incluir_ocultas") in ("1", "true")
    solicitudes = SolicitudPedidoService.listar_por_cliente(cliente_id, incluir_ocultas=incluir_ocultas)
    return jsonify([s.to_dict() for s in solicitudes]), 200


@solicitud_pedido_bp.route("/<int:solicitud_id>/ocultar", methods=["PUT"])
def ocultar_solicitud(solicitud_id):
    cliente_id = _cliente_id_actual()
    if not cliente_id:
        return jsonify({"error": "Esta cuenta no tiene un cliente asociado"}), 404

    solicitud, error = SolicitudPedidoService.ocultar_para_cliente(solicitud_id, cliente_id)
    if error:
        status = 404 if error == "Solicitud no encontrada" else 400
        return jsonify({"error": error}), status
    return jsonify(solicitud.to_dict()), 200


@solicitud_pedido_bp.route("/<int:solicitud_id>/mostrar", methods=["PUT"])
def mostrar_solicitud(solicitud_id):
    cliente_id = _cliente_id_actual()
    if not cliente_id:
        return jsonify({"error": "Esta cuenta no tiene un cliente asociado"}), 404

    solicitud, error = SolicitudPedidoService.mostrar_para_cliente(solicitud_id, cliente_id)
    if error:
        return jsonify({"error": error}), 404
    return jsonify(solicitud.to_dict()), 200



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