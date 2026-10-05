from app import db
from app.infrastructure.models import Cliente

TIPOS_VALIDOS = ("natural", "juridica")


class ClienteService:

    @staticmethod
    def listar_todos(solo_activos=True, buscar=None):
        query = Cliente.query
        if solo_activos:
            query = query.filter_by(activo=True)
        if buscar:
            patron = f"%{buscar}%"
            query = query.filter(
                db.or_(
                    Cliente.nombre.ilike(patron),
                    Cliente.documento.ilike(patron),
                )
            )
        return query.order_by(Cliente.nombre).all()

    @staticmethod
    def obtener_por_id(cliente_id):
        return Cliente.query.get(cliente_id)

    @staticmethod
    def obtener_predeterminado():
        return Cliente.query.filter_by(es_predeterminado=True).first()

    @staticmethod
    def crear(data):
        tipo = data.get("tipo")
        nombre = data.get("nombre", "").strip()
        documento = data.get("documento", "").strip()

        if tipo not in TIPOS_VALIDOS:
            return None, "tipo debe ser 'natural' o 'juridica'"
        if not nombre:
            return None, "nombre es obligatorio"
        if not documento:
            return None, "documento es obligatorio"

        existente = Cliente.query.filter_by(documento=documento).first()
        if existente:
            return None, f"Ya existe un cliente con el documento {documento} ({existente.nombre})"

        cliente = Cliente(
            tipo=tipo,
            nombre=nombre,
            documento=documento,
            contacto=data.get("contacto") if tipo == "juridica" else None,
            celular=data.get("celular"),
            direccion=data.get("direccion"),
            sin_costo=bool(data.get("sin_costo", False)),
        )
        db.session.add(cliente)
        db.session.commit()
        return cliente, None

    @staticmethod
    def actualizar(cliente_id, data):
        cliente = Cliente.query.get(cliente_id)
        if not cliente:
            return None, "Cliente no encontrado"

        if "tipo" in data:
            if data["tipo"] not in TIPOS_VALIDOS:
                return None, "tipo debe ser 'natural' o 'juridica'"
            cliente.tipo = data["tipo"]

        if "documento" in data:
            documento = data["documento"].strip()
            existente = Cliente.query.filter(
                Cliente.documento == documento, Cliente.id != cliente_id
            ).first()
            if existente:
                return None, f"Ya existe un cliente con el documento {documento} ({existente.nombre})"
            cliente.documento = documento

        if "nombre" in data:
            cliente.nombre = data["nombre"].strip()
        if "contacto" in data:
            cliente.contacto = data["contacto"]
        if "celular" in data:
            cliente.celular = data["celular"]
        if "direccion" in data:
            cliente.direccion = data["direccion"]
        if "sin_costo" in data:
            cliente.sin_costo = bool(data["sin_costo"])

        if "activo" in data:
            cliente.activo = data["activo"]

        if cliente.tipo == "natural":
            cliente.contacto = None

        db.session.commit()
        return cliente, None

    @staticmethod
    def eliminar(cliente_id):
        cliente = Cliente.query.get(cliente_id)
        if not cliente:
            return False
        cliente.activo = False
        db.session.commit()
        return True