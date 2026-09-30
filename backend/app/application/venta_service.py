from datetime import date, datetime
from app import db
from app.infrastructure.models import Venta, Producto, MovimientoInventario, MovimientoInsumo, VentaSeleccion
from app.domain.inventario import hay_stock_suficiente
from app.domain.periodos import rango_por_periodo
from sqlalchemy.orm import joinedload


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


class VentaService:

    @staticmethod
    def listar_todas(periodo="todas"):
        query = Venta.query.options(joinedload(Venta.producto), joinedload(Venta.trabajadora))
        if periodo and periodo != "todas":
            inicio, fin = rango_por_periodo(periodo)
            query = query.filter(Venta.fecha.between(inicio, fin))
        return query.order_by(Venta.fecha.desc()).all()

    @staticmethod
    def obtener_por_id(venta_id):
        return Venta.query.get(venta_id)

    # ---------- paquete mixto: selección de sabores ----------

    @staticmethod
    def _validar_seleccion(producto, seleccion_ids):
        """
        Para productos con requiere_seleccion=True (ej. Paquete de empanadas
        mixta): valida que la selección tenga la cantidad exacta esperada,
        todos distintos entre sí, existentes, activos y de la categoría
        configurada en el producto. Devuelve (productos_seleccionados, error);
        si el producto no requiere selección, devuelve ([], None) sin mirar
        seleccion_ids.
        """
        if not producto.requiere_seleccion:
            return [], None

        cantidad_esperada = producto.cantidad_seleccion or 0
        seleccion_ids = seleccion_ids or []

        if len(seleccion_ids) != cantidad_esperada:
            return None, (
                f"{producto.nombre} requiere seleccionar exactamente "
                f"{cantidad_esperada} productos (se recibieron {len(seleccion_ids)})"
            )

        if len(set(seleccion_ids)) != len(seleccion_ids):
            return None, f"Los productos seleccionados para {producto.nombre} deben ser distintos entre sí"

        seleccionados = []
        for pid in seleccion_ids:
            elegido = Producto.query.get(pid)
            if not elegido:
                return None, f"Producto seleccionado no encontrado (id {pid})"
            if not elegido.activo:
                return None, f"El producto {elegido.nombre} no está activo"
            if elegido.categoria != producto.categoria_seleccion:
                return None, (
                    f"{elegido.nombre} no pertenece a la categoría "
                    f"'{producto.categoria_seleccion}' requerida por {producto.nombre}"
                )
            seleccionados.append(elegido)

        return seleccionados, None

    # ---------- stock ----------

    @staticmethod
    def _validar_stock(producto, cantidad, seleccionados=None):
        """
        Devuelve (ok, mensaje_error).
        - Paquete mixto (requiere_seleccion): valida el stock de cada producto
          elegido; se descuenta `cantidad` unidades de cada uno, porque cada
          paquete lleva 1 de cada sabor elegido.
        - Insumos (ej. hamburguesa): valida cada insumo con su propia cantidad.
        - Producto normal: valida su propio stock_actual.
        """
        if producto.requiere_seleccion:
            for elegido in (seleccionados or []):
                if not hay_stock_suficiente(float(elegido.stock_actual), cantidad):
                    return False, f"Stock insuficiente de {elegido.nombre}: quedan {float(elegido.stock_actual)}"
            return True, None

        if producto.insumos_usados:
            for pi in producto.insumos_usados:
                if not pi.insumo:
                    continue
                necesaria = float(cantidad) * float(pi.cantidad)
                if not hay_stock_suficiente(float(pi.insumo.stock_actual), necesaria):
                    return False, f"Stock insuficiente de {pi.insumo.nombre}: quedan {float(pi.insumo.stock_actual)} {pi.insumo.unidad_medida}"
            return True, None

        if not hay_stock_suficiente(float(producto.stock_actual), cantidad):
            return False, f"Stock insuficiente: quedan {float(producto.stock_actual)} de {producto.nombre}"
        return True, None

    @staticmethod
    def _aplicar_venta(producto, cantidad, trabajadora_id, venta_id, seleccionados=None):
        """
        Descuenta el stock correspondiente:
        - Paquete mixto: 1 unidad de cada producto elegido x `cantidad`
          paquetes vendidos, y guarda la elección en VentaSeleccion (para
          poder mostrarla y revertirla después).
        - Insumos: cada insumo según su propia cantidad por unidad.
        - Producto normal: producto.stock_actual como siempre.
        """
        if producto.requiere_seleccion:
            for elegido in (seleccionados or []):
                elegido.stock_actual = float(elegido.stock_actual) - float(cantidad)

                db.session.add(MovimientoInventario(
                    producto_id=elegido.id,
                    trabajadora_id=trabajadora_id,
                    venta_id=venta_id,
                    tipo="salida",
                    motivo="venta",
                    cantidad=cantidad,
                ))
                db.session.add(VentaSeleccion(
                    venta_id=venta_id,
                    producto_id=elegido.id,
                ))
            return

        if producto.insumos_usados:
            for pi in producto.insumos_usados:
                if not pi.insumo:
                    continue
                necesaria = float(cantidad) * float(pi.cantidad)
                pi.insumo.stock_actual = float(pi.insumo.stock_actual) - necesaria

                db.session.add(MovimientoInsumo(
                    insumo_id=pi.insumo.id,
                    trabajadora_id=trabajadora_id,
                    venta_id=venta_id,
                    tipo="salida",
                    motivo="venta",
                    cantidad=necesaria,
                ))
            return

        producto.stock_actual = float(producto.stock_actual) - float(cantidad)

        db.session.add(MovimientoInventario(
            producto_id=producto.id,
            trabajadora_id=trabajadora_id,
            venta_id=venta_id,
            tipo="salida",
            motivo="venta",
            cantidad=cantidad,
        ))

    @staticmethod
    def _revertir_venta(venta):
        """
        Revierte el efecto de una venta ya aplicada, sin importar si en su
        momento descontó insumos, un paquete mixto (dos productos) o el stock
        propio del producto - consulta TODOS los movimientos ligados a esta
        venta (puede haber más de uno) y los deshace. Las filas de
        VentaSeleccion se eliminan solas por el cascade del modelo cuando se
        borra la venta o se reasigna venta.selecciones.
        """
        movimientos_insumo = MovimientoInsumo.query.filter_by(venta_id=venta.id, motivo="venta").all()
        for m in movimientos_insumo:
            m.insumo.stock_actual = float(m.insumo.stock_actual) + float(m.cantidad)
            db.session.delete(m)

        movimientos_producto = MovimientoInventario.query.filter_by(venta_id=venta.id, motivo="venta").all()
        for m in movimientos_producto:
            producto_stock = Producto.query.get(m.producto_id)
            if producto_stock:
                producto_stock.stock_actual = float(producto_stock.stock_actual) + float(m.cantidad)
            db.session.delete(m)

    @staticmethod
    def crear(data):
        producto = Producto.query.get(data["producto_id"])
        if not producto:
            return None, "Producto no encontrado"

        cantidad = float(data["cantidad"])

        seleccionados, error = VentaService._validar_seleccion(producto, data.get("seleccion"))
        if error:
            return None, error

        ok, error = VentaService._validar_stock(producto, cantidad, seleccionados)
        if not ok:
            return None, error

        try:
            fecha_personalizada = _resolver_fecha(data)
        except ValueError:
            return None, "Formato de fecha inválido, usa YYYY-MM-DD"

        total = float(producto.precio_unitario) * cantidad

        venta = Venta(
            producto_id=producto.id,
            trabajadora_id=data["trabajadora_id"],
            cantidad=cantidad,
            precio_unitario=producto.precio_unitario,
            total=total,
            metodo_pago=data["metodo_pago"],
        )
        if fecha_personalizada:
            venta.fecha = fecha_personalizada

        db.session.add(venta)
        db.session.flush()

        VentaService._aplicar_venta(producto, cantidad, data["trabajadora_id"], venta.id, seleccionados)

        db.session.commit()
        return venta, None

    @staticmethod
    def actualizar(venta_id, data):
        venta = Venta.query.get(venta_id)
        if not venta:
            return None, "Venta no encontrada"

        nuevo_producto_id = data.get("producto_id", venta.producto_id)
        nueva_cantidad = float(data.get("cantidad", float(venta.cantidad)))

        producto_nuevo = Producto.query.get(nuevo_producto_id)
        if not producto_nuevo:
            return None, "Producto no encontrado"

        # Si el producto (nuevo o el mismo de antes) requiere selección:
        # si el payload trae 'seleccion', se usa esa; si no vino y es el
        # mismo producto de siempre (solo se editó la cantidad), se
        # reutiliza la selección que ya tenía guardada esta venta.
        if producto_nuevo.requiere_seleccion:
            seleccion_ids = data.get("seleccion")
            if seleccion_ids is None and producto_nuevo.id == venta.producto_id:
                seleccion_ids = [s.producto_id for s in venta.selecciones]
        else:
            seleccion_ids = None

        seleccionados, error = VentaService._validar_seleccion(producto_nuevo, seleccion_ids)
        if error:
            return None, error

        # revertimos el efecto de la venta original primero (insumos,
        # selección de paquete mixto, o producto normal), así el stock
        # queda "limpio" antes de validar y aplicar lo nuevo
        VentaService._revertir_venta(venta)

        ok, error = VentaService._validar_stock(producto_nuevo, nueva_cantidad, seleccionados)
        if not ok:
            db.session.rollback()
            return None, error

        venta.producto_id = nuevo_producto_id
        venta.trabajadora_id = data.get("trabajadora_id", venta.trabajadora_id)
        venta.cantidad = nueva_cantidad
        venta.precio_unitario = producto_nuevo.precio_unitario
        venta.total = float(producto_nuevo.precio_unitario) * nueva_cantidad
        venta.metodo_pago = data.get("metodo_pago", venta.metodo_pago)
        venta.editado = True

        # las selecciones viejas de esta venta ya no aplican (cambió el
        # producto o los sabores elegidos); se limpian antes de aplicar
        # las nuevas para no chocar con la restricción de unicidad
        venta.selecciones = []
        db.session.flush()

        VentaService._aplicar_venta(producto_nuevo, nueva_cantidad, venta.trabajadora_id, venta.id, seleccionados)

        db.session.commit()
        return venta, None

    @staticmethod
    def eliminar(venta_id):
        venta = Venta.query.get(venta_id)
        if not venta:
            return False, "Venta no encontrada"

        VentaService._revertir_venta(venta)

        db.session.delete(venta)
        db.session.commit()
        return True, None