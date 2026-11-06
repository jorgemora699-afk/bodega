import json
import re

import cloudinary
import cloudinary.uploader

from app import db
from app.infrastructure.models import Producto, CartaConfig

# Lee CLOUDINARY_URL del entorno
cloudinary.config(secure=True)

TIPOS_IMAGEN = {"image/jpeg", "image/png", "image/webp"}
MAX_BYTES = 5 * 1024 * 1024
ETIQUETAS = ("Nuevo", "Más pedido", "Promo")

LIMITES_TEXTO = {
    "nombre_negocio": 100,
    "bienvenida": 300,
    "horario": 200,
    "direccion": 200,
}


def _subir_imagen(archivo, carpeta, ancho):
    if not archivo or not archivo.filename:
        return None, "Envía una imagen"
    if archivo.mimetype not in TIPOS_IMAGEN:
        return None, "La imagen debe ser JPG, PNG o WEBP"

    archivo.seek(0, 2)
    tamano = archivo.tell()
    archivo.seek(0)
    if tamano > MAX_BYTES:
        return None, "La imagen no puede pesar más de 5 MB"

    try:
        resultado = cloudinary.uploader.upload(
            archivo,
            folder=f"carta/{carpeta}",
            resource_type="image",
            transformation=[
                {"width": ancho, "height": ancho, "crop": "limit"},
                {"quality": "auto", "fetch_format": "auto"},
            ],
        )
    except Exception:
        return None, "No se pudo subir la imagen. Intenta de nuevo"

    return resultado, None


def _borrar_imagen(public_id):
    if not public_id:
        return
    try:
        cloudinary.uploader.destroy(public_id)
    except Exception:
        pass  # si falla, la imagen queda huérfana en Cloudinary, sin afectar la carta


def _normalizar_whatsapp(valor):
    digitos = re.sub(r"\D", "", valor or "")
    if not digitos:
        return None, None
    if len(digitos) == 10 and digitos.startswith("3"):
        digitos = "57" + digitos  # celular colombiano sin indicativo
    if not 11 <= len(digitos) <= 15:
        return None, "El número de WhatsApp no es válido"
    return digitos, None


class CartaService:

    # ---------- configuración ----------

    @staticmethod
    def config():
        cfg = CartaConfig.query.first()
        if not cfg:
            cfg = CartaConfig(nombre_negocio="Punto Amarillo")
            db.session.add(cfg)
            db.session.commit()
        return cfg

    @staticmethod
    def _orden_categorias(cfg):
        return json.loads(cfg.orden_categorias) if cfg.orden_categorias else []

    @staticmethod
    def _ordenar_categorias(nombres, orden):
        return sorted(
            nombres,
            key=lambda c: (orden.index(c) if c in orden else len(orden), c.lower()),
        )

    @staticmethod
    def actualizar_config(data):
        cfg = CartaService.config()

        for campo, limite in LIMITES_TEXTO.items():
            if campo in data:
                texto = (data[campo] or "").strip()
                if len(texto) > limite:
                    return None, f"{campo} no puede superar {limite} caracteres"
                if campo == "nombre_negocio" and not texto:
                    return None, "El nombre del negocio es obligatorio"
                setattr(cfg, campo, texto or None)

        if "whatsapp" in data:
            numero, error = _normalizar_whatsapp(data["whatsapp"])
            if error:
                return None, error
            cfg.whatsapp = numero

        if "orden_categorias" in data:
            orden = data["orden_categorias"]
            if not isinstance(orden, list) or any(not isinstance(c, str) for c in orden):
                return None, "orden_categorias debe ser una lista de textos"
            cfg.orden_categorias = json.dumps(orden)

        db.session.commit()
        return cfg, None

    @staticmethod
    def subir_imagen_config(tipo, archivo):
        if tipo not in ("logo", "banner"):
            return None, "tipo debe ser 'logo' o 'banner'"

        cfg = CartaService.config()
        resultado, error = _subir_imagen(archivo, tipo, 1600 if tipo == "banner" else 600)
        if error:
            return None, error

        _borrar_imagen(getattr(cfg, f"{tipo}_public_id"))
        setattr(cfg, f"{tipo}_url", resultado["secure_url"])
        setattr(cfg, f"{tipo}_public_id", resultado["public_id"])
        db.session.commit()
        return cfg, None

    @staticmethod
    def quitar_imagen_config(tipo):
        if tipo not in ("logo", "banner"):
            return None, "tipo debe ser 'logo' o 'banner'"

        cfg = CartaService.config()
        _borrar_imagen(getattr(cfg, f"{tipo}_public_id"))
        setattr(cfg, f"{tipo}_url", None)
        setattr(cfg, f"{tipo}_public_id", None)
        db.session.commit()
        return cfg, None

    # ---------- productos ----------

    @staticmethod
    def _producto_admin(p):
        stock = p.to_dict()["stock_actual"]
        return {
            "id": p.id,
            "nombre": p.nombre,
            "categoria": p.categoria,
            "precio_unitario": float(p.precio_unitario),
            "agotado": (not p.requiere_seleccion) and stock <= 0,
            "carta_visible": p.carta_visible,
            "carta_descripcion": p.carta_descripcion,
            "carta_etiqueta": p.carta_etiqueta,
            "carta_orden": p.carta_orden,
            "carta_imagen_url": p.carta_imagen_url,
        }

    @staticmethod
    def actualizar_producto(producto_id, data):
        producto = Producto.query.get(producto_id)
        if not producto or not producto.activo:
            return None, "Producto no encontrado"

        if "carta_visible" in data:
            producto.carta_visible = bool(data["carta_visible"])

        if "carta_descripcion" in data:
            texto = (data["carta_descripcion"] or "").strip()
            if len(texto) > 300:
                return None, "La descripción no puede superar 300 caracteres"
            producto.carta_descripcion = texto or None

        if "carta_etiqueta" in data:
            etiqueta = data["carta_etiqueta"] or None
            if etiqueta is not None and etiqueta not in ETIQUETAS:
                return None, "Etiqueta no válida"
            producto.carta_etiqueta = etiqueta

        db.session.commit()
        return producto, None

    @staticmethod
    def ordenar_productos(ids):
        if not isinstance(ids, list) or any(not isinstance(i, int) for i in ids):
            return "ids debe ser una lista de números"

        for posicion, producto_id in enumerate(ids):
            Producto.query.filter_by(id=producto_id).update({"carta_orden": posicion})

        db.session.commit()
        return None

    @staticmethod
    def subir_imagen_producto(producto_id, archivo):
        producto = Producto.query.get(producto_id)
        if not producto or not producto.activo:
            return None, "Producto no encontrado"

        resultado, error = _subir_imagen(archivo, "productos", 1000)
        if error:
            return None, error

        _borrar_imagen(producto.carta_imagen_public_id)
        producto.carta_imagen_url = resultado["secure_url"]
        producto.carta_imagen_public_id = resultado["public_id"]
        db.session.commit()
        return producto, None

    @staticmethod
    def quitar_imagen_producto(producto_id):
        producto = Producto.query.get(producto_id)
        if not producto:
            return None, "Producto no encontrado"

        _borrar_imagen(producto.carta_imagen_public_id)
        producto.carta_imagen_url = None
        producto.carta_imagen_public_id = None
        db.session.commit()
        return producto, None

    # ---------- vistas ----------

    @staticmethod
    def vista_admin():
        cfg = CartaService.config()
        productos = (
            Producto.query.filter_by(activo=True)
            .order_by(Producto.carta_orden, Producto.nombre)
            .all()
        )

        nombres = {p.categoria or "Otros" for p in productos}
        categorias = CartaService._ordenar_categorias(nombres, CartaService._orden_categorias(cfg))

        return {
            "config": cfg.to_dict(),
            "categorias": categorias,
            "etiquetas": list(ETIQUETAS),
            "productos": [CartaService._producto_admin(p) for p in productos],
        }

    @staticmethod
    def carta_publica():
        """Solo lo que debe ver el cliente: sin stock, sin insumos, sin ids internos de inventario."""
        cfg = CartaService.config()
        productos = (
            Producto.query.filter_by(activo=True, carta_visible=True)
            .order_by(Producto.carta_orden, Producto.nombre)
            .all()
        )

        grupos = {}
        for p in productos:
            stock = p.to_dict()["stock_actual"]
            grupos.setdefault(p.categoria or "Otros", []).append({
                "id": p.id,
                "nombre": p.nombre,
                "precio": float(p.precio_unitario),
                "descripcion": p.carta_descripcion,
                "imagen_url": p.carta_imagen_url,
                "etiqueta": p.carta_etiqueta,
                "agotado": (not p.requiere_seleccion) and stock <= 0,
            })

        nombres = CartaService._ordenar_categorias(grupos.keys(), CartaService._orden_categorias(cfg))

        return {
            "negocio": cfg.to_dict(),
            "categorias": [{"nombre": c, "productos": grupos[c]} for c in nombres],
        }