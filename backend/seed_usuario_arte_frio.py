"""
Script de una sola vez para crear el usuario del rol arte_frio.
Uso: python seed_usuario_arte_frio.py
"""
import getpass
from app import create_app, db
from app.infrastructure.models import Usuario

app = create_app()

with app.app_context():
    username = input("Usuario para Arte Frío (ej: artefrio): ")

    if Usuario.query.filter_by(username=username).first():
        print(f"Ya existe un usuario con el username '{username}'.")
    else:
        password = getpass.getpass("Contraseña: ")
        usuario = Usuario(username=username, rol="arte_frio")
        usuario.set_password(password)
        db.session.add(usuario)
        db.session.commit()
        print(f"Usuario '{username}' creado con rol 'arte_frio'.")