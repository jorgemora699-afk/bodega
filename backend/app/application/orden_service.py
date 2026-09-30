from collections import defaultdict
from datetime import date, datetime
from app import db
from app.infrastructure.models import (
    Orden, Venta, Producto, Cliente, MovimientoInventario, MovimientoInsumo,
    Insumo, VentaSeleccion,
)
from app.domain.inventario import hay_stock_suficiente
from app.infrastructure.models import PrecioEspecial
from app.application.cliente_service import ClienteService
from app.application.venta_service import VentaService


def _resolver_recursos(producto, cantidad, seleccion_ids=None):
    """
    Determina sobre qué recurso(s) real(es) se debe descontar stock al vender
    este producto, y devuelve (lista, error). La lista trae una entrada por
    cada recurso a descontar: (tipo, recurso, cantidad_efectiva).

    - Paquete armado de un solo sabor (ej. 'Paquete empanadas ranchera x12'):
      una entrada ("producto", producto_base, cantidad x unidades_por_paquete).
    - Paquete mixto (ej. 'Paquete de empanadas mixta', requiere_seleccion):
      una entrada ("producto", <cada elegido>, cantidad) por cada producto
      elegido — se valida aquí mismo la selección (cantidad exacta, sin
      repetidos, categoría correcta).
    - Insumos (ej. hamburguesa -> pan, carne): una entrada ("insumo", insumo,
      cantidad x cantidad_por_unidad) por cada insumo que usa.
    - Si no aplica ninguno de los anteriores: una sola entrada ("producto",
      producto, cantidad tal cual) - el comportamiento de siempre.
    """
    if producto.es_paquete and producto.producto_base and producto.unidades_por_paquete:
        return [("producto", producto.producto_base, cantidad * producto.unidades_por_paquete)], None

    if producto.requiere_seleccion:
        seleccionados, error = VentaService._validar_seleccion(producto, seleccion_ids)
        if error:
            return None, error
        return [("producto", elegido, cantidad) for elegido in seleccionados], None

    if producto.insumos_usados:
        return [
            ("insumo", pi.insumo, cantidad * float(pi.cantidad))
            for pi in producto.insumos_usados
            if pi.insumo
        ], None

    return [("producto", producto, cantidad)], None


def _resolver_fecha(data):
    """
    Si viene 'fecha' en el payload (YYYY-MM-DD), la combina con la hora actual
    para poder registrar ventas de días anteriores. Si no viene, devuelve None
    para que el modelo use su default (datetime.utcnow).
    """
    fecha_str = data.get("fecha")
    if not fecha_str:
        return None

    fecha_dia = date.fromisoformat(fecha_str)
    return datetime.combine(fecha_dia, datetime.utcnow().time())

def _precio_para_cliente(producto, cliente_id):
    """Si el cliente tiene un precio especial para este producto, lo usa;
    si no, usa el precio normal del producto."""
    if cliente_id:
        pe = PrecioEspecial.query.filter_by(cliente_id=cliente_id, producto_id=producto.id).first()
        if pe:
            return float(pe.precio)
    return float(producto.precio_unitario)


class OrdenService:

    @staticmethod
    def listar_todas():
        return Orden.query.order_by(Orden.fecha.desc()).all()

    @staticmethod
    def obtener_por_id(orden_id):
        return Orden.query.get(orden_id)

    @staticmethod
    def listar_pendientes():
        return (
            Orden.query
            .filter_by(metodo_pago="credito", pagada=False)
            .order_by(Orden.fecha.asc())
            .all()
        )

    @staticmethod
    def _resolver_cliente(data, metodo_pago, cliente_actual_id=None):
        """Determina el cliente_id final para la orden, según el método de pago.

        - Para 'credito': el cliente es obligatorio, debe existir, estar activo
          y NO ser el cliente predeterminado (una deuda necesita un responsable real).
        - Para los demás métodos: el cliente es opcional. Si no se envía uno,
          se usa el cliente predeterminado automáticamente.

        Devuelve (cliente_id, error).
        """
        cliente_id = data.get("cliente_id", cliente_actual_id)

        if metodo_pago == "credito":
            if not cliente_id:
                return None, "cliente_id es obligatorio para ventas a crédito"

            cliente = Cliente.query.get(cliente_id)
            if not cliente:
                return None, f"Cliente no encontrado (id {cliente_id})"
            if not cliente.activo:
                return None, f"El cliente {cliente.nombre} no está activo"
            if cliente.es_predeterminado:
                return None, "No puedes registrar una cuenta por cobrar a nombre del cliente predeterminado; selecciona o crea un cliente real"

            return cliente_id, None

        # Métodos distintos a crédito: el cliente es opcional
        if not cliente_id:
            predeterminado = ClienteService.obtener_predeterminado()
            if not predeterminado:
                return None, "No hay un cliente predeterminado configurado; crea uno o selecciona un cliente"
            return predeterminado.id, None

        cliente = Cliente.query.get(cliente_id)
        if not cliente:
            return None, f"Cliente no encontrado (id {cliente_id})"
        if not cliente.activo:
            return None, f"El cliente {cliente.nombre} no está activo"

        return cliente_id, None

    @staticmethod
    def crear(data):
        trabajadora_id = data.get("trabajadora_id")
        metodo_pago = data.get("metodo_pago")
        items = data.get("items", [])
        descripcion = data.get("descripcion")

        if not trabajadora_id or not metodo_pago:
            return None, "trabajadora_id y metodo_pago son obligatorios"
        if not items:
            return None, "La orden debe tener al menos un producto"

        cliente_id, error = OrdenService._resolver_cliente(data, metodo_pago)
        if error:
            return None, error

        try:
            fecha_personalizada = _resolver_fecha(data)
        except ValueError:
            return None, "Formato de fecha inválido, usa YYYY-MM-DD"

        pagada = metodo_pago != "credito"

        productos_vendidos = {}
        cantidad_efectiva_por_producto = defaultdict(float)
        cantidad_efectiva_por_insumo = defaultdict(float)

        for item in items:
            if item.get("producto_id") is None or item.get("cantidad") is None:
                return None, "Cada línea del carrito necesita producto_id y cantidad"

            producto = Producto.query.get(item["producto_id"])
            if not producto:
                return None, f"Producto no encontrado (id {item['producto_id']})"
            productos_vendidos[item["producto_id"]] = producto

            cantidad = float(item["cantidad"])
            recursos, error = _resolver_recursos(producto, cantidad, item.get("seleccion"))
            if error:
                return None, error

            for tipo, recurso, cantidad_efectiva in recursos:
                if tipo == "insumo":
                    cantidad_efectiva_por_insumo[recurso.id] += cantidad_efectiva
                else:
                    cantidad_efectiva_por_producto[recurso.id] += cantidad_efectiva

        for producto_stock_id, cantidad_total in cantidad_efectiva_por_producto.items():
            producto_stock = Producto.query.get(producto_stock_id)
            if not hay_stock_suficiente(float(producto_stock.stock_actual), cantidad_total):
                return None, f"Stock insuficiente: quedan {float(producto_stock.stock_actual)} de {producto_stock.nombre}"

        for insumo_id, cantidad_total in cantidad_efectiva_por_insumo.items():
            insumo = Insumo.query.get(insumo_id)
            if not hay_stock_suficiente(float(insumo.stock_actual), cantidad_total):
                return None, f"Stock insuficiente de {insumo.nombre}: quedan {float(insumo.stock_actual)} {insumo.unidad_medida}"

        orden = Orden(
            trabajadora_id=trabajadora_id,
            cliente_id=cliente_id,
            metodo_pago=metodo_pago,
            descripcion=descripcion,
            pagada=pagada,
            total=0,
        )
        if fecha_personalizada:
            orden.fecha = fecha_personalizada

        db.session.add(orden)
        db.session.flush()

        total_orden = 0
        for item in items:
            producto = productos_vendidos[item["producto_id"]]
            cantidad = float(item["cantidad"])
            precio_aplicado = _precio_para_cliente(producto, cliente_id)
            subtotal = precio_aplicado * cantidad
            total_orden += subtotal

            venta = Venta(
                producto_id=producto.id,
                trabajadora_id=trabajadora_id,
                cantidad=cantidad,
                precio_unitario=precio_aplicado,
                total=subtotal,
                metodo_pago=metodo_pago,
                orden_id=orden.id,
            )
            if fecha_personalizada:
                venta.fecha = fecha_personalizada

            db.session.add(venta)
            db.session.flush()

            recursos, _ = _resolver_recursos(producto, cantidad, item.get("seleccion"))
            for tipo, recurso, cantidad_efectiva in recursos:
                recurso.stock_actual = float(recurso.stock_actual) - cantidad_efectiva

                if tipo == "insumo":
                    db.session.add(MovimientoInsumo(
                        insumo_id=recurso.id,
                        trabajadora_id=trabajadora_id,
                        venta_id=venta.id,
                        tipo="salida",
                        motivo="venta",
                        cantidad=cantidad_efectiva,
                    ))
                else:
                    db.session.add(MovimientoInventario(
                        producto_id=recurso.id,
                        trabajadora_id=trabajadora_id,
                        venta_id=venta.id,
                        tipo="salida",
                        motivo="venta",
                        cantidad=cantidad_efectiva,
                    ))
                    if producto.requiere_seleccion:
                        db.session.add(VentaSeleccion(
                            venta_id=venta.id,
                            producto_id=recurso.id,
                        ))

        orden.total = total_orden
        db.session.commit()
        return orden, None

    @staticmethod
    def actualizar(orden_id, data):
        orden = Orden.query.get(orden_id)
        if not orden:
            return None, "Orden no encontrada"

        metodo_pago = data.get("metodo_pago", orden.metodo_pago)
        trabajadora_id = data.get("trabajadora_id", orden.trabajadora_id)
        descripcion = data.get("descripcion", orden.descripcion)
        items = data.get("items")

        if not items:
            return None, "La orden debe tener al menos un producto"

        cliente_id, error = OrdenService._resolver_cliente(
            data, metodo_pago, cliente_actual_id=orden.cliente_id
        )
        if error:
            return None, error

        if metodo_pago == "credito":
            # Si ya era a crédito, se respeta el estado de pago que tenía.
            # Si nace como crédito ahora (antes era otro método), queda pendiente.
            pagada = orden.pagada if orden.metodo_pago == "credito" else False
        else:
            pagada = True

        # 1. Stock "hipotético" — como si las líneas viejas no hubieran existido,
        #    usando lo que de verdad se descontó (guardado en cada movimiento),
        #    no lo que dice la línea de venta. Una venta puede tener más de un
        #    movimiento de producto (ej. paquete mixto -> 2 empanadas), así
        #    que se consultan todos, no solo "el" movimiento.
        stock_hipotetico_producto = {}
        stock_hipotetico_insumo = {}

        for venta in orden.ventas:
            movimientos_producto_venta = MovimientoInventario.query.filter_by(
                venta_id=venta.id, motivo="venta"
            ).all()
            for m in movimientos_producto_venta:
                producto_stock = Producto.query.get(m.producto_id)
                if producto_stock:
                    base = stock_hipotetico_producto.get(m.producto_id, float(producto_stock.stock_actual))
                    stock_hipotetico_producto[m.producto_id] = base + float(m.cantidad)

            movimientos_insumo_venta = MovimientoInsumo.query.filter_by(
                venta_id=venta.id, motivo="venta"
            ).all()
            for m in movimientos_insumo_venta:
                insumo = Insumo.query.get(m.insumo_id)
                if insumo:
                    base = stock_hipotetico_insumo.get(m.insumo_id, float(insumo.stock_actual))
                    stock_hipotetico_insumo[m.insumo_id] = base + float(m.cantidad)

        # 2. Resolver las líneas nuevas a su producto/insumo de stock real y validar.
        productos_vendidos = {}
        cantidad_efectiva_por_producto = defaultdict(float)
        cantidad_efectiva_por_insumo = defaultdict(float)

        for item in items:
            if item.get("producto_id") is None or item.get("cantidad") is None:
                return None, "Cada línea del pedido necesita producto_id y cantidad"

            producto = Producto.query.get(item["producto_id"])
            if not producto:
                return None, f"Producto no encontrado (id {item['producto_id']})"
            productos_vendidos[item["producto_id"]] = producto

            cantidad = float(item["cantidad"])
            recursos, error = _resolver_recursos(producto, cantidad, item.get("seleccion"))
            if error:
                return None, error

            for tipo, recurso, cantidad_efectiva in recursos:
                if tipo == "insumo":
                    cantidad_efectiva_por_insumo[recurso.id] += cantidad_efectiva
                else:
                    cantidad_efectiva_por_producto[recurso.id] += cantidad_efectiva

        for producto_stock_id, cantidad_total in cantidad_efectiva_por_producto.items():
            producto_stock = Producto.query.get(producto_stock_id)
            if not producto_stock:
                return None, "Producto de stock no encontrado"
            disponible = stock_hipotetico_producto.get(producto_stock_id, float(producto_stock.stock_actual))
            if not hay_stock_suficiente(disponible, cantidad_total):
                return None, f"Stock insuficiente: quedan {disponible} de {producto_stock.nombre}"

        for insumo_id, cantidad_total in cantidad_efectiva_por_insumo.items():
            insumo = Insumo.query.get(insumo_id)
            if not insumo:
                return None, "Insumo no encontrado"
            disponible = stock_hipotetico_insumo.get(insumo_id, float(insumo.stock_actual))
            if not hay_stock_suficiente(disponible, cantidad_total):
                return None, f"Stock insuficiente de {insumo.nombre}: quedan {disponible} {insumo.unidad_medida}"

        # 3. Revertir stock real de las líneas viejas (reutiliza la misma
        #    lógica de reversión que usan las ventas sueltas).
        for venta in list(orden.ventas):
            VentaService._revertir_venta(venta)
            db.session.delete(venta)
        db.session.flush()

        # 4. Crear las líneas nuevas, descontando stock real (producto, insumos
        #    o selección de paquete mixto).
        total_orden = 0
        for item in items:
            producto = productos_vendidos[item["producto_id"]]
            cantidad = float(item["cantidad"])
            precio_aplicado = _precio_para_cliente(producto, cliente_id)
            subtotal = precio_aplicado * cantidad
            total_orden += subtotal

            venta = Venta(
                producto_id=producto.id,
                trabajadora_id=trabajadora_id,
                cantidad=cantidad,
                precio_unitario=precio_aplicado,
                total=subtotal,
                metodo_pago=metodo_pago,
                orden_id=orden.id,
                editado=True,
            )
            db.session.add(venta)
            db.session.flush()

            recursos, _ = _resolver_recursos(producto, cantidad, item.get("seleccion"))
            for tipo, recurso, cantidad_efectiva in recursos:
                recurso.stock_actual = float(recurso.stock_actual) - cantidad_efectiva

                if tipo == "insumo":
                    db.session.add(MovimientoInsumo(
                        insumo_id=recurso.id,
                        trabajadora_id=trabajadora_id,
                        venta_id=venta.id,
                        tipo="salida",
                        motivo="venta",
                        cantidad=cantidad_efectiva,
                    ))
                else:
                    db.session.add(MovimientoInventario(
                        producto_id=recurso.id,
                        trabajadora_id=trabajadora_id,
                        venta_id=venta.id,
                        tipo="salida",
                        motivo="venta",
                        cantidad=cantidad_efectiva,
                    ))
                    if producto.requiere_seleccion:
                        db.session.add(VentaSeleccion(
                            venta_id=venta.id,
                            producto_id=recurso.id,
                        ))

        orden.metodo_pago = metodo_pago
        orden.trabajadora_id = trabajadora_id
        orden.cliente_id = cliente_id
        orden.descripcion = descripcion
        orden.pagada = pagada
        orden.total = total_orden
        orden.editado = True

        db.session.commit()
        return orden, None

    @staticmethod
    def marcar_pagada(orden_id):
        orden = Orden.query.get(orden_id)
        if not orden:
            return None, "Orden no encontrada"

        if orden.metodo_pago != "credito":
            return None, "Esta orden no es una venta a crédito"

        if orden.pagada:
            return None, "Esta orden ya está marcada como pagada"

        orden.pagada = True
        db.session.commit()
        return orden, None

    @staticmethod
    def anular(orden_id):
        orden = Orden.query.get(orden_id)
        if not orden:
            return False, "Orden no encontrada"

        for venta in orden.ventas:
            VentaService._revertir_venta(venta)
            db.session.delete(venta)

        db.session.delete(orden)
        db.session.commit()
        return True, None