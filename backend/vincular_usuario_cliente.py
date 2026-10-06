"""
Script de una sola vez para vincular el usuario arte_frio con su Cliente.
Uso: python vincular_usuario_cliente.py
"""
from app import create_app, db
from app.infrastructure.models import Usuario, Cliente

app = create_app()

with app.app_context():
    usuario = Usuario.query.filter_by(rol="arte_frio").first()
    if not usuario:
        print("No hay ningún usuario con rol 'arte_frio' todavía.")
    else:
        print(f"Usuario encontrado: {usuario.username}")
        nombre_buscar = input("Nombre (o parte del nombre) del cliente Arte Frío: ")
        cliente = Cliente.query.filter(Cliente.nombre.ilike(f"%{nombre_buscar}%")).first()

        if not cliente:
            print("No se encontró ningún cliente con ese nombre.")
        else:
            print(f"Cliente encontrado: {cliente.nombre} (id {cliente.id})")
            confirmar = input("¿Vincular? (s/n): ")
            if confirmar.lower() == "s":
                usuario.cliente_id = cliente.id
                db.session.commit()
                print("Vinculado correctamente.")