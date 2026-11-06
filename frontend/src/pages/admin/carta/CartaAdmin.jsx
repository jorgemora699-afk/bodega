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
  RotateCcw,
  Layers 
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
  renombrarCategoriaCarta,
  subirImagenCategoria,
  quitarImagenCategoria,
  agruparProductosCarta,
  desagruparCarta,
} from "../../../api/carta";
import Sheet from "../../../components/Sheet";
import "./CartaAdmin.css";

const clave = (p) => p.categoria || "Otros";

const TABS = [
  { v: "productos", l: "Productos" },
  { v: "categorias", l: "Categorías" },
  { v: "negocio", l: "Negocio" },
  { v: "compartir", l: "Compartir" },
];

const ESTADOS = [
  { v: "todos", l: "Todos" },
  { v: "visibles", l: "En la carta" },
  { v: "ocultos", l: "Ocultos" },
];

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

/* "Jugo en agua mora" + "Jugo en agua mango" -> grupo "Jugo en agua", sabores "Mora" y "Mango" */
function sugerirAgrupacion(nombres) {
  const limpios = nombres.map((n) => n.trim().split(/\s+/));
  const igual = (a, b) => a.toLowerCase() === b.toLowerCase();
  const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  let inicio = 0;
  while (
    limpios.every((t) => t.length > inicio + 1) &&
    limpios.every((t) => igual(t[inicio], limpios[0][inicio]))
  ) inicio += 1;

  let fin = 0;
  while (
    limpios.every((t) => t.length - inicio - fin > 1) &&
    limpios.every((t) => igual(t[t.length - 1 - fin], limpios[0][limpios[0].length - 1 - fin]))
  ) fin += 1;

  return {
    grupo: limpios[0].slice(0, inicio).join(" "),
    sabores: limpios.map((t, i) =>
      mayuscula(t.slice(inicio, t.length - fin).join(" ") || nombres[i])
    ),
  };
}

function Miniatura({ url, nombre }) {
  return url ? (
    <img className="cadm-mini" src={url} alt="" />
  ) : (
    <span className="cadm-mini vacia">{nombre.charAt(0).toUpperCase()}</span>
  );
}

export default function CartaAdmin() {
  const [datos, setDatos] = useState(null);
  const [tab, setTab] = useState("productos");
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("todos");
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [modoAgrupar, setModoAgrupar] = useState(false);
  const [seleccion, setSeleccion] = useState([]);
  const [hojaGrupo, setHojaGrupo] = useState(false);
  const [formGrupo, setFormGrupo] = useState({ grupo: "", items: [] });

  const [editandoId, setEditandoId] = useState(null);
  const [formProd, setFormProd] = useState({
    nombre: "",
    categoria: "",
    carta_descripcion: "",
    carta_etiqueta: "",
    carta_grupo: "",
    carta_sabor: "",
  });
  const [errorForm, setErrorForm] = useState(null);

  const [editandoCat, setEditandoCat] = useState(null);
  const [formCat, setFormCat] = useState("");

  const [formNegocio, setFormNegocio] = useState(null);

  const [qr, setQr] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const urlCarta = `${window.location.origin}/carta`;

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (!mensaje) return undefined;
    const t = setTimeout(() => setMensaje(null), 3000);
    return () => clearTimeout(t);
  }, [mensaje]);

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

  /* Vuelve a pedir los datos sin tocar el formulario del negocio */
  async function refrescar() {
    try {
      setDatos(await obtenerCartaAdmin());
    } catch {
      /* la vista actual sigue siendo válida */
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
  const categoriaEditando = datos.categorias.find((c) => c.nombre === editandoCat) || null;
  const visibles = datos.productos.filter((p) => p.carta_visible).length;
  const filtro = busqueda.trim().toLowerCase();
  const reordenable = !filtro && estado === "todos" && !modoAgrupar;
  const gruposExistentes = [...new Set(datos.productos.map((p) => p.carta_grupo).filter(Boolean))];

  function pasaFiltro(p) {
    const texto =
      !filtro ||
      p.nombre.toLowerCase().includes(filtro) ||
      p.nombre_original.toLowerCase().includes(filtro);
    const porEstado =
      estado === "todos" || (estado === "visibles" ? p.carta_visible : !p.carta_visible);
    return texto && porEstado;
  }

  function conteo(nombre) {
    const lista = datos.productos.filter((p) => clave(p) === nombre);
    return { total: lista.length, visibles: lista.filter((p) => p.carta_visible).length };
  }

  function reemplazarProducto(actualizado) {
    setDatos((d) => ({
      ...d,
      productos: d.productos.map((p) => (p.id === actualizado.id ? actualizado : p)),
    }));
  }

  function salirDeAgrupar() {
    setModoAgrupar(false);
    setSeleccion([]);
  }

  function alternarSeleccion(id) {
    setSeleccion((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function abrirAgrupar() {
    const elegidos = datos.productos.filter((p) => seleccion.includes(p.id));
    const sugerencia = sugerirAgrupacion(elegidos.map((p) => p.nombre));
    setErrorForm(null);
    setFormGrupo({
      grupo: sugerencia.grupo,
      items: elegidos.map((p, i) => ({ id: p.id, nombre: p.nombre, sabor: sugerencia.sabores[i] })),
    });
    setHojaGrupo(true);
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

  async function guardarGrupo() {
    setGuardando(true);
    setErrorForm(null);
    try {
      setDatos(
        await agruparProductosCarta(
          formGrupo.grupo,
          formGrupo.items.map((i) => ({ id: i.id, sabor: i.sabor }))
        )
      );
      setHojaGrupo(false);
      salirDeAgrupar();
      avisar("Grupo creado");
    } catch (err) {
      setErrorForm(err.response?.data?.error || "No se pudo crear el grupo");
    } finally {
      setGuardando(false);
    }
  }

  async function deshacerGrupo(nombre) {
    setGuardando(true);
    try {
      setDatos(await desagruparCarta(nombre));
      setEditandoId(null);
      avisar("Grupo deshecho");
    } catch (err) {
      setErrorForm(err.response?.data?.error || "No se pudo deshacer el grupo");
    } finally {
      setGuardando(false);
    }
  }

  async function moverProducto(categoria, id, delta) {
    const lista = datos.productos.filter((p) => clave(p) === categoria);
    const i = lista.findIndex((p) => p.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];

    const nuevos = datos.categorias.flatMap((c) =>
      c.nombre === categoria ? lista : datos.productos.filter((p) => clave(p) === c.nombre)
    );
    setDatos((d) => ({ ...d, productos: nuevos }));

    try {
      await ordenarProductosCarta(nuevos.map((p) => p.id));
    } catch (err) {
      fallar(err, "No se pudo guardar el orden");
      cargar();
    }
  }

  function abrirEdicion(p) {
    setErrorForm(null);
    setFormProd({
      nombre: p.nombre,
      categoria: p.categoria,
      carta_descripcion: p.carta_descripcion || "",
      carta_etiqueta: p.carta_etiqueta || "",
      carta_grupo: p.carta_grupo || "",
      carta_sabor: p.carta_sabor || "",
    });
    setEditandoId(p.id);
  }

  async function guardarProducto() {
    setGuardando(true);
    setErrorForm(null);
    try {
      const categoriaAntes = productoEditando.categoria;
      const actualizado = await actualizarProductoCarta(editandoId, {
        carta_nombre: formProd.nombre,
        carta_categoria: formProd.categoria,
        carta_descripcion: formProd.carta_descripcion,
        carta_etiqueta: formProd.carta_etiqueta || null,
        carta_grupo: formProd.carta_grupo,
        carta_sabor: formProd.carta_sabor,
      });
      reemplazarProducto(actualizado);
      // si cambió de categoría, la lista de categorías y sus conteos también cambian
      if (actualizado.categoria !== categoriaAntes) await refrescar();
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

  /* ---------- Categorías ---------- */

  async function moverCategoria(index, delta) {
    const j = index + delta;
    if (j < 0 || j >= datos.categorias.length) return;
    const nuevas = [...datos.categorias];
    [nuevas[index], nuevas[j]] = [nuevas[j], nuevas[index]];
    setDatos((d) => ({ ...d, categorias: nuevas }));

    try {
      await actualizarConfigCarta({ orden_categorias: nuevas.map((c) => c.nombre) });
    } catch (err) {
      fallar(err, "No se pudo guardar el orden");
      cargar();
    }
  }

  function abrirCategoria(c) {
    setErrorForm(null);
    setFormCat(c.nombre);
    setEditandoCat(c.nombre);
  }

  async function guardarCategoria() {
    const nuevo = formCat.trim();
    if (!nuevo) {
      setErrorForm("Escribe un nombre para la categoría");
      return;
    }
    if (nuevo === editandoCat) {
      setEditandoCat(null);
      return;
    }

    setGuardando(true);
    setErrorForm(null);
    try {
      setDatos(await renombrarCategoriaCarta(editandoCat, nuevo));
      setEditandoCat(null);
      avisar("Categoría actualizada");
    } catch (err) {
      setErrorForm(err.response?.data?.error || "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarFotoCategoria(e) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;

    setGuardando(true);
    setErrorForm(null);
    try {
      const lista = await prepararImagen(archivo, 1600);
      setDatos(await subirImagenCategoria(editandoCat, lista));
    } catch (err) {
      setErrorForm(err.response?.data?.error || "No se pudo subir la foto");
    } finally {
      setGuardando(false);
    }
  }

  async function quitarFotoCategoria() {
    setGuardando(true);
    try {
      setDatos(await quitarImagenCategoria(editandoCat));
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

  const imagenCategoria = (nombre) => datos.categorias.find((c) => c.nombre === nombre)?.imagen_url;

  return (
    <div className="cadm-container">
      <header className="cadm-header">
        <div>
          <h1>Carta digital</h1>
          <p>
            {visibles} de {datos.productos.length} productos en la carta
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
        {TABS.map((t) => (
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
        <div className="cadm-panel">
          <div className="cadm-buscador">
            <Search size={15} />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div className="cadm-filtros">
            {ESTADOS.map((e) => (
              <button
                key={e.v}
                type="button"
                className={`cadm-filtro ${estado === e.v ? "activo" : ""}`}
                onClick={() => setEstado(e.v)}
              >
                {e.l}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`cadm-btn-sec cadm-btn-agrupar ${modoAgrupar ? "activo" : ""}`}
            onClick={() => (modoAgrupar ? salirDeAgrupar() : setModoAgrupar(true))}
          >
            <Layers size={14} />
            {modoAgrupar ? "Cancelar" : "Agrupar sabores"}
          </button>

          <p className="cadm-ayuda">
            Activa el interruptor para que el producto salga en la carta. Los productos nuevos
            empiezan ocultos. Toca el lápiz para cambiar su nombre, foto o categoría.
          </p>

          {datos.categorias.map((cat) => {
            const lista = datos.productos.filter((p) => clave(p) === cat.nombre && pasaFiltro(p));
            if (lista.length === 0) return null;
            const { total, visibles: enCarta } = conteo(cat.nombre);

            return (
              <section key={cat.nombre} className="cadm-categoria">
                <div className="cadm-categoria-cabecera">
                  <Miniatura url={cat.imagen_url} nombre={cat.nombre} />
                  <h2>{cat.nombre}</h2>
                  <span className="cadm-contador">
                    {enCarta}/{total}
                  </span>
                </div>

                {lista.map((p, i) => (
                  <div key={p.id} className={`cadm-producto ${p.carta_visible ? "" : "oculto"}`}>
                    {modoAgrupar && (
                        <input
                            type="checkbox"
                            className="cadm-check"
                            checked={seleccion.includes(p.id)}
                            onChange={() => alternarSeleccion(p.id)}
                            aria-label={`Elegir ${p.nombre}`}
                        />
                    )}
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
                        {p.carta_grupo && (
                            <em className="cadm-grupo">
                                {p.carta_grupo} · {p.carta_sabor}
                            </em>
                        )}
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
                        aria-label={`Editar ${p.nombre}`}
                      >
                        <Pencil size={14} />
                      </button>
                      {reordenable && (
                        <div className="cadm-flechas vertical">
                          <button
                            type="button"
                            onClick={() => moverProducto(cat.nombre, p.id, -1)}
                            disabled={i === 0}
                            aria-label="Subir"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moverProducto(cat.nombre, p.id, 1)}
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
          {datos.productos.length > 0 && !datos.productos.some(pasaFiltro) && (
            <p className="cadm-vacio">Ningún producto coincide</p>
          )}
        </div>
      )}

      {/* ================= CATEGORÍAS ================= */}

      {tab === "categorias" && (
        <div className="cadm-panel">
          <p className="cadm-ayuda">
            Toca una categoría para cambiarle el nombre o la foto. Usa las flechas para decidir en
            qué orden las ve el cliente.
          </p>

          <div className="cadm-cats">
            {datos.categorias.map((c, i) => {
              const { total, visibles: enCarta } = conteo(c.nombre);
              return (
                <div key={c.nombre} className="cadm-cat">
                  <button
                    type="button"
                    className={`cadm-cat-portada ${c.imagen_url ? "" : "vacia"}`}
                    onClick={() => abrirCategoria(c)}
                    aria-label={`Editar categoría ${c.nombre}`}
                  >
                    {c.imagen_url ? (
                      <img src={c.imagen_url} alt="" loading="lazy" />
                    ) : (
                      <span className="cadm-cat-inicial">{c.nombre.charAt(0).toUpperCase()}</span>
                    )}
                    <span className="cadm-cat-editar">
                      <Pencil size={12} />
                    </span>
                  </button>

                  <div className="cadm-cat-pie">
                    <div className="cadm-cat-texto">
                      <strong>{c.nombre}</strong>
                      <span>
                        {total} {total === 1 ? "producto" : "productos"} · {enCarta} en la carta
                      </span>
                    </div>
                    <div className="cadm-flechas vertical">
                      <button
                        type="button"
                        onClick={() => moverCategoria(i, -1)}
                        disabled={i === 0}
                        aria-label={`Subir ${c.nombre}`}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moverCategoria(i, 1)}
                        disabled={i === datos.categorias.length - 1}
                        aria-label={`Bajar ${c.nombre}`}
                      >
                        <ArrowDown size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {datos.categorias.length === 0 && <p className="cadm-vacio">Aún no hay categorías</p>}
        </div>
      )}

      {/* ================= NEGOCIO ================= */}

      {tab === "negocio" && formNegocio && (
        <div className="cadm-tarjeta cadm-panel">
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
        <div className="cadm-tarjeta cadm-compartir cadm-panel">
          {qr ? (
            <img src={qr} alt="Código QR de la carta" className="cadm-qr" />
          ) : (
            <div className="cadm-skeleton" />
          )}
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

      {modoAgrupar && (
        <div className="cadm-barra-agrupar">
          <span>
            {seleccion.length} {seleccion.length === 1 ? "elegido" : "elegidos"}
          </span>
          <button
            type="button"
            className="cadm-btn-guardar"
            disabled={seleccion.length < 2}
            onClick={abrirAgrupar}
          >
            Agrupar
          </button>
        </div>
      )}

      <Sheet open={hojaGrupo} onOpenChange={(a) => !a && setHojaGrupo(false)} title="Nuevo grupo">
        <div className="cadm-form">
          {errorForm && <div className="cadm-mensaje-error">{errorForm}</div>}

          <label>Nombre del grupo</label>
          <input
            type="text"
            list="cadm-lista-grupos"
            maxLength={100}
            value={formGrupo.grupo}
            onChange={(e) => setFormGrupo((f) => ({ ...f, grupo: e.target.value }))}
            placeholder="Ej: Jugo en agua"
          />
          <datalist id="cadm-lista-grupos">
            {gruposExistentes.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>

          <p className="cadm-ayuda">
            Revisa el sabor de cada producto. Lo puedes corregir antes de guardar.
          </p>

          {formGrupo.items.map((it, i) => (
            <div key={it.id} className="cadm-grupo-fila">
              <span title={it.nombre}>{it.nombre}</span>
              <input
                type="text"
                maxLength={100}
                value={it.sabor}
                onChange={(e) =>
                  setFormGrupo((f) => ({
                    ...f,
                    items: f.items.map((x, j) => (j === i ? { ...x, sabor: e.target.value } : x)),
                  }))
                }
              />
            </div>
          ))}

          <button type="button" className="cadm-btn-guardar" onClick={guardarGrupo} disabled={guardando}>
            {guardando ? "Guardando..." : "Crear grupo"}
          </button>
        </div>
      </Sheet>

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

            <label>Nombre en la carta</label>
            <input
              type="text"
              maxLength={100}
              value={formProd.nombre}
              onChange={(e) => setFormProd((f) => ({ ...f, nombre: e.target.value }))}
            />
            {formProd.nombre.trim() !== productoEditando.nombre_original && (
              <button
                type="button"
                className="cadm-restaurar"
                onClick={() => setFormProd((f) => ({ ...f, nombre: productoEditando.nombre_original }))}
              >
                <RotateCcw size={12} />
                Volver a “{productoEditando.nombre_original}”
              </button>
            )}

            <label>Categoría</label>
            <input
              type="text"
              list="cadm-lista-categorias"
              maxLength={60}
              value={formProd.categoria}
              onChange={(e) => setFormProd((f) => ({ ...f, categoria: e.target.value }))}
            />
            <datalist id="cadm-lista-categorias">
              {datos.categorias.map((c) => (
                <option key={c.nombre} value={c.nombre} />
              ))}
            </datalist>
            <p className="cadm-ayuda">Elige una de la lista o escribe una nueva para crearla.</p>

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



            <label>Grupo (opcional)</label>
            <input
            type="text"
            list="cadm-lista-grupos"
            maxLength={100}
            value={formProd.carta_grupo}
            onChange={(e) =>
                setFormProd((f) => ({ ...f, carta_grupo: e.target.value }))
            }
            placeholder="Ej: Empanada coctelera"
            />

            <datalist id="cadm-lista-grupos">
            {gruposExistentes.map((g) => (
                <option key={g} value={g} />
            ))}
            </datalist>

            {formProd.carta_grupo.trim() && (
            <>
                <label>Sabor</label>
                <input
                type="text"
                maxLength={100}
                value={formProd.carta_sabor}
                onChange={(e) =>
                    setFormProd((f) => ({ ...f, carta_sabor: e.target.value }))
                }
                placeholder="Ej: Pollo"
                />
            </>
            )}

            {productoEditando.carta_grupo && (
            <button
                type="button"
                className="cadm-restaurar"
                onClick={() => deshacerGrupo(productoEditando.carta_grupo)}
                disabled={guardando}
            >
                <RotateCcw size={12} />
                Deshacer todo el grupo “{productoEditando.carta_grupo}”
            </button>
            )}

            <p className="cadm-ayuda">
            Los productos del mismo grupo salen en una sola tarjeta con sus sabores.
            La foto y la descripción de la tarjeta salen del primer sabor que las tenga.
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

      {/* ================= EDITAR CATEGORÍA ================= */}

      <Sheet
        open={Boolean(categoriaEditando)}
        onOpenChange={(abierto) => !abierto && setEditandoCat(null)}
        title={categoriaEditando ? categoriaEditando.nombre : "Categoría"}
      >
        {categoriaEditando && (
          <div className="cadm-form">
            {errorForm && <div className="cadm-mensaje-error">{errorForm}</div>}

            <span className="cadm-label">Foto de la categoría</span>
            <div className="cadm-imagen-vista producto">
              {imagenCategoria(editandoCat) ? (
                <img src={imagenCategoria(editandoCat)} alt="" />
              ) : (
                <span>Sin foto</span>
              )}
            </div>
            <div className="cadm-imagen-botones">
              <label className="cadm-btn-sec">
                <ImagePlus size={14} />
                {imagenCategoria(editandoCat) ? "Cambiar foto" : "Subir foto"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  disabled={guardando}
                  onChange={cambiarFotoCategoria}
                />
              </label>
              {imagenCategoria(editandoCat) && (
                <button
                  type="button"
                  className="cadm-btn-sec peligro"
                  onClick={quitarFotoCategoria}
                  disabled={guardando}
                >
                  <Trash2 size={14} />
                  Quitar
                </button>
              )}
            </div>

            <label>Nombre de la categoría</label>
            <input
              type="text"
              maxLength={60}
              value={formCat}
              onChange={(e) => setFormCat(e.target.value)}
            />
            <p className="cadm-ayuda">
              Si escribes el nombre de otra categoría que ya existe, las dos se unen en una sola.
              El cambio solo se ve en la carta.
            </p>

            <button
              type="button"
              className="cadm-btn-guardar"
              onClick={guardarCategoria}
              disabled={guardando}
            >
              {guardando ? "Guardando..." : "Guardar nombre"}
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}