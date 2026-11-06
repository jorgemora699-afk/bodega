import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Clock, MessageCircle, X, ArrowLeft, ArrowRight } from "lucide-react";
import { obtenerCartaPublica } from "../../../api/carta";
import "./Carta.css";

const CLASE_ETIQUETA = {
  Nuevo: "nuevo",
  "Más pedido": "popular",
  Promo: "promo",
};

function moneda(v) {
  return `$${Number(v || 0).toLocaleString("es-CO")}`;
}

const numero = (i) => String(i + 1).padStart(2, "0");
const cuenta = (n) => `${n} ${n === 1 ? "producto" : "productos"}`;

/* La categoría abierta vive en el hash (#Entradas): el botón "atrás" funciona
   y se puede compartir el enlace directo a una categoría. */
function hashActual() {
  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return "";
  }
}

function urlDe(nombre) {
  return nombre
    ? `#${encodeURIComponent(nombre)}`
    : `${window.location.pathname}${window.location.search}`;
}

function FilaProducto({ p, indice, alAbrir }) {
  return (
    <li style={{ "--i": Math.min(indice, 8) }}>
      <button
        type="button"
        className={`carta-fila ${p.agotado ? "agotado" : ""}`}
        onClick={() => alAbrir(p)}
      >
        <span className="carta-fila-texto">
          {p.etiqueta && (
            <span className={`carta-etiqueta ${CLASE_ETIQUETA[p.etiqueta] || ""}`}>{p.etiqueta}</span>
          )}
          <span className="carta-fila-nombre">{p.nombre}</span>
          {p.descripcion && <span className="carta-fila-desc">{p.descripcion}</span>}
          {p.sabores && (
            <span className="carta-sabores">
              {p.sabores.map((s) => (
                <span key={s.id} className={`carta-sabor ${s.agotado ? "agotado" : ""}`}>
                  {s.nombre}
                </span>
              ))}
            </span>
          )}
          <span className="carta-fila-precio">
            {p.precio_max > p.precio ? "desde " : ""}
            {moneda(p.precio)}
            {p.agotado && !p.imagen_url && <em>Agotado</em>}
          </span>
        </span>

        {p.imagen_url && (
          <span className="carta-fila-foto">
            <img src={p.imagen_url} alt="" loading="lazy" />
            {p.agotado && <span className="carta-agotado">Agotado</span>}
          </span>
        )}
      </button>
    </li>
  );
}

export default function Carta() {
  const [carta, setCarta] = useState(null);
  const [error, setError] = useState(false);
  const [hash, setHash] = useState(hashActual);
  const [bajo, setBajo] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [elegidos, setElegidos] = useState([]);

  function abrirDetalle(p) {
    setElegidos([]);
    setDetalle(p);
  }

  function alternarSabor(id) {
    setElegidos((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
  }

  const posicionInicio = useRef(0);
  const desdeInicio = useRef(false);
  const vistaPrevia = useRef(undefined);

  useEffect(() => {
    obtenerCartaPublica()
      .then(setCarta)
      .catch(() => setError(true));
  }, []);

  const categorias = useMemo(() => carta?.categorias ?? [], [carta]);
  const indiceActivo = categorias.findIndex((c) => c.nombre === hash);
  const categoriaActiva = indiceActivo >= 0 ? categorias[indiceActivo] : null;

  /* Productos con etiqueta y foto, disponibles */
  const recomendados = useMemo(
    () =>
      categorias
        .flatMap((c) => c.productos)
        .filter((p) => p.etiqueta && p.imagen_url && !p.agotado)
        .slice(0, 8),
    [categorias]
  );

  /* Botón atrás / adelante del navegador */
  useEffect(() => {
    const alCambiar = () => setHash(hashActual());
    window.addEventListener("popstate", alCambiar);
    return () => window.removeEventListener("popstate", alCambiar);
  }, []);

  /* El botón de WhatsApp aparece cuando el cliente empieza a bajar */
  useEffect(() => {
    let pendiente = false;
    function alScroll() {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(() => {
        pendiente = false;
        setBajo(window.scrollY > 200);
      });
    }
    window.addEventListener("scroll", alScroll, { passive: true });
    return () => window.removeEventListener("scroll", alScroll);
  }, []);

  useEffect(() => {
    if (!carta) return;
    const nombre = carta.negocio.nombre_negocio || "Carta";
    document.title = categoriaActiva ? `${categoriaActiva.nombre} · ${nombre}` : nombre;
  }, [carta, categoriaActiva]);

  /* Al cambiar de vista: arriba del todo, o de vuelta donde estaba en el inicio */
  const nombreVista = categoriaActiva ? categoriaActiva.nombre : null;
  useEffect(() => {
    if (!carta) return;
    if (vistaPrevia.current === undefined) {
      vistaPrevia.current = nombreVista;
      return;
    }
    vistaPrevia.current = nombreVista;
    const destino = nombreVista === null ? posicionInicio.current : 0;
    requestAnimationFrame(() => window.scrollTo({ top: destino, behavior: "instant" }));
  }, [nombreVista, carta]);

  /* Detalle del producto: bloquea el scroll y cierra con Escape */
  useEffect(() => {
    if (!detalle) return undefined;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const alTecla = (e) => e.key === "Escape" && setDetalle(null);
    window.addEventListener("keydown", alTecla);
    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener("keydown", alTecla);
    };
  }, [detalle]);

  function navegar(nombre, { reemplazar = false } = {}) {
    if (!window.location.hash && nombre) {
      posicionInicio.current = window.scrollY;
      if (!reemplazar) desdeInicio.current = true;
    }
    const url = urlDe(nombre);
    if (reemplazar) window.history.replaceState(window.history.state, "", url);
    else window.history.pushState(window.history.state, "", url);
    setHash(nombre || "");
  }

  function alClicEnlace(e, nombre, opciones) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    navegar(nombre, opciones);
  }

  function volverInicio(e) {
    e.preventDefault();
    if (desdeInicio.current && window.history.length > 1) window.history.back();
    else navegar("", { reemplazar: true });
  }

  /* ---------- Estados ---------- */

  if (error) {
    return (
      <div className="carta-pagina carta-estado">
        <div className="carta-fondo" />
        <div className="carta-velo" />
        <div className="carta-estado-caja">
          <p>No pudimos cargar la carta. Intenta de nuevo en un momento.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!carta) {
    return (
      <div className="carta-pagina">
        <div className="carta-fondo" />
        <div className="carta-velo" />
        <div className="carta-vista">
          <div className="carta-portada">
            <div className="carta-skeleton redondo" />
            <div className="carta-skeleton linea grande" />
            <div className="carta-skeleton linea" />
          </div>
          <div className="carta-columna">
            <div className="carta-skeleton fila" />
            <div className="carta-skeleton fila" />
            <div className="carta-skeleton fila" />
          </div>
        </div>
      </div>
    );
  }

  const { negocio } = carta;

  function enlaceWhatsapp(producto, sabores = []) {
    if (!negocio.whatsapp) return null;
    const texto = producto
      ? `Hola ${negocio.nombre_negocio}, quiero pedir: ${producto.nombre}${
          sabores.length ? ` — ${sabores.join(", ")}` : ""
        }`
      : `Hola ${negocio.nombre_negocio}, quiero hacer un pedido`;
    return `https://wa.me/${negocio.whatsapp}?text=${encodeURIComponent(texto)}`;
  }

  const enlaceGeneral = enlaceWhatsapp();

  return (
    <div className="carta-pagina">
      <div
        className="carta-fondo"
        style={negocio.banner_url ? { backgroundImage: `url(${negocio.banner_url})` } : undefined}
      />
      <div className="carta-velo" />

      {/* ================= CATEGORÍA ABIERTA ================= */}

      {categoriaActiva ? (
        <>
          <a className="carta-volver" href={urlDe("")} onClick={volverInicio}>
            <ArrowLeft size={15} />
            Volver
          </a>

          <div className="carta-vista" key={`cat-${categoriaActiva.nombre}`}>
            <header className={`carta-cat-hero ${categoriaActiva.imagen_url ? "con-foto" : "sin-foto"}`}>
              {categoriaActiva.imagen_url && (
                <div
                  className="carta-cat-foto"
                  style={{ "--foto": `url(${categoriaActiva.imagen_url})` }}
                >
                  <img src={categoriaActiva.imagen_url} alt={categoriaActiva.nombre} />
                </div>
              )}
              <div className="carta-cat-hero-texto">
                <span className="carta-num">{numero(indiceActivo)}</span>
                <h1>{categoriaActiva.nombre}</h1>
                <span className="carta-filete izquierda" aria-hidden="true" />
                <span className="carta-cuenta">{cuenta(categoriaActiva.productos.length)}</span>
              </div>
            </header>

            <main className="carta-columna">
              <ul className="carta-lista">
                {categoriaActiva.productos.map((p, i) => (
                  <FilaProducto key={p.id} p={p} indice={i} alAbrir={abrirDetalle}/>
                ))}
              </ul>
            </main>
          </div>
        </>
      ) : (
        /* ================= INICIO ================= */
        <div className="carta-vista" key="inicio">
          <header className="carta-portada">
            {negocio.logo_url && <img className="carta-logo" src={negocio.logo_url} alt="" />}
            <h1>{negocio.nombre_negocio}</h1>
            {negocio.bienvenida && <p className="carta-lema">{negocio.bienvenida}</p>}
            <span className="carta-filete" aria-hidden="true" />
            {(negocio.horario || negocio.direccion) && (
              <div className="carta-datos">
                {negocio.horario && (
                  <span>
                    <Clock size={13} />
                    {negocio.horario}
                  </span>
                )}
                {negocio.direccion && (
                  <span>
                    <MapPin size={13} />
                    {negocio.direccion}
                  </span>
                )}
              </div>
            )}
          </header>

          <main className="carta-columna">
            <>
                {recomendados.length >= 2 && (
                  <section className="carta-bloque" aria-label="Recomendados">
                    <h2 className="carta-rotulo">Recomendados</h2>
                    <div className="carta-reco-pista">
                      {recomendados.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="carta-reco"
                          onClick={() => abrirDetalle(p)}
                        >
                          <span className="carta-reco-foto">
                            <img src={p.imagen_url} alt="" loading="lazy" />
                            <span className={`carta-etiqueta ${CLASE_ETIQUETA[p.etiqueta] || ""}`}>
                              {p.etiqueta}
                            </span>
                          </span>
                          <span className="carta-reco-nombre">{p.nombre}</span>
                          <span className="carta-reco-precio">{moneda(p.precio)}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {categorias.length > 0 ? (
                  <section className="carta-bloque">
                    <h2 className="carta-rotulo">¿Qué deseas ver?</h2>
                    <ul className="carta-categorias">
                      {categorias.map((c, i) => (
                        <li key={c.nombre} style={{ "--i": Math.min(i, 8) }}>
                          <a
                            className="carta-categoria"
                            href={urlDe(c.nombre)}
                            onClick={(e) => alClicEnlace(e, c.nombre)}
                          >
                            <span className="carta-num">{numero(i)}</span>
                            <span className="carta-categoria-foto">
                              {c.imagen_url ? (
                                <img src={c.imagen_url} alt="" loading="lazy" />
                              ) : (
                                c.nombre.charAt(0).toUpperCase()
                              )}
                            </span>
                            <span className="carta-categoria-texto">
                              <span className="carta-categoria-nombre">{c.nombre}</span>
                              <span className="carta-cuenta">{cuenta(c.productos.length)}</span>
                            </span>
                            <ArrowRight size={17} className="carta-flecha" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : (
                  <p className="carta-vacio">La carta se está preparando</p>
                )}
            </>
          </main>
        </div>
      )}

      {enlaceGeneral && (
        <a
          className={`carta-whatsapp ${(categoriaActiva || bajo) && !detalle ? "visible" : ""}`}
          href={enlaceGeneral}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle size={18} />
          Pedir por WhatsApp
        </a>
      )}

      {/* ================= DETALLE ================= */}

      {detalle && (
        <div className="carta-modal" onClick={() => setDetalle(null)}>
          <div
            className="carta-modal-hoja"
            role="dialog"
            aria-modal="true"
            aria-label={detalle.nombre}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="carta-modal-cerrar"
              onClick={() => setDetalle(null)}
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>

            {detalle.imagen_url && (
              <div className="carta-modal-foto" style={{ "--foto": `url(${detalle.imagen_url})` }}>
                <img src={detalle.imagen_url} alt={detalle.nombre} />
              </div>
            )}

            <div className="carta-modal-cuerpo">
              {detalle.etiqueta && (
                <span className={`carta-etiqueta ${CLASE_ETIQUETA[detalle.etiqueta] || ""}`}>
                  {detalle.etiqueta}
                </span>
              )}
              <h3>{detalle.nombre}</h3>
              <span className="carta-filete izquierda" aria-hidden="true" />
              {detalle.descripcion && <p>{detalle.descripcion}</p>}
              <strong className="carta-modal-precio">
                {detalle.precio_max > detalle.precio ? "desde " : ""}
                {moneda(detalle.precio)}
              </strong>

              {detalle.sabores && (
                <div className="carta-modal-sabores">
                  <span className="carta-rotulo">Elige tus sabores</span>
                  <div className="carta-sabores grande">
                    {detalle.sabores.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        disabled={s.agotado}
                        className={`carta-sabor ${s.agotado ? "agotado" : ""} ${
                          elegidos.includes(s.id) ? "elegido" : ""
                        }`}
                        onClick={() => alternarSabor(s.id)}
                      >
                        {s.nombre}
                        {detalle.precio_max > detalle.precio && <small>{moneda(s.precio)}</small>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {detalle.agotado ? (
                <span className="carta-agotado-pastilla">Agotado por ahora</span>
              ) : (
                (() => {
                  const nombresElegidos = (detalle.sabores || [])
                    .filter((s) => elegidos.includes(s.id))
                    .map((s) => s.nombre);
                  const enlace = enlaceWhatsapp(detalle, nombresElegidos);
                  return (
                    enlace && (
                      <a className="carta-modal-pedir" href={enlace} target="_blank" rel="noreferrer">
                        <MessageCircle size={18} />
                        {nombresElegidos.length
                          ? `Pedir ${nombresElegidos.join(", ")}`
                          : "Pedir este producto"}
                      </a>
                    )
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}