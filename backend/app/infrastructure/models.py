from datetime import datetime, date
from app import db
from app.domain.salario import calcular_horas_trabajadas
from werkzeug.security import generate_password_hash, check_password_hash

proveedor_productos = db.Table(
    "proveedor_productos",
    db.Column("proveedor_id", db.Integer, db.ForeignKey("proveedores.id"), primary_key=True),
    db.Column("producto_id", db.Integer, db.ForeignKey("productos.id"), primary_key=True),
)

class Producto(db.Model):
    __tablename__ = "productos"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    categoria = db.Column(db.String(50), nullable=True)
    precio_unitario = db.Column(db.Numeric(10, 2), nullable=False)
    stock_actual = db.Column(db.Numeric(10, 3), nullable=False, default=0)
    activo = db.Column(db.Boolean, nullable=False, default=True)
    creado_en = db.Column(db.DateTime, default=datetime.utcnow)

    ventas = db.relationship("Venta", back_populates="producto")
    movimientos = db.relationship("MovimientoInventario", back_populates="producto")
    proveedores = db.relationship("Proveedor", secondary=proveedor_productos, back_populates="productos")
    receta = db.relationship("Receta", back_populates="producto", uselist=False)

    def to_dict(self):
        return {
                "id": self.id,
                "nombre": self.nombre,
                "categoria": self.categoria,
                "precio_unitario": float(self.precio_unitario),
                "stock_actual": float(self.stock_actual),
                "activo": self.activo,
        }

    def __repr__(self):
        return f"<Producto {self.nombre}>"


class Trabajadora(db.Model):
    __tablename__ = "trabajadoras"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    valor_hora = db.Column(db.Numeric(10, 2), nullable=True)
    activa = db.Column(db.Boolean, nullable=False, default=True)
    creado_en = db.Column(db.DateTime, default=datetime.utcnow)

    ventas = db.relationship("Venta", back_populates="trabajadora")
    movimientos = db.relationship("MovimientoInventario", back_populates="trabajadora")
    turnos = db.relationship("Horario", back_populates="trabajadora")

    def to_dict(self):
        return {
                "id": self.id,
                "nombre": self.nombre,
                "valor_hora": float(self.valor_hora) if self.valor_hora is not None else None,
                "activa": self.activa,
        }

    def __repr__(self):
        return f"<Trabajadora {self.nombre}>"

class Orden(db.Model):
    __tablename__ = "ordenes"

    id = db.Column(db.Integer, primary_key=True)
    trabajadora_id = db.Column(db.Integer, db.ForeignKey("trabajadoras.id"), nullable=False)
    metodo_pago = db.Column(db.String(30), nullable=False)
    total = db.Column(db.Numeric(10, 2), nullable=False)
    fecha = db.Column(db.DateTime, default=datetime.utcnow)
    editado = db.Column(db.Boolean, nullable=False, default=False)

    trabajadora = db.relationship("Trabajadora")
    ventas = db.relationship("Venta", back_populates="orden", order_by="Venta.id")

    def to_dict(self):
        return {
            "id": self.id,
            "trabajadora_id": self.trabajadora_id,
            "trabajadora_nombre": self.trabajadora.nombre if self.trabajadora else None,
            "metodo_pago": self.metodo_pago,
            "total": float(self.total),
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
    movimiento = db.relationship("MovimientoInventario", back_populates="venta", uselist=False)
    orden = db.relationship("Orden", back_populates="ventas")

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
    venta = db.relationship("Venta", back_populates="movimiento")

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

    def to_dict(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "celular": self.celular,
            "notas": self.notas,
            "productos": [{"id": p.id, "nombre": p.nombre} for p in self.productos],
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
    producto_id = db.Column(db.Integer, db.ForeignKey("productos.id"), nullable=False, unique=True)

    producto = db.relationship("Producto", back_populates="receta")
    ingredientes = db.relationship("RecetaIngrediente", back_populates="receta", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "producto_id": self.producto_id,
            "producto_nombre": self.producto.nombre if self.producto else None,
            "ingredientes": [i.to_dict() for i in self.ingredientes],
        }
    
    def __repr__(self):
        return f"<Receta {self.producto_id}>"


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
    proveedor_id = db.Column(db.Integer, db.ForeignKey("proveedores.id"), nullable=True)
    fecha = db.Column(db.DateTime, default=datetime.utcnow)

    proveedor = db.relationship("Proveedor")

    def to_dict(self):
        return {
            "id": self.id,
            "tipo": self.tipo,
            "monto": float(self.monto),
            "descripcion": self.descripcion,
            "proveedor_id": self.proveedor_id,
            "proveedor_nombre": self.proveedor.nombre if self.proveedor else None,
            "fecha": self.fecha.isoformat() + "Z",
        }

    def __repr__(self):
        return f"<IngresoEgreso {self.tipo} - {self.monto}>"

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