from app.infrastructure.models import Usuario


class AuthService:

    @staticmethod
    def autenticar(username, password):
        usuario = Usuario.query.filter_by(username=username).first()
        if not usuario or not usuario.check_password(password):
            return None
        return usuario