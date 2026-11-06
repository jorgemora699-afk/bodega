from flask import Blueprint, request, jsonify
from app.application.carta_service import CartaService
from app.interfaces.auth_helpers import exigir_rol

carta_publica_bp = Blueprint("carta_publica", __name__, url_prefix="/api/carta")
carta_admin_bp = Blueprint("carta_admin", __name__, url_prefix="/api/carta-admin")

NO_ENCONTRADO = {"Producto no encontrado", "Categoría no encontrada", "Grupo no encontrado"}


# ---------- pública (sin login) ----------

@carta_publica_bp.route("", methods=["GET"])
def ver_carta():
    respuesta = jsonify(CartaService.carta_publica())
    respuesta.headers["Cache-Control"] = "public, max-age=30"
    return respuesta, 200


# ---------- admin (solo jefe) ----------

@carta_admin_bp.before_request
def _proteger_carta_admin():
    return exigir_rol("jefe")


def _respuesta_error(error):
    status = 404 if error in NO_ENCONTRADO else 400
    return jsonify({"error": error}), status


@carta_admin_bp.route("", methods=["GET"])
def vista_admin():
    return jsonify(CartaService.vista_admin()), 200


@carta_admin_bp.route("/config", methods=["PUT"])
def actualizar_config():
    data = request.get_json(silent=True) or {}
    cfg, error = CartaService.actualizar_config(data)
    if error:
        return _respuesta_error(error)
    return jsonify(cfg.to_dict()), 200


@carta_admin_bp.route("/config/imagen/<tipo>", methods=["POST"])
def subir_imagen_config(tipo):
    cfg, error = CartaService.subir_imagen_config(tipo, request.files.get("imagen"))
    if error:
        return _respuesta_error(error)
    return jsonify(cfg.to_dict()), 200


@carta_admin_bp.route("/config/imagen/<tipo>", methods=["DELETE"])
def quitar_imagen_config(tipo):
    cfg, error = CartaService.quitar_imagen_config(tipo)
    if error:
        return _respuesta_error(error)
    return jsonify(cfg.to_dict()), 200


@carta_admin_bp.route("/productos/<int:producto_id>", methods=["PUT"])
def actualizar_producto(producto_id):
    data = request.get_json(silent=True) or {}
    producto, error = CartaService.actualizar_producto(producto_id, data)
    if error:
        return _respuesta_error(error)
    return jsonify(CartaService._producto_admin(producto)), 200


@carta_admin_bp.route("/productos/orden", methods=["PUT"])
def ordenar_productos():
    data = request.get_json(silent=True) or {}
    error = CartaService.ordenar_productos(data.get("ids"))
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"mensaje": "Orden actualizado"}), 200


@carta_admin_bp.route("/productos/<int:producto_id>/imagen", methods=["POST"])
def subir_imagen_producto(producto_id):
    producto, error = CartaService.subir_imagen_producto(producto_id, request.files.get("imagen"))
    if error:
        return _respuesta_error(error)
    return jsonify(CartaService._producto_admin(producto)), 200


@carta_admin_bp.route("/productos/<int:producto_id>/imagen", methods=["DELETE"])
def quitar_imagen_producto(producto_id):
    producto, error = CartaService.quitar_imagen_producto(producto_id)
    if error:
        return _respuesta_error(error)
    return jsonify(CartaService._producto_admin(producto)), 200


# ---------- categorías (el nombre va en el cuerpo, no en la URL: puede tener espacios o tildes) ----------

@carta_admin_bp.route("/categorias/renombrar", methods=["PUT"])
def renombrar_categoria():
    data = request.get_json(silent=True) or {}
    vista, error = CartaService.renombrar_categoria(data.get("actual"), data.get("nuevo"))
    if error:
        return _respuesta_error(error)
    return jsonify(vista), 200


@carta_admin_bp.route("/categorias/imagen", methods=["POST"])
def subir_imagen_categoria():
    vista, error = CartaService.subir_imagen_categoria(
        request.form.get("nombre"), request.files.get("imagen")
    )
    if error:
        return _respuesta_error(error)
    return jsonify(vista), 200


@carta_admin_bp.route("/categorias/imagen", methods=["DELETE"])
def quitar_imagen_categoria():
    vista, error = CartaService.quitar_imagen_categoria(request.args.get("nombre"))
    if error:
        return _respuesta_error(error)
    return jsonify(vista), 200

@carta_admin_bp.route("/grupos", methods=["PUT"])
def agrupar_productos():
    data = request.get_json(silent=True) or {}
    error = CartaService.agrupar_productos(data.get("grupo"), data.get("items"))
    if error:
        return _respuesta_error(error)
    return jsonify(CartaService.vista_admin()), 200


@carta_admin_bp.route("/grupos", methods=["DELETE"])
def desagrupar():
    error = CartaService.desagrupar(request.args.get("nombre"))
    if error:
        return _respuesta_error(error)
    return jsonify(CartaService.vista_admin()), 200