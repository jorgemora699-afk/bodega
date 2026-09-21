from app.infrastructure.models import Usuario
from app import db


class AuthService:

    @staticmethod
    def autenticar(username, password):
        usuario = Usuario.query.filter_by(username=username).first()
        if not usuario or not usuario.check_password(password):
            return None
        return usuario

    @staticmethod
    def cambiar_credenciales(usuario_id, password_actual, nuevo_username=None, nueva_password=None):
        usuario = Usuario.query.get(usuario_id)
        if not usuario:
            return None, "Usuario no encontrado"

        if not usuario.check_password(password_actual):
            return None, "La contraseña actual es incorrecta"

        if nuevo_username and nuevo_username != usuario.username:
            existente = Usuario.query.filter_by(username=nuevo_username).first()
            if existente and existente.id != usuario.id:
                return None, "Ese nombre de usuario ya está en uso"
            usuario.username = nuevo_username

        if nueva_password:
            usuario.set_password(nueva_password)

        db.session.commit()
        return usuario, None