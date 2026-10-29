from flask import Blueprint, request, jsonify
from app.application.orden_service import OrdenService
from app.application.caja_service import ERROR_SIN_TURNO
from app.interfaces.auth_helpers import exigir_rol, es_jefe

orden_bp = Blueprint("ordenes", __name__, url_prefix="/api/ordenes")

def _error_respuesta(error, status=400):
    if error == ERROR_SIN_TURNO:
        return jsonify({"error": error, "codigo": "SIN_TURNO"}), 409
    return jsonify({"error": error}), status

@orden_bp.before_request
def _proteger_ordenes():
    if request.method == "PUT" and request.path.endswith("/marcar-pagada"):
        return exigir_rol("jefe", "trabajadora")
    if request.method == "PUT":
        return exigir_rol("jefe")
    return exigir_rol("jefe", "trabajadora")


@orden_bp.route("", methods=["GET"])
def listar_ordenes():
    ordenes = OrdenService.listar_todas()
    return jsonify([o.to_dict() for o in ordenes]), 200


@orden_bp.route("/pendientes", methods=["GET"])
def listar_ordenes_pendientes():
    ordenes = OrdenService.listar_pendientes()
    return jsonify([o.to_dict() for o in ordenes]), 200


@orden_bp.route("/<int:orden_id>", methods=["GET"])
def obtener_orden(orden_id):
    orden = OrdenService.obtener_por_id(orden_id)
    if not orden:
        return jsonify({"error": "Orden no encontrada"}), 404
    return jsonify(orden.to_dict()), 200


@orden_bp.route("", methods=["POST"])
def crear_orden():
    data = request.get_json()
    orden, error = OrdenService.crear(data, exigir_turno=not es_jefe())
    if error:
        return _error_respuesta(error)
    return jsonify(orden.to_dict()), 201


@orden_bp.route("/<int:orden_id>", methods=["PUT"])
def actualizar_orden(orden_id):
    data = request.get_json()
    orden, error = OrdenService.actualizar(orden_id, data)
    if error:
        status = 404 if error == "Orden no encontrada" else 400
        return jsonify({"error": error}), status
    return jsonify(orden.to_dict()), 200


@orden_bp.route("/<int:orden_id>/marcar-pagada", methods=["PUT"])
def marcar_pagada(orden_id):
    data = request.get_json(silent=True) or {}
    orden, error = OrdenService.marcar_pagada(
        orden_id, data.get("metodo_cobro"), exigir_turno=not es_jefe()
    )
    if error:
        status = 404 if error == "Orden no encontrada" else 400
        return _error_respuesta(error, status)
    return jsonify(orden.to_dict()), 200


@orden_bp.route("/<int:orden_id>", methods=["DELETE"])
def anular_orden(orden_id):
    exito, error = OrdenService.anular(orden_id)
    if not exito:
        return jsonify({"error": error}), 404
    return jsonify({"mensaje": "Orden anulada, el stock fue devuelto al inventario"}), 200