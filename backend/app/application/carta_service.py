import json
import re

import cloudinary
import cloudinary.uploader
from flask import current_app

from app import db
from app.infrastructure.models import Producto, CartaConfig, CartaCategoria

# Lee CLOUDINARY_URL del entorno
cloudinary.config(secure=True)

TIPOS_IMAGEN = {"image/jpeg", "image/png", "image/webp"}
MAX_BYTES = 5 * 1024 * 1024
ETIQUETAS = ("Nuevo", "Más pedido", "Promo")
LIMITE_NOMBRE_PRODUCTO = 100
LIMITE_NOMBRE_CATEGORIA = 60
LIMITE_GRUPO = 100
LIMITE_SABOR = 100

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
    except Exception as e:
        # el motivo real queda en los logs del servidor (Railway > Deployments > Logs)
        current_app.logger.exception("Cloudinary rechazó la subida: %s", e)
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


# Nombre y categoría tal como se ven en la carta: el cambio hecho en la carta
# (carta_nombre / carta_categoria) tiene prioridad, y si no hay, se usa el real.
# Así editar la carta nunca altera ventas, inventario ni reportes.
def _nombre_de(p):
    return p.carta_nombre or p.nombre


def _categoria_de(p):
    return p.carta_categoria or p.categoria or "Otros"


def _canonica(texto, existentes):
    """Si ya existe una categoría igual sin importar mayúsculas, usa esa escritura."""
    for nombre in existentes:
        if nombre.lower() == texto.lower():
            return nombre
    return texto


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
            "nombre": _nombre_de(p),
            "nombre_original": p.nombre,
            "categoria": _categoria_de(p),
            "categoria_original": p.categoria or "Otros",
            "precio_unitario": float(p.precio_unitario),
            "agotado": (not p.requiere_seleccion) and stock <= 0,
            "carta_visible": p.carta_visible,
            "carta_descripcion": p.carta_descripcion,
            "carta_etiqueta": p.carta_etiqueta,
            "carta_orden": p.carta_orden,
            "carta_grupo": p.carta_grupo,
            "carta_sabor": p.carta_sabor,
            "carta_imagen_url": p.carta_imagen_url,
        }

    @staticmethod
    def actualizar_producto(producto_id, data):
        producto = Producto.query.get(producto_id)
        if not producto or not producto.activo:
            return None, "Producto no encontrado"

        if "carta_visible" in data:
            producto.carta_visible = bool(data["carta_visible"])

        if "carta_nombre" in data:
            texto = (data["carta_nombre"] or "").strip()
            if len(texto) > LIMITE_NOMBRE_PRODUCTO:
                return None, f"El nombre no puede superar {LIMITE_NOMBRE_PRODUCTO} caracteres"
            # vacío o igual al real = volver al nombre original
            producto.carta_nombre = texto if texto and texto != producto.nombre else None

        if "carta_categoria" in data:
            texto = (data["carta_categoria"] or "").strip()
            if len(texto) > LIMITE_NOMBRE_CATEGORIA:
                return None, f"La categoría no puede superar {LIMITE_NOMBRE_CATEGORIA} caracteres"
            if texto:
                existentes = {_categoria_de(p) for p in Producto.query.filter_by(activo=True).all()}
                texto = _canonica(texto, existentes)
            producto.carta_categoria = (
                texto if texto and texto != (producto.categoria or "Otros") else None
            )

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

        if "carta_grupo" in data:
            texto = (data["carta_grupo"] or "").strip()
            if len(texto) > LIMITE_GRUPO:
                return None, f"El grupo no puede superar {LIMITE_GRUPO} caracteres"
            if texto:
                texto = _canonica(texto, CartaService._grupos_existentes())
            producto.carta_grupo = texto or None

        if "carta_sabor" in data:
            texto = (data["carta_sabor"] or "").strip()
            if len(texto) > LIMITE_SABOR:
                return None, f"El sabor no puede superar {LIMITE_SABOR} caracteres"
            producto.carta_sabor = texto or None

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

    @staticmethod
    def _grupos_existentes():
        return {p.carta_grupo for p in Producto.query.filter_by(activo=True).all() if p.carta_grupo}

    @staticmethod
    def agrupar_productos(grupo, items):
        """items: lista de {"id": int, "sabor": str}. Deja todos esos productos en el mismo grupo."""
        grupo = (grupo or "").strip()
        if not grupo:
            return "Escribe el nombre del grupo"
        if len(grupo) > LIMITE_GRUPO:
            return f"El grupo no puede superar {LIMITE_GRUPO} caracteres"
        if not isinstance(items, list) or len(items) < 2:
            return "Elige al menos 2 productos para formar un grupo"

        ids = []
        for it in items:
            if not isinstance(it, dict) or not isinstance(it.get("id"), int):
                return "items no válido"
            sabor = (it.get("sabor") or "").strip()
            if not sabor:
                return "Cada producto necesita un sabor"
            if len(sabor) > LIMITE_SABOR:
                return f"El sabor no puede superar {LIMITE_SABOR} caracteres"
            ids.append(it["id"])

        productos = {
            p.id: p
            for p in Producto.query.filter(Producto.id.in_(ids), Producto.activo.is_(True)).all()
        }
        if len(productos) != len(set(ids)):
            return "Producto no encontrado"

        grupo = _canonica(grupo, CartaService._grupos_existentes())
        for it in items:
            p = productos[it["id"]]
            p.carta_grupo = grupo
            p.carta_sabor = it["sabor"].strip()

        db.session.commit()
        return None

    @staticmethod
    def desagrupar(grupo):
        grupo = (grupo or "").strip()
        productos = Producto.query.filter_by(activo=True, carta_grupo=grupo).all()
        if not productos:
            return "Grupo no encontrado"
        for p in productos:
            p.carta_grupo = None
            p.carta_sabor = None
        db.session.commit()
        return None

    # ---------- categorías ----------

    @staticmethod
    def _existentes():
        return {_categoria_de(p) for p in Producto.query.filter_by(activo=True).all()}

    @staticmethod
    def _imagenes_categorias():
        return {c.nombre: c.imagen_url for c in CartaCategoria.query.all() if c.imagen_url}

    @staticmethod
    def renombrar_categoria(actual, nuevo):
        """Cambia el nombre de una categoría solo en la carta. Si el nuevo nombre ya
        existe, las dos categorías se unen."""
        actual = (actual or "").strip()
        nuevo = (nuevo or "").strip()
        if not actual or not nuevo:
            return None, "Escribe el nombre de la categoría"
        if len(nuevo) > LIMITE_NOMBRE_CATEGORIA:
            return None, f"El nombre no puede superar {LIMITE_NOMBRE_CATEGORIA} caracteres"

        productos = Producto.query.filter_by(activo=True).all()
        existentes = {_categoria_de(p) for p in productos}
        if actual not in existentes:
            return None, "Categoría no encontrada"

        nuevo = _canonica(nuevo, existentes - {actual})
        if nuevo == actual:
            return CartaService.vista_admin(), None

        for p in productos:
            if _categoria_de(p) == actual:
                p.carta_categoria = None if nuevo == (p.categoria or "Otros") else nuevo

        # el orden de categorías sigue al nombre nuevo
        cfg = CartaService.config()
        orden = []
        for nombre in CartaService._orden_categorias(cfg):
            nombre = nuevo if nombre == actual else nombre
            if nombre not in orden:
                orden.append(nombre)
        cfg.orden_categorias = json.dumps(orden)

        # la imagen sigue al nombre; si se unen dos categorías, gana la que ya tenía foto
        origen = CartaCategoria.query.filter_by(nombre=actual).first()
        destino = CartaCategoria.query.filter_by(nombre=nuevo).first()
        if origen:
            if not destino:
                origen.nombre = nuevo
            else:
                if not destino.imagen_url and origen.imagen_url:
                    destino.imagen_url = origen.imagen_url
                    destino.imagen_public_id = origen.imagen_public_id
                else:
                    _borrar_imagen(origen.imagen_public_id)
                db.session.delete(origen)

        db.session.commit()
        return CartaService.vista_admin(), None

    @staticmethod
    def subir_imagen_categoria(nombre, archivo):
        nombre = (nombre or "").strip()
        if nombre not in CartaService._existentes():
            return None, "Categoría no encontrada"

        resultado, error = _subir_imagen(archivo, "categorias", 1000)
        if error:
            return None, error

        fila = CartaCategoria.query.filter_by(nombre=nombre).first()
        if not fila:
            fila = CartaCategoria(nombre=nombre)
            db.session.add(fila)
        else:
            _borrar_imagen(fila.imagen_public_id)

        fila.imagen_url = resultado["secure_url"]
        fila.imagen_public_id = resultado["public_id"]
        db.session.commit()
        return CartaService.vista_admin(), None

    @staticmethod
    def quitar_imagen_categoria(nombre):
        nombre = (nombre or "").strip()
        fila = CartaCategoria.query.filter_by(nombre=nombre).first()
        if fila:
            _borrar_imagen(fila.imagen_public_id)
            db.session.delete(fila)
            db.session.commit()
        return CartaService.vista_admin(), None

    # ---------- vistas ----------

    @staticmethod
    def vista_admin():
        cfg = CartaService.config()
        productos = (
            Producto.query.filter_by(activo=True)
            .order_by(Producto.carta_orden, Producto.nombre)
            .all()
        )

        nombres = {_categoria_de(p) for p in productos}
        categorias = CartaService._ordenar_categorias(nombres, CartaService._orden_categorias(cfg))
        imagenes = CartaService._imagenes_categorias()

        return {
            "config": cfg.to_dict(),
            "categorias": [{"nombre": c, "imagen_url": imagenes.get(c)} for c in categorias],
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

        elementos = {}  # categoría -> tarjetas (producto suelto o grupo con sabores)
        grupos = {}     # (categoría, grupo) -> tarjeta del grupo, para ir sumándole sabores

        for p in productos:
            categoria = _categoria_de(p)
            stock = p.to_dict()["stock_actual"]
            agotado = (not p.requiere_seleccion) and stock <= 0
            precio = float(p.precio_unitario)
            tarjetas = elementos.setdefault(categoria, [])

            if not p.carta_grupo:
                tarjetas.append({
                    "id": p.id,
                    "nombre": _nombre_de(p),
                    "precio": precio,
                    "descripcion": p.carta_descripcion,
                    "imagen_url": p.carta_imagen_url,
                    "etiqueta": p.carta_etiqueta,
                    "agotado": agotado,
                })
                continue

            llave = (categoria, p.carta_grupo)
            tarjeta = grupos.get(llave)
            if not tarjeta:
                tarjeta = {
                    "id": f"grupo:{categoria}:{p.carta_grupo}",
                    "nombre": p.carta_grupo,
                    "precio": precio,
                    "precio_max": precio,
                    "descripcion": None,
                    "imagen_url": None,
                    "etiqueta": None,
                    "agotado": True,
                    "sabores": [],
                }
                grupos[llave] = tarjeta
                tarjetas.append(tarjeta)

            tarjeta["precio"] = min(tarjeta["precio"], precio)
            tarjeta["precio_max"] = max(tarjeta["precio_max"], precio)
            tarjeta["descripcion"] = tarjeta["descripcion"] or p.carta_descripcion
            tarjeta["imagen_url"] = tarjeta["imagen_url"] or p.carta_imagen_url
            tarjeta["etiqueta"] = tarjeta["etiqueta"] or p.carta_etiqueta
            tarjeta["agotado"] = tarjeta["agotado"] and agotado
            tarjeta["sabores"].append({
                "id": p.id,
                "nombre": p.carta_sabor or _nombre_de(p),
                "precio": precio,
                "agotado": agotado,
            })

        nombres = CartaService._ordenar_categorias(elementos.keys(), CartaService._orden_categorias(cfg))
        imagenes = CartaService._imagenes_categorias()

        return {
            "negocio": cfg.to_dict(),
            "categorias": [
                {"nombre": c, "imagen_url": imagenes.get(c), "productos": elementos[c]}
                for c in nombres
            ],
        }