from datetime import datetime, date
from app import db
from app.domain.salario import calcular_horas_trabajadas
from werkzeug.security import generate_password_hash, check_password_hash

proveedor_productos = db.Table(
    "proveedor_productos",
    db.Column("proveedor_id", db.Integer, db.ForeignKey("proveedores.id"), primary_key=True),
    db.Column("producto_id", db.Integer, db.ForeignKey("productos.id"), primary_key=True),
)

proveedor_insumos = db.Table(
    "proveedor_insumos",
    db.Column("proveedor_id", db.Integer, db.ForeignKey("proveedores.id"), primary_key=True),
    db.Column("insumo_id", db.Integer, db.ForeignKey("insumos.id"), primary_key=True),
)

class Producto(db.Model):
    __tablename__ = "productos"
 
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    categoria = db.Column(db.String(50), nullable=True)
    precio_unitario = db.Column(db.Numeric(10, 2), nullable=False)
    stock_actual = db.Column(db.Numeric(10, 3), nullable=False, default=0)
    stock_minimo = db.Column(db.Numeric(10, 3), nullable=False, default=5)
    es_paquete = db.Column(db.Boolean, nullable=False, default=False)
    producto_base_id = db.Column(db.Integer, db.ForeignKey("productos.id"), nullable=True)
    unidades_por_paquete = db.Column(db.Integer, nullable=True)
 
    # Columna vieja de la versión "un solo insumo" — ya no se usa en el
    # código, se deja en la base de datos sin tocar por seguridad.
    insumo_id = db.Column(db.Integer, db.ForeignKey("insumos.id"), nullable=True)

    # NUEVO — paquete "mixto": la trabajadora elige N productos de una
    # categoría al momento de vender (ej. "Paquete de empanadas mixta" ->
    # 2 sabores distintos de categoria "empanadas"). No confundir con
    # es_paquete/producto_base_id (paquete de UN solo sabor multiplicado)
    # ni con insumos_usados (receta fija de insumos, no de productos).
    requiere_seleccion = db.Column(db.Boolean, nullable=False, default=False)
    categoria_seleccion = db.Column(db.String(50), nullable=True)
    cantidad_seleccion = db.Column(db.Integer, nullable=True)
    cantidad_por_seleccion = db.Column(db.Integer, nullable=True, default=1)
 
    activo = db.Column(db.Boolean, nullable=False, default=True)
    creado_en = db.Column(db.DateTime, default=datetime.utcnow)
 
    ventas = db.relationship("Venta", back_populates="producto")
    movimientos = db.relationship("MovimientoInventario", back_populates="producto")
    proveedores = db.relationship("Proveedor", secondary=proveedor_productos, back_populates="productos")
    receta = db.relationship("Receta", back_populates="producto", uselist=False)
    producto_base = db.relationship("Producto", remote_side=[id], backref="paquetes")
 
    # varios insumos que se descuentan al vender este producto,
    # cada uno con su propia cantidad (ej. hamburguesa -> pan x1, carne x1, queso x1)
    insumos_usados = db.relationship(
        "ProductoInsumo",
        back_populates="producto",
        cascade="all, delete-orphan",
        order_by="ProductoInsumo.id",
    )
 
    def to_dict(self):
        stock_mostrado = float(self.stock_actual)
 
        if self.requiere_seleccion:
            # El stock real lo determinan los productos que se elijan al vender
            # (ej. los 2 sabores de empanada), no este producto en sí. Se muestra
            # siempre disponible aquí; el backend valida el stock real de cada
            # sabor elegido al confirmar la venta.
            stock_mostrado = 9999.0

        elif self.es_paquete and self.producto_base and self.unidades_por_paquete:
            stock_mostrado = float(int(float(self.producto_base.stock_actual) // self.unidades_por_paquete))
 
        elif self.insumos_usados:
            # El stock "disponible" de un producto con varios insumos es el
            # que permite el insumo más limitante (el que primero se acaba).
            # Ej: si hay pan para 10 hamburguesas pero carne para solo 4,
            # el stock mostrado de la hamburguesa es 4.
            posibles = []
            for pi in self.insumos_usados:
                if not pi.insumo or float(pi.cantidad) <= 0:
                    continue
                posibles.append(int(float(pi.insumo.stock_actual) // float(pi.cantidad)))
            if posibles:
                stock_mostrado = float(min(posibles))
 
        return {
                "id": self.id,
                "nombre": self.nombre,
                "categoria": self.categoria,
                "precio_unitario": float(self.precio_unitario),
                "stock_actual": stock_mostrado,
                "stock_minimo": float(self.stock_minimo),
                "es_paquete": self.es_paquete,
                "producto_base_id": self.producto_base_id,
                "producto_base_nombre": self.producto_base.nombre if self.producto_base else None,
                "unidades_por_paquete": self.unidades_por_paquete,
                "insumos": [pi.to_dict() for pi in self.insumos_usados],
                # NUEVO — paquete mixto
                "requiere_seleccion": self.requiere_seleccion,
                "categoria_seleccion": self.categoria_seleccion,
                "cantidad_seleccion": self.cantidad_seleccion,
                "cantidad_por_seleccion": self.cantidad_por_seleccion,
                "activo": self.activo,
        }
 
    def __repr__(self):
        return f"<Producto {self.nombre}>"


class Trabajadora(db.Model):
    __tablename__ = "trabajadoras"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    tipo_pago = db.Column(db.String(10), nullable=False, default="hora")  # "hora" o "mensual"
    valor_hora = db.Column(db.Numeric(10, 2), nullable=True)
    salario_mensual = db.Column(db.Numeric(10, 2), nullable=True)
    codigo_hash = db.Column(db.String(255), nullable=True)
    activa = db.Column(db.Boolean, nullable=False, default=True)
    incluye_nomina = db.Column(db.Boolean, nullable=False, default=True)
    creado_en = db.Column(db.DateTime, default=datetime.utcnow)

    ventas = db.relationship("Venta", back_populates="trabajadora")
    movimientos = db.relationship("MovimientoInventario", back_populates="trabajadora")
    turnos = db.relationship("Horario", back_populates="trabajadora")

    def set_codigo(self, codigo):
        self.codigo_hash = generate_password_hash(str(codigo))

    def check_codigo(self, codigo):
        if not self.codigo_hash or not codigo:
            return False
        return check_password_hash(self.codigo_hash, str(codigo))

    def to_dict(self):
        return {
                "id": self.id,
                "nombre": self.nombre,
                "tipo_pago": self.tipo_pago,
                "valor_hora": float(self.valor_hora) if self.valor_hora is not None else None,
                "salario_mensual": float(self.salario_mensual) if self.salario_mensual is not None else None,
                "tiene_codigo": self.codigo_hash is not None,
                "activa": self.activa,
                "incluye_nomina": self.incluye_nomina,
        }

    def __repr__(self):
        return f"<Trabajadora {self.nombre}>"

class PagoSalario(db.Model):
    __tablename__ = "pagos_salario"

    id = db.Column(db.Integer, primary_key=True)
    trabajadora_id = db.Column(db.Integer, db.ForeignKey("trabajadoras.id"), nullable=False)
    periodo_desde = db.Column(db.Date, nullable=False)
    periodo_hasta = db.Column(db.Date, nullable=False)
    monto = db.Column(db.Numeric(10, 2), nullable=False)
    fecha_pago = db.Column(db.DateTime, default=datetime.utcnow)

    trabajadora = db.relationship("Trabajadora")

    def to_dict(self):
        return {
            "id": self.id,
            "trabajadora_id": self.trabajadora_id,
            "periodo_desde": self.periodo_desde.isoformat(),
            "periodo_hasta": self.periodo_hasta.isoformat(),
            "monto": float(self.monto),
            "fecha_pago": self.fecha_pago.isoformat() + "Z",
        }

    def __repr__(self):
        return f"<PagoSalario {self.trabajadora_id} - {self.periodo_desde}:{self.periodo_hasta}>"


class Cliente(db.Model):
    __tablename__ = "clientes"

    id = db.Column(db.Integer, primary_key=True)
    tipo = db.Column(db.String(10), nullable=False)
    nombre = db.Column(db.String(150), nullable=False)
    documento = db.Column(db.String(30), nullable=False, unique=True)
    contacto = db.Column(db.String(100), nullable=True)
    celular = db.Column(db.String(20), nullable=True)
    direccion = db.Column(db.String(200), nullable=True)
    es_predeterminado = db.Column(db.Boolean, nullable=False, default=False)
    sin_costo = db.Column(db.Boolean, nullable=False, default=False)  # NUEVO
    activo = db.Column(db.Boolean, nullable=False, default=True)
    creado_en = db.Column(db.DateTime, default=datetime.utcnow)

    ordenes = db.relationship("Orden", back_populates="cliente")
    precios_especiales = db.relationship("PrecioEspecial", backref="cliente_rel", overlaps="cliente")

    def to_dict(self):
        return {
            "id": self.id,
            "tipo": self.tipo,
            "nombre": self.nombre,
            "documento": self.documento,
            "contacto": self.contacto,
            "celular": self.celular,
            "direccion": self.direccion,
            "es_predeterminado": self.es_predeterminado,
            "sin_costo": self.sin_costo,  # NUEVO
            "activo": self.activo,
        }

    def __repr__(self):
        return f"<Cliente {self.nombre}>"

class PrecioEspecial(db.Model):
    __tablename__ = "precios_especiales"

    id = db.Column(db.Integer, primary_key=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey("clientes.id"), nullable=False)
    producto_id = db.Column(db.Integer, db.ForeignKey("productos.id"), nullable=False)
    precio = db.Column(db.Numeric(10, 2), nullable=False)
    creado_en = db.Column(db.DateTime, default=datetime.utcnow)

    cliente = db.relationship("Cliente")
    producto = db.relationship("Producto")

    __table_args__ = (
        db.UniqueConstraint("cliente_id", "producto_id", name="uq_precio_especial_cliente_producto"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "cliente_id": self.cliente_id,
            "producto_id": self.producto_id,
            "producto_nombre": self.producto.nombre if self.producto else None,
            "precio_normal": float(self.producto.precio_unitario) if self.producto else None,
            "precio": float(self.precio),
        }

    def __repr__(self):
        return f"<PrecioEspecial cliente={self.cliente_id} producto={self.producto_id}>"


class Orden(db.Model):
    __tablename__ = "ordenes"

    id = db.Column(db.Integer, primary_key=True)
    trabajadora_id = db.Column(db.Integer, db.ForeignKey("trabajadoras.id"), nullable=False)
    cliente_id = db.Column(db.Integer, db.ForeignKey("clientes.id"), nullable=True)
    metodo_pago = db.Column(db.String(30), nullable=False)
    total = db.Column(db.Numeric(10, 2), nullable=False)
    descripcion = db.Column(db.Text, nullable=True)
    pagada = db.Column(db.Boolean, nullable=False, default=True)
    fecha = db.Column(db.DateTime, default=datetime.utcnow)
    editado = db.Column(db.Boolean, nullable=False, default=False)

    trabajadora = db.relationship("Trabajadora")
    cliente = db.relationship("Cliente", back_populates="ordenes")
    ventas = db.relationship("Venta", back_populates="orden", order_by="Venta.id")

    def to_dict(self):
        return {
            "id": self.id,
            "trabajadora_id": self.trabajadora_id,
            "trabajadora_nombre": self.trabajadora.nombre if self.trabajadora else None,
            "cliente_id": self.cliente_id,
            "cliente_nombre": self.cliente.nombre if self.cliente else None,
            "cliente_tipo": self.cliente.tipo if self.cliente else None,
            "cliente_documento": self.cliente.documento if self.cliente else None,
            "cliente_celular": self.cliente.celular if self.cliente else None,
            "cliente_direccion": self.cliente.direccion if self.cliente else None,
            "cliente_es_predeterminado": self.cliente.es_predeterminado if self.cliente else False,
            "metodo_pago": self.metodo_pago,
            "total": float(self.total),
            "descripcion": self.descripcion,
            "pagada": self.pagada,
            "fecha": self.fecha.isoformat() + "Z",
            "editado": self.editado,
            "ventas": [v.to_dict() for v in self.ventas],
        }

    def __repr__(self):
        return f"<Orden {self.id} - {self.trabajadora_id}>"

class Venta(db.Model):
    __tablename__ = "ventas"

    id = db.Column(db.Integer, primary_key=True)
    producto_id = db.Column(db.Integer, db.ForeignKey("productos.id"), nullable=False)
    trabajadora_id = db.Column(db.Integer, db.ForeignKey("trabajadoras.id"), nullable=False)
    cantidad = db.Column(db.Numeric(10, 3), nullable=False)
    precio_unitario = db.Column(db.Numeric(10, 2), nullable=False)
    total = db.Column(db.Numeric(10, 2), nullable=False)
    metodo_pago = db.Column(db.String(30), nullable=False)
    fecha = db.Column(db.DateTime, default=datetime.utcnow)
    editado = db.Column(db.Boolean, nullable=False, default=False)
    orden_id = db.Column(db.Integer, db.ForeignKey("ordenes.id"), nullable=True)

    producto = db.relationship("Producto", back_populates="ventas")
    trabajadora = db.relationship("Trabajadora", back_populates="ventas")
    movimientos_producto = db.relationship(
        "MovimientoInventario",
        back_populates="venta",
        order_by="MovimientoInventario.id",
    )
    orden = db.relationship("Orden", back_populates="ventas")

    # NUEVO — para paquetes mixtos: qué productos se eligieron en esta venta
    selecciones = db.relationship(
        "VentaSeleccion",
        back_populates="venta",
        cascade="all, delete-orphan",
        order_by="VentaSeleccion.id",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "producto_id": self.producto_id,
            "producto_nombre": self.producto.nombre if self.producto else None,
            "trabajadora_id": self.trabajadora_id,
            "trabajadora_nombre": self.trabajadora.nombre if self.trabajadora else None,
            "cantidad": float(self.cantidad),
            "precio_unitario": float(self.precio_unitario),
            "total": float(self.total),
            "metodo_pago": self.metodo_pago,
            "fecha": self.fecha.isoformat() + "Z",
            "editado": self.editado,
            "orden_id": self.orden_id,
            # NUEVO
            "selecciones": [s.to_dict() for s in self.selecciones],
        }

    def __repr__(self):
        return f"<Venta {self.id} - {self.producto_id}>"


class MovimientoInventario(db.Model):
    __tablename__ = "movimientos_inventario"

    id = db.Column(db.Integer, primary_key=True)
    producto_id = db.Column(db.Integer, db.ForeignKey("productos.id"), nullable=False)
    trabajadora_id = db.Column(db.Integer, db.ForeignKey("trabajadoras.id"), nullable=True)
    venta_id = db.Column(db.Integer, db.ForeignKey("ventas.id"), nullable=True)
    tipo = db.Column(db.String(20), nullable=False)
    motivo = db.Column(db.String(50), nullable=False)
    cantidad = db.Column(db.Numeric(10, 3), nullable=False)
    fecha = db.Column(db.DateTime, default=datetime.utcnow)

    producto = db.relationship("Producto", back_populates="movimientos")
    trabajadora = db.relationship("Trabajadora", back_populates="movimientos")
    venta = db.relationship("Venta", back_populates="movimientos_producto")

    def to_dict(self):
        return {
            "id": self.id,
            "producto_id": self.producto_id,
            "trabajadora_id": self.trabajadora_id,
            "venta_id": self.venta_id,
            "tipo": self.tipo,
            "motivo": self.motivo,
            "cantidad": float(self.cantidad),
            "fecha": self.fecha.isoformat() + "Z",
        }

    def __repr__(self):
        return f"<MovimientoInventario {self.tipo} - {self.producto_id}>"


class Proveedor(db.Model):
    __tablename__ = "proveedores"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    celular = db.Column(db.String(20), nullable=False)
    notas = db.Column(db.Text, nullable=True)

    productos = db.relationship("Producto", secondary=proveedor_productos, back_populates="proveedores")
    insumos = db.relationship("Insumo", secondary=proveedor_insumos, back_populates="proveedores")

    def to_dict(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "celular": self.celular,
            "notas": self.notas,
            "productos": [{"id": p.id, "nombre": p.nombre} for p in self.productos],
            "insumos": [{"id": i.id, "nombre": i.nombre} for i in self.insumos],
        }

    def __repr__(self):
        return f"<Proveedor {self.nombre}>"


class Horario(db.Model):
    __tablename__ = "horarios"

    id = db.Column(db.Integer, primary_key=True)
    trabajadora_id = db.Column(db.Integer, db.ForeignKey("trabajadoras.id"), nullable=False)
    fecha = db.Column(db.Date, default=date.today)
    hora_entrada = db.Column(db.DateTime, nullable=True)
    hora_salida = db.Column(db.DateTime, nullable=True)

    trabajadora = db.relationship("Trabajadora", back_populates="turnos")

    def to_dict(self):
        return {
            "id": self.id,
            "trabajadora_id": self.trabajadora_id,
            "trabajadora_nombre": self.trabajadora.nombre if self.trabajadora else None,
            "fecha": self.fecha.isoformat(),
            "hora_entrada": self.hora_entrada.isoformat() + "Z" if self.hora_entrada else None,
            "hora_salida": self.hora_salida.isoformat() + "Z" if self.hora_salida else None,
            "horas_trabajadas": calcular_horas_trabajadas(self.hora_entrada, self.hora_salida),
        }

    def __repr__(self):
        return f"<Horario {self.trabajadora_id} - {self.fecha}>"


class Receta(db.Model):
    __tablename__ = "recetas"

    id = db.Column(db.Integer, primary_key=True)
    producto_id = db.Column(db.Integer, db.ForeignKey("productos.id"), nullable=True, unique=True)
    nombre = db.Column(db.String(150), nullable=True)  # NUEVO — solo se usa si no hay producto_id

    producto = db.relationship("Producto", back_populates="receta")
    ingredientes = db.relationship("RecetaIngrediente", back_populates="receta", cascade="all, delete-orphan")

    __table_args__ = (
        db.CheckConstraint("producto_id IS NOT NULL OR nombre IS NOT NULL", name="ck_receta_producto_o_nombre"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "producto_id": self.producto_id,
            "nombre": self.producto.nombre if self.producto else self.nombre,
            "es_standalone": self.producto_id is None,
            "ingredientes": [i.to_dict() for i in self.ingredientes],
        }

    def __repr__(self):
        return f"<Receta {self.producto_id or self.nombre}>"

class RecetaIngrediente(db.Model):
    __tablename__ = "receta_ingredientes"

    id = db.Column(db.Integer, primary_key=True)
    receta_id = db.Column(db.Integer, db.ForeignKey("recetas.id"), nullable=False)
    nombre_ingrediente = db.Column(db.String(100), nullable=False)
    cantidad = db.Column(db.Numeric(10, 2), nullable=False)
    unidad = db.Column(db.String(20), nullable=False)  # g, kg, ml, l, unidad, etc.

    receta = db.relationship("Receta", back_populates="ingredientes")

    def to_dict(self):
        return {
            "id": self.id,
            "nombre_ingrediente": self.nombre_ingrediente,
            "cantidad": float(self.cantidad),
            "unidad": self.unidad,
        }

    def __repr__(self):
        return f"<RecetaIngrediente {self.nombre_ingrediente}>"


class IngresoEgreso(db.Model):
    __tablename__ = "ingresos_egresos"

    id = db.Column(db.Integer, primary_key=True)
    tipo = db.Column(db.String(10), nullable=False)  # "ingreso" o "egreso"
    monto = db.Column(db.Numeric(10, 2), nullable=False)
    descripcion = db.Column(db.String(200), nullable=False)
    metodo_pago = db.Column(db.String(30), nullable=True)
    proveedor_id = db.Column(db.Integer, db.ForeignKey("proveedores.id"), nullable=True)
    fecha = db.Column(db.DateTime, default=datetime.utcnow)

    proveedor = db.relationship("Proveedor")

    # Un egreso puede generar varias entradas de inventario (una factura
    # con gaseosas + carne molida, por ejemplo). Cada una queda como una
    # fila en IngresoEgresoDetalleInventario.
    detalles_inventario = db.relationship(
        "IngresoEgresoDetalleInventario",
        back_populates="ingreso_egreso",
        cascade="all, delete-orphan",
        order_by="IngresoEgresoDetalleInventario.id",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "tipo": self.tipo,
            "monto": float(self.monto),
            "descripcion": self.descripcion,
            "metodo_pago": self.metodo_pago,
            "proveedor_id": self.proveedor_id,
            "proveedor_nombre": self.proveedor.nombre if self.proveedor else None,
            "fecha": self.fecha.isoformat() + "Z",
            "entradas_inventario": [d.to_dict() for d in self.detalles_inventario],
        }

    def __repr__(self):
        return f"<IngresoEgreso {self.tipo} - {self.monto}>"


class IngresoEgresoDetalleInventario(db.Model):
    """Vincula un ingreso/egreso con UN movimiento de inventario (de
    producto o de insumo, nunca ambos). Un mismo egreso puede tener
    varias filas — una por cada producto/insumo comprado en esa factura."""
    __tablename__ = "ingreso_egreso_detalles_inventario"

    id = db.Column(db.Integer, primary_key=True)
    ingreso_egreso_id = db.Column(db.Integer, db.ForeignKey("ingresos_egresos.id"), nullable=False)
    movimiento_inventario_id = db.Column(db.Integer, db.ForeignKey("movimientos_inventario.id"), nullable=True)
    movimiento_insumo_id = db.Column(db.Integer, db.ForeignKey("movimientos_insumo.id"), nullable=True)

    ingreso_egreso = db.relationship("IngresoEgreso", back_populates="detalles_inventario")
    movimiento_inventario = db.relationship("MovimientoInventario")
    movimiento_insumo = db.relationship("MovimientoInsumo")

    def to_dict(self):
        if self.movimiento_inventario:
            mov = self.movimiento_inventario
            return {
                "id": self.id,
                "tipo": "producto",
                "item_id": mov.producto_id,
                "item_nombre": mov.producto.nombre if mov.producto else None,
                "cantidad": float(mov.cantidad),
                "unidad_medida": None,
            }

        if self.movimiento_insumo:
            mov = self.movimiento_insumo
            return {
                "id": self.id,
                "tipo": "insumo",
                "item_id": mov.insumo_id,
                "item_nombre": mov.insumo.nombre if mov.insumo else None,
                "cantidad": float(mov.cantidad),
                "unidad_medida": mov.insumo.unidad_medida if mov.insumo else None,
            }

        return {
            "id": self.id, "tipo": None, "item_id": None,
            "item_nombre": None, "cantidad": None, "unidad_medida": None,
        }

    def __repr__(self):
        return f"<IngresoEgresoDetalleInventario {self.id}>"


class Insumo(db.Model):
    __tablename__ = "insumos"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    categoria = db.Column(db.String(20), nullable=False, default="cocina")
    unidad_medida = db.Column(db.String(20), nullable=False, default="unidad")
    stock_actual = db.Column(db.Numeric(10, 3), nullable=False, default=0)
    stock_minimo = db.Column(db.Numeric(10, 3), nullable=False, default=5)
    activo = db.Column(db.Boolean, nullable=False, default=True)
    creado_en = db.Column(db.DateTime, default=datetime.utcnow)

    movimientos = db.relationship("MovimientoInsumo", back_populates="insumo")
    proveedores = db.relationship("Proveedor", secondary=proveedor_insumos, back_populates="insumos")

    def to_dict(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "categoria": self.categoria,
            "unidad_medida": self.unidad_medida,
            "stock_actual": float(self.stock_actual),
            "stock_minimo": float(self.stock_minimo),
            "activo": self.activo,
        }

    def __repr__(self):
        return f"<Insumo {self.nombre}>"

class ProductoInsumo(db.Model):
    __tablename__ = "producto_insumos"
 
    id = db.Column(db.Integer, primary_key=True)
    producto_id = db.Column(db.Integer, db.ForeignKey("productos.id"), nullable=False)
    insumo_id = db.Column(db.Integer, db.ForeignKey("insumos.id"), nullable=False)
    cantidad = db.Column(db.Numeric(10, 3), nullable=False, default=1)
 
    producto = db.relationship("Producto", back_populates="insumos_usados")
    insumo = db.relationship("Insumo")
 
    def to_dict(self):
        return {
            "id": self.id,
            "insumo_id": self.insumo_id,
            "insumo_nombre": self.insumo.nombre if self.insumo else None,
            "unidad_medida": self.insumo.unidad_medida if self.insumo else None,
            "cantidad": float(self.cantidad),
        }
 
    def __repr__(self):
        return f"<ProductoInsumo producto={self.producto_id} insumo={self.insumo_id}>"


class VentaSeleccion(db.Model):
    """Para paquetes 'mixtos' (ej. Paquete de empanadas mixta): registra qué
    productos concretos eligió la trabajadora al vender ESTA venta puntual.
    A diferencia de ProductoInsumo (receta fija por producto), aquí la
    elección se decide en el momento de cada venta."""
    __tablename__ = "venta_selecciones"

    id = db.Column(db.Integer, primary_key=True)
    venta_id = db.Column(db.Integer, db.ForeignKey("ventas.id", ondelete="CASCADE"), nullable=False)
    producto_id = db.Column(db.Integer, db.ForeignKey("productos.id"), nullable=False)

    venta = db.relationship("Venta", back_populates="selecciones")
    producto = db.relationship("Producto")

    __table_args__ = (
        db.UniqueConstraint("venta_id", "producto_id", name="uq_venta_seleccion"),
    )

    def to_dict(self):
        return {
            "producto_id": self.producto_id,
            "producto_nombre": self.producto.nombre if self.producto else None,
        }

    def __repr__(self):
        return f"<VentaSeleccion venta={self.venta_id} producto={self.producto_id}>"


class MovimientoInsumo(db.Model):
    __tablename__ = "movimientos_insumo"

    id = db.Column(db.Integer, primary_key=True)
    insumo_id = db.Column(db.Integer, db.ForeignKey("insumos.id"), nullable=False)
    trabajadora_id = db.Column(db.Integer, db.ForeignKey("trabajadoras.id"), nullable=True)
    venta_id = db.Column(db.Integer, db.ForeignKey("ventas.id"), nullable=True)  # NUEVO
    tipo = db.Column(db.String(20), nullable=False)
    motivo = db.Column(db.String(50), nullable=False)
    cantidad = db.Column(db.Numeric(10, 3), nullable=False)
    fecha = db.Column(db.DateTime, default=datetime.utcnow)

    insumo = db.relationship("Insumo", back_populates="movimientos")
    trabajadora = db.relationship("Trabajadora")

    def to_dict(self):
        return {
            "id": self.id,
            "insumo_id": self.insumo_id,
            "insumo_nombre": self.insumo.nombre if self.insumo else None,
            "trabajadora_id": self.trabajadora_id,
            "trabajadora_nombre": self.trabajadora.nombre if self.trabajadora else None,
            "tipo": self.tipo,
            "motivo": self.motivo,
            "cantidad": float(self.cantidad),
            "fecha": self.fecha.isoformat() + "Z",
        }

    def __repr__(self):
        return f"<MovimientoInsumo {self.tipo} - {self.insumo_id}>"

class Usuario(db.Model):
    __tablename__ = "usuarios"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    rol = db.Column(db.String(20), nullable=False)  # "trabajadora" o "jefe"

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "rol": self.rol,
        }

    def __repr__(self):
        return f"<Usuario {self.username} - {self.rol}>"

class Nota(db.Model):
    __tablename__ = "notas"

    id = db.Column(db.Integer, primary_key=True)
    texto = db.Column(db.Text, nullable=False)

    trabajadora_creadora_id = db.Column(db.Integer, db.ForeignKey("trabajadoras.id"), nullable=True)
    creada_por_usuario_id = db.Column(db.Integer, db.ForeignKey("usuarios.id"), nullable=True)
    creada_en = db.Column(db.DateTime, default=datetime.utcnow)

    resuelta = db.Column(db.Boolean, nullable=False, default=False)
    trabajadora_resuelve_id = db.Column(db.Integer, db.ForeignKey("trabajadoras.id"), nullable=True)
    resuelta_por_usuario_id = db.Column(db.Integer, db.ForeignKey("usuarios.id"), nullable=True)
    resuelta_en = db.Column(db.DateTime, nullable=True)

    trabajadora_creadora = db.relationship("Trabajadora", foreign_keys=[trabajadora_creadora_id])
    trabajadora_resuelve = db.relationship("Trabajadora", foreign_keys=[trabajadora_resuelve_id])

    __table_args__ = (
        db.CheckConstraint(
            "trabajadora_creadora_id IS NOT NULL OR creada_por_usuario_id IS NOT NULL",
            name="ck_nota_autor",
        ),
    )

    def to_dict(self):
        if self.trabajadora_creadora:
            creada_por = self.trabajadora_creadora.nombre
        elif self.creada_por_usuario_id:
            creada_por = "Administrador"
        else:
            creada_por = None

        if self.trabajadora_resuelve:
            resuelta_por = self.trabajadora_resuelve.nombre
        elif self.resuelta_por_usuario_id:
            resuelta_por = "Administrador"
        else:
            resuelta_por = None

        return {
            "id": self.id,
            "texto": self.texto,
            "creada_por_nombre": creada_por,
            "creada_por_jefe": self.creada_por_usuario_id is not None,
            "creada_en": self.creada_en.isoformat() + "Z",
            "resuelta": self.resuelta,
            "resuelta_por_nombre": resuelta_por,
            "resuelta_en": self.resuelta_en.isoformat() + "Z" if self.resuelta_en else None,
        }

    def __repr__(self):
        return f"<Nota {self.id} - resuelta={self.resuelta}>"