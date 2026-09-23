from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token,jwt_required, get_jwt_identity
from app.application.auth_service import AuthService

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "username y password son obligatorios"}), 400

    usuario = AuthService.autenticar(username, password)
    if not usuario:
        return jsonify({"error": "Usuario o contraseña incorrectos"}), 401

    access_token = create_access_token(
        identity=str(usuario.id),
        additional_claims={"rol": usuario.rol, "username": usuario.username},
    )

    return jsonify({
        "access_token": access_token,
        "rol": usuario.rol,
        "username": usuario.username,
    }), 200

@auth_bp.route("/credenciales", methods=["PUT"])
@jwt_required()
def cambiar_credenciales():
    usuario_id = int(get_jwt_identity())
    data = request.get_json()

    password_actual = data.get("password_actual")
    if not password_actual:
        return jsonify({"error": "Debes confirmar tu contraseña actual"}), 400

    usuario, error = AuthService.cambiar_credenciales(
        usuario_id,
        password_actual,
        nuevo_username=data.get("nuevo_username"),
        nueva_password=data.get("nueva_password"),
    )
    if error:
        return jsonify({"error": error}), 400

    return jsonify(usuario.to_dict()), 200