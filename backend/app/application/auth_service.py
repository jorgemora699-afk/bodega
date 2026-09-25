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

    @staticmethod
    def resetear_password_trabajadora(jefe_id, password_jefe_actual, nueva_password):
        jefe = Usuario.query.get(jefe_id)
        if not jefe:
            return None, "Usuario no encontrado"

        if not jefe.check_password(password_jefe_actual):
            return None, "Tu contraseña actual es incorrecta"

        if not nueva_password or len(nueva_password) < 6:
            return None, "La nueva contraseña debe tener al menos 6 caracteres"

        cuenta_trabajadora = Usuario.query.filter_by(rol="trabajadora").first()
        if not cuenta_trabajadora:
            return None, "No existe una cuenta de trabajadora configurada"

        cuenta_trabajadora.set_password(nueva_password)
        db.session.commit()
        return cuenta_trabajadora, None