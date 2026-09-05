from flask import jsonify, request
from flask_jwt_extended import verify_jwt_in_request, get_jwt


def exigir_rol(*roles_permitidos):
    """Verifica el JWT y que el rol del usuario esté entre los permitidos.
    Se usa dentro de un before_request de blueprint.
    Devuelve una respuesta de error (para cortar la petición) o None si todo OK."""
    if request.method == "OPTIONS":
        # deja pasar el preflight de CORS sin exigir token,
        # el navegador nunca manda Authorization en esta petición
        return None

    verify_jwt_in_request()
    claims = get_jwt()
    if claims.get("rol") not in roles_permitidos:
        return jsonify({"error": "No tienes permiso para esta acción"}), 403
    return None