from datetime import datetime
from app import db
from app.infrastructure.models import SolicitudPedido, SolicitudPedidoItem, Cliente, Producto, Orden


class SolicitudPedidoService:

    @staticmethod
    def crear(data, creado_por, cliente_id=None):
        items = data.get("items", [])

        if not cliente_id:
            return None, "Esta cuenta no tiene un cliente asociado"
        if not items:
            return None, "La solicitud debe tener al menos un producto"

        cliente = Cliente.query.get(cliente_id)
        if not cliente:
            return None, "Cliente no encontrado"

        items_validos = []
        for item in items:
            if item.get("producto_id") is None or item.get("cantidad") is None:
                return None, "Cada línea necesita producto_id y cantidad"

            producto = Producto.query.get(item["producto_id"])
            if not producto:
                return None, f"Producto no encontrado (id {item['producto_id']})"

            cantidad = float(item["cantidad"])
            if cantidad <= 0:
                return None, f"La cantidad de {producto.nombre} debe ser mayor a cero"

            items_validos.append((producto, cantidad))

        solicitud = SolicitudPedido(
            cliente_id=cliente_id,
            creado_por=creado_por,
            nota=data.get("nota"),
            estado="pendiente",
        )
        db.session.add(solicitud)
        db.session.flush()

        for producto, cantidad in items_validos:
            db.session.add(SolicitudPedidoItem(
                solicitud_id=solicitud.id,
                producto_id=producto.id,
                cantidad=cantidad,
            ))

        db.session.commit()
        return solicitud, None

    @staticmethod
    def listar_todas():
        return SolicitudPedido.query.order_by(SolicitudPedido.fecha.desc()).all()

    @staticmethod
    def listar_pendientes():
        return SolicitudPedido.query.filter_by(estado="pendiente").order_by(SolicitudPedido.fecha.desc()).all()

    @staticmethod
    def contar_pendientes():
        return SolicitudPedido.query.filter_by(estado="pendiente").count()

    @staticmethod
    def listar_por_cliente(cliente_id, incluir_ocultas=False):
        query = SolicitudPedido.query.filter_by(cliente_id=cliente_id)
        if not incluir_ocultas:
            query = query.filter_by(oculto_cliente=False)
        return query.order_by(SolicitudPedido.fecha.desc()).all()

    @staticmethod
    def ocultar_para_cliente(solicitud_id, cliente_id):
        solicitud = SolicitudPedido.query.get(solicitud_id)
        if not solicitud or solicitud.cliente_id != cliente_id:
            return None, "Solicitud no encontrada"
        if solicitud.estado == "pendiente":
            return None, "Un pedido pendiente no se puede quitar de la lista"

        solicitud.oculto_cliente = True
        db.session.commit()
        return solicitud, None

    @staticmethod
    def mostrar_para_cliente(solicitud_id, cliente_id):
        solicitud = SolicitudPedido.query.get(solicitud_id)
        if not solicitud or solicitud.cliente_id != cliente_id:
            return None, "Solicitud no encontrada"

        solicitud.oculto_cliente = False
        db.session.commit()
        return solicitud, None
    
    @staticmethod
    def obtener_por_id(solicitud_id):
        return SolicitudPedido.query.get(solicitud_id)

    @staticmethod
    def marcar_atendida(solicitud_id, atendida_por, orden_id):
        solicitud = SolicitudPedido.query.get(solicitud_id)
        if not solicitud:
            return None, "Solicitud no encontrada"
        if solicitud.estado != "pendiente":
            return None, f"Esta solicitud ya fue {solicitud.estado}"

        orden = Orden.query.get(orden_id)
        if not orden:
            return None, "La venta indicada no existe"

        solicitud.estado = "atendida"
        solicitud.atendida_por = atendida_por
        solicitud.orden_id = orden_id
        solicitud.resuelta_en = datetime.utcnow()

        db.session.commit()
        return solicitud, None

    @staticmethod
    def rechazar(solicitud_id, atendida_por, motivo=None):
        solicitud = SolicitudPedido.query.get(solicitud_id)
        if not solicitud:
            return None, "Solicitud no encontrada"
        if solicitud.estado != "pendiente":
            return None, f"Esta solicitud ya fue {solicitud.estado}"

        solicitud.estado = "rechazada"
        solicitud.atendida_por = atendida_por
        solicitud.motivo_rechazo = motivo
        solicitud.resuelta_en = datetime.utcnow()

        db.session.commit()
        return solicitud, None