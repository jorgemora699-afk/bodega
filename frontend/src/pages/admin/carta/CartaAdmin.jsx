import { useEffect, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Pencil,
  ImagePlus,
  Trash2,
  ExternalLink,
  Download,
  Copy,
  Check,
  Search,
} from "lucide-react";
import QRCode from "qrcode";
import {
  obtenerCartaAdmin,
  actualizarConfigCarta,
  subirImagenConfig,
  quitarImagenConfig,
  actualizarProductoCarta,
  ordenarProductosCarta,
  subirImagenProducto,
  quitarImagenProducto,
} from "../../../api/carta";
import Sheet from "../../../components/Sheet";
import "./CartaAdmin.css";

const clave = (p) => p.categoria || "Otros";

function moneda(v) {
  return `$${Number(v || 0).toLocaleString("es-CO")}`;
}

/* Las fotos de celular pueden pesar más de 5 MB: se reducen antes de subir */
async function prepararImagen(archivo, maximo) {
  if (archivo.size < 3 * 1024 * 1024) return archivo;
  try {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, maximo / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const tipo = archivo.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise((res) => canvas.toBlob(res, tipo, 0.85));
    return blob ? new File([blob], "imagen", { type: tipo }) : archivo;
  } catch {
    return archivo;
  }
}

export default function CartaAdmin() {
  const [datos, setDatos] = useState(null);
  const [tab, setTab] = useState("productos");
  const [busqueda, setBusqueda] = useState("");
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [editandoId, setEditandoId] = useState(null);
  const [formProd, setFormProd] = useState({ carta_descripcion: "", carta_etiqueta: "" });
  const [errorForm, setErrorForm] = useState(null);

  const [formNegocio, setFormNegocio] = useState(null);

  const [qr, setQr] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const urlCarta = `${window.location.origin}/carta`;

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (tab !== "compartir") return;
    QRCode.toDataURL(urlCarta, { width: 640, margin: 2 }).then(setQr).catch(() => setQr(null));
  }, [tab, urlCarta]);

  async function cargar() {
    try {
      const data = await obtenerCartaAdmin();
      setDatos(data);
      setFormNegocio({
        nombre_negocio: data.config.nombre_negocio || "",
        bienvenida: data.config.bienvenida || "",
        horario: data.config.horario || "",
        direccion: data.config.direccion || "",
        whatsapp: data.config.whatsapp || "",
      });
    } catch {
      setError("No se pudo cargar la carta");
    }
  }

  function avisar(texto) {
    setError(null);
    setMensaje(texto);
  }

  function fallar(err, defecto) {
    setMensaje(null);
    setError(err?.response?.data?.error || defecto);
  }

  if (!datos) {
    return (
      <div className="cadm-container">
        <header className="cadm-header">
          <h1>Carta digital</h1>
        </header>
        {error ? <div className="cadm-mensaje-error">{error}</div> : <div className="cadm-skeleton" />}
      </div>
    );
  }

  const productoEditando = datos.productos.find((p) => p.id === editandoId) || null;
  const visibles = datos.productos.filter((p) => p.carta_visible).length;
  const filtro = busqueda.trim().toLowerCase();

  function reemplazarProducto(actualizado) {
    setDatos((d) => ({
      ...d,
      productos: d.productos.map((p) => (p.id === actualizado.id ? actualizado : p)),
    }));
  }

  /* ---------- Productos ---------- */

  async function alternarVisible(p) {
    reemplazarProducto({ ...p, carta_visible: !p.carta_visible });
    try {
      await actualizarProductoCarta(p.id, { carta_visible: !p.carta_visible });
    } catch (err) {
      reemplazarProducto(p);
      fallar(err, "No se pudo cambiar la visibilidad");
    }
  }

  async function moverProducto(categoria, id, delta) {
    const lista = datos.productos.filter((p) => clave(p) === categoria);
    const i = lista.findIndex((p) => p.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];

    const nuevos = datos.categorias.flatMap((c) =>
      c === categoria ? lista : datos.productos.filter((p) => clave(p) === c)
    );
    setDatos((d) => ({ ...d, productos: nuevos }));

    try {
      await ordenarProductosCarta(nuevos.map((p) => p.id));
    } catch (err) {
      fallar(err, "No se pudo guardar el orden");
      cargar();
    }
  }

  async function moverCategoria(index, delta) {
    const j = index + delta;
    if (j < 0 || j >= datos.categorias.length) return;
    const nuevas = [...datos.categorias];
    [nuevas[index], nuevas[j]] = [nuevas[j], nuevas[index]];
    setDatos((d) => ({ ...d, categorias: nuevas }));

    try {
      await actualizarConfigCarta({ orden_categorias: nuevas });
    } catch (err) {
      fallar(err, "No se pudo guardar el orden");
      cargar();
    }
  }

  function abrirEdicion(p) {
    setErrorForm(null);
    setFormProd({
      carta_descripcion: p.carta_descripcion || "",
      carta_etiqueta: p.carta_etiqueta || "",
    });
    setEditandoId(p.id);
  }

  async function guardarProducto() {
    setGuardando(true);
    setErrorForm(null);
    try {
      const actualizado = await actualizarProductoCarta(editandoId, {
        carta_descripcion: formProd.carta_descripcion,
        carta_etiqueta: formProd.carta_etiqueta || null,
      });
      reemplazarProducto(actualizado);
      setEditandoId(null);
      avisar("Producto actualizado");
    } catch (err) {
      setErrorForm(err.response?.data?.error || "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarFotoProducto(e) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;

    setGuardando(true);
    setErrorForm(null);
    try {
      const lista = await prepararImagen(archivo, 1600);
      reemplazarProducto(await subirImagenProducto(editandoId, lista));
    } catch (err) {
      setErrorForm(err.response?.data?.error || "No se pudo subir la foto");
    } finally {
      setGuardando(false);
    }
  }

  async function quitarFotoProducto() {
    setGuardando(true);
    try {
      reemplazarProducto(await quitarImagenProducto(editandoId));
    } catch (err) {
      setErrorForm(err.response?.data?.error || "No se pudo quitar la foto");
    } finally {
      setGuardando(false);
    }
  }

  /* ---------- Negocio ---------- */

  async function guardarNegocio() {
    setGuardando(true);
    try {
      const config = await actualizarConfigCarta(formNegocio);
      setDatos((d) => ({ ...d, config }));
      setFormNegocio((f) => ({ ...f, whatsapp: config.whatsapp || "" }));
      avisar("Datos del negocio guardados");
    } catch (err) {
      fallar(err, "No se pudieron guardar los datos");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarImagenConfig(tipo, e) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;

    setGuardando(true);
    try {
      const lista = await prepararImagen(archivo, tipo === "banner" ? 2000 : 800);
      const config = await subirImagenConfig(tipo, lista);
      setDatos((d) => ({ ...d, config }));
      avisar(tipo === "logo" ? "Logo actualizado" : "Banner actualizado");
    } catch (err) {
      fallar(err, "No se pudo subir la imagen");
    } finally {
      setGuardando(false);
    }
  }

  async function quitarImagen(tipo) {
    setGuardando(true);
    try {
      const config = await quitarImagenConfig(tipo);
      setDatos((d) => ({ ...d, config }));
      avisar("Imagen quitada");
    } catch (err) {
      fallar(err, "No se pudo quitar la imagen");
    } finally {
      setGuardando(false);
    }
  }

  async function copiarEnlace() {
    try {
      await navigator.clipboard.writeText(urlCarta);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError("No se pudo copiar. Copia el enlace a mano.");
    }
  }

  return (
    <div className="cadm-container">
      <header className="cadm-header">
        <div>
          <h1>Carta digital</h1>
          <p>
            {visibles} de {datos.productos.length} productos visibles para los clientes
          </p>
        </div>
        <a className="cadm-btn-ver" href="/carta" target="_blank" rel="noreferrer">
          <ExternalLink size={14} />
          Ver carta
        </a>
      </header>

      {mensaje && <div className="cadm-mensaje-exito">{mensaje}</div>}
      {error && <div className="cadm-mensaje-error">{error}</div>}

      <div className="cadm-tabs">
        {[
          { v: "productos", l: "Productos" },
          { v: "negocio", l: "Negocio" },
          { v: "compartir", l: "Compartir" },
        ].map((t) => (
          <button
            key={t.v}
            type="button"
            className={`cadm-tab ${tab === t.v ? "activo" : ""}`}
            onClick={() => setTab(t.v)}
          >
            {t.l}
          </button>
        ))}
      </div>

      {/* ================= PRODUCTOS ================= */}

      {tab === "productos" && (
        <>
          <div className="cadm-buscador">
            <Search size={15} />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <p className="cadm-ayuda">
            Activa el interruptor para que el producto salga en la carta. Los productos nuevos
            empiezan ocultos.
          </p>

          {datos.categorias.map((cat, indexCat) => {
            const lista = datos.productos.filter(
              (p) => clave(p) === cat && (!filtro || p.nombre.toLowerCase().includes(filtro))
            );
            if (lista.length === 0) return null;

            return (
              <section key={cat} className="cadm-categoria">
                <div className="cadm-categoria-cabecera">
                  <h2>{cat}</h2>
                  {!filtro && (
                    <div className="cadm-flechas">
                      <button
                        type="button"
                        onClick={() => moverCategoria(indexCat, -1)}
                        disabled={indexCat === 0}
                        aria-label="Subir categoría"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moverCategoria(indexCat, 1)}
                        disabled={indexCat === datos.categorias.length - 1}
                        aria-label="Bajar categoría"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {lista.map((p, i) => (
                  <div key={p.id} className={`cadm-producto ${p.carta_visible ? "" : "oculto"}`}>
                    <div className="cadm-foto">
                      {p.carta_imagen_url ? (
                        <img src={p.carta_imagen_url} alt="" loading="lazy" />
                      ) : (
                        <span>Sin foto</span>
                      )}
                    </div>

                    <div className="cadm-producto-info">
                      <strong>{p.nombre}</strong>
                      <span>
                        {moneda(p.precio_unitario)}
                        {p.agotado && <em className="cadm-agotado">Agotado</em>}
                        {p.carta_etiqueta && <em className="cadm-etiqueta">{p.carta_etiqueta}</em>}
                      </span>
                    </div>

                    <div className="cadm-producto-acciones">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={p.carta_visible}
                        aria-label={`Mostrar ${p.nombre} en la carta`}
                        className={`cadm-switch ${p.carta_visible ? "on" : ""}`}
                        onClick={() => alternarVisible(p)}
                      />
                      <button
                        type="button"
                        className="cadm-icono"
                        onClick={() => abrirEdicion(p)}
                        aria-label="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      {!filtro && (
                        <div className="cadm-flechas vertical">
                          <button
                            type="button"
                            onClick={() => moverProducto(cat, p.id, -1)}
                            disabled={i === 0}
                            aria-label="Subir"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moverProducto(cat, p.id, 1)}
                            disabled={i === lista.length - 1}
                            aria-label="Bajar"
                          >
                            <ArrowDown size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </section>
            );
          })}

          {datos.productos.length === 0 && <p className="cadm-vacio">No hay productos activos</p>}
        </>
      )}

      {/* ================= NEGOCIO ================= */}

      {tab === "negocio" && formNegocio && (
        <div className="cadm-tarjeta">
          <div className="cadm-imagenes">
            {["logo", "banner"].map((tipo) => {
              const url = datos.config[`${tipo}_url`];
              return (
                <div key={tipo} className="cadm-imagen-bloque">
                  <span className="cadm-label">{tipo === "logo" ? "Logo" : "Banner"}</span>
                  <div className={`cadm-imagen-vista ${tipo}`}>
                    {url ? <img src={url} alt={tipo} /> : <span>Sin imagen</span>}
                  </div>
                  <div className="cadm-imagen-botones">
                    <label className="cadm-btn-sec">
                      <ImagePlus size={14} />
                      {url ? "Cambiar" : "Subir"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                        disabled={guardando}
                        onChange={(e) => cambiarImagenConfig(tipo, e)}
                      />
                    </label>
                    {url && (
                      <button
                        type="button"
                        className="cadm-btn-sec peligro"
                        onClick={() => quitarImagen(tipo)}
                        disabled={guardando}
                      >
                        <Trash2 size={14} />
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="cadm-form">
            <label>Nombre del negocio</label>
            <input
              type="text"
              maxLength={100}
              value={formNegocio.nombre_negocio}
              onChange={(e) => setFormNegocio((f) => ({ ...f, nombre_negocio: e.target.value }))}
            />

            <label>Texto de bienvenida</label>
            <textarea
              rows={2}
              maxLength={300}
              value={formNegocio.bienvenida}
              onChange={(e) => setFormNegocio((f) => ({ ...f, bienvenida: e.target.value }))}
              placeholder="Ej: Empanadas y pasabocas recién hechos"
            />

            <label>Horario</label>
            <input
              type="text"
              maxLength={200}
              value={formNegocio.horario}
              onChange={(e) => setFormNegocio((f) => ({ ...f, horario: e.target.value }))}
              placeholder="Ej: Lunes a sábado, 8:00 am a 6:00 pm"
            />

            <label>Dirección</label>
            <input
              type="text"
              maxLength={200}
              value={formNegocio.direccion}
              onChange={(e) => setFormNegocio((f) => ({ ...f, direccion: e.target.value }))}
            />

            <label>WhatsApp para pedidos</label>
            <input
              type="text"
              inputMode="tel"
              value={formNegocio.whatsapp}
              onChange={(e) => setFormNegocio((f) => ({ ...f, whatsapp: e.target.value }))}
              placeholder="Ej: 3001234567"
            />
            <p className="cadm-ayuda">
              Si lo dejas vacío, la carta no muestra el botón de WhatsApp.
            </p>

            <button
              type="button"
              className="cadm-btn-guardar"
              onClick={guardarNegocio}
              disabled={guardando}
            >
              {guardando ? "Guardando..." : "Guardar datos"}
            </button>
          </div>
        </div>
      )}

      {/* ================= COMPARTIR ================= */}

      {tab === "compartir" && (
        <div className="cadm-tarjeta cadm-compartir">
          {qr ? <img src={qr} alt="Código QR de la carta" className="cadm-qr" /> : <div className="cadm-skeleton" />}
          <p className="cadm-enlace">{urlCarta}</p>
          <div className="cadm-imagen-botones">
            {qr && (
              <a className="cadm-btn-sec" href={qr} download="carta-qr.png">
                <Download size={14} />
                Descargar QR
              </a>
            )}
            <button type="button" className="cadm-btn-sec" onClick={copiarEnlace}>
              {copiado ? <Check size={14} /> : <Copy size={14} />}
              {copiado ? "Copiado" : "Copiar enlace"}
            </button>
          </div>
          <p className="cadm-ayuda">
            Imprime el QR y ponlo en el mostrador o en las mesas. Los cambios que hagas aquí se
            ven en la carta en menos de un minuto.
          </p>
        </div>
      )}

      {/* ================= EDITAR PRODUCTO ================= */}

      <Sheet
        open={Boolean(productoEditando)}
        onOpenChange={(abierto) => !abierto && setEditandoId(null)}
        title={productoEditando ? productoEditando.nombre : "Producto"}
      >
        {productoEditando && (
          <div className="cadm-form">
            {errorForm && <div className="cadm-mensaje-error">{errorForm}</div>}

            <span className="cadm-label">Foto</span>
            <div className="cadm-imagen-vista producto">
              {productoEditando.carta_imagen_url ? (
                <img src={productoEditando.carta_imagen_url} alt="" />
              ) : (
                <span>Sin foto</span>
              )}
            </div>
            <div className="cadm-imagen-botones">
              <label className="cadm-btn-sec">
                <ImagePlus size={14} />
                {productoEditando.carta_imagen_url ? "Cambiar foto" : "Subir foto"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  disabled={guardando}
                  onChange={cambiarFotoProducto}
                />
              </label>
              {productoEditando.carta_imagen_url && (
                <button
                  type="button"
                  className="cadm-btn-sec peligro"
                  onClick={quitarFotoProducto}
                  disabled={guardando}
                >
                  <Trash2 size={14} />
                  Quitar
                </button>
              )}
            </div>

            <label>Descripción (opcional)</label>
            <textarea
              rows={3}
              maxLength={300}
              value={formProd.carta_descripcion}
              onChange={(e) => setFormProd((f) => ({ ...f, carta_descripcion: e.target.value }))}
              placeholder="Ej: Rellena de carne y papa, con ají de la casa"
            />

            <label>Etiqueta</label>
            <select
              value={formProd.carta_etiqueta}
              onChange={(e) => setFormProd((f) => ({ ...f, carta_etiqueta: e.target.value }))}
            >
              <option value="">Sin etiqueta</option>
              {datos.etiquetas.map((et) => (
                <option key={et} value={et}>
                  {et}
                </option>
              ))}
            </select>

            <p className="cadm-ayuda">
              El nombre, la categoría y el precio se editan en la sección Productos.
            </p>

            <button
              type="button"
              className="cadm-btn-guardar"
              onClick={guardarProducto}
              disabled={guardando}
            >
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}