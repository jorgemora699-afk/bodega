import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Clock, MessageCircle, Search, X } from "lucide-react";
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

export default function Carta() {
  const [carta, setCarta] = useState(null);
  const [error, setError] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [activa, setActiva] = useState(null);
  const [pegado, setPegado] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const bannerRef = useRef(null);
  const chipsRef = useRef(null);

  useEffect(() => {
    obtenerCartaPublica()
      .then((data) => {
        setCarta(data);
        document.title = data.negocio.nombre_negocio || "Carta";
      })
      .catch(() => setError(true));
  }, []);

  const filtro = busqueda.trim().toLowerCase();

  const categorias = useMemo(() => {
    if (!carta) return [];
    return carta.categorias
      .map((c) => ({
        ...c,
        productos: c.productos.filter(
          (p) =>
            !filtro ||
            p.nombre.toLowerCase().includes(filtro) ||
            (p.descripcion || "").toLowerCase().includes(filtro)
        ),
      }))
      .filter((c) => c.productos.length > 0);
  }, [carta, filtro]);

  /* Productos con etiqueta y foto, disponibles: van en el carrusel de arriba */
  const destacados = useMemo(() => {
    if (!carta) return [];
    return carta.categorias
      .flatMap((c) => c.productos)
      .filter((p) => p.etiqueta && p.imagen_url && !p.agotado)
      .slice(0, 8);
  }, [carta]);

  /* Parallax suave del banner + sombra de la barra cuando queda pegada */
  useEffect(() => {
    if (!carta) return undefined;
    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let pendiente = false;

    function alScroll() {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(() => {
        pendiente = false;
        const y = window.scrollY;
        if (bannerRef.current && !reducir && y < 400) {
          bannerRef.current.style.transform = `translate3d(0, ${y * 0.35}px, 0) scale(1.08)`;
        }
        setPegado(y > 200);
      });
    }

    alScroll();
    window.addEventListener("scroll", alScroll, { passive: true });
    return () => window.removeEventListener("scroll", alScroll);
  }, [carta]);

  /* Marca en la barra la categoría que se está viendo */
  useEffect(() => {
    if (categorias.length === 0) return undefined;
    const obs = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          if (e.isIntersecting) setActiva(e.target.dataset.cat);
        });
      },
      { rootMargin: "-120px 0px -70% 0px" }
    );
    document.querySelectorAll("[data-cat]").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [categorias]);

  /* Mantiene visible el chip activo dentro de la barra horizontal */
  useEffect(() => {
    const chip = chipsRef.current?.querySelector(".carta-chip.activo");
    chip?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activa]);

  /* Los productos aparecen una sola vez al entrar en pantalla */
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          if (e.isIntersecting) {
            e.target.dataset.visto = "1";
            obs.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    document
      .querySelectorAll(".carta-producto:not([data-visto])")
      .forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [categorias]);

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

  function irA(nombre) {
    document.getElementById(`cat-${nombre}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (error) {
    return (
      <div className="carta-estado">
        <p>No pudimos cargar la carta. Intenta de nuevo en un momento.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Reintentar
        </button>
      </div>
    );
  }

  if (!carta) {
    return (
      <div className="carta-pagina">
        <div className="carta-skeleton banner" />
        <div className="carta-contenido">
          <div className="carta-skeleton fila" />
          <div className="carta-skeleton fila" />
          <div className="carta-skeleton fila" />
        </div>
      </div>
    );
  }

  const { negocio } = carta;

  function enlaceWhatsapp(producto) {
    if (!negocio.whatsapp) return null;
    const texto = producto
      ? `Hola ${negocio.nombre_negocio}, quiero pedir: ${producto.nombre}`
      : `Hola ${negocio.nombre_negocio}, quiero hacer un pedido`;
    return `https://wa.me/${negocio.whatsapp}?text=${encodeURIComponent(texto)}`;
  }

  const enlaceGeneral = enlaceWhatsapp();

  return (
    <div className="carta-pagina">
      <header className="carta-hero">
        <div className="carta-banner-marco">
          <div
            ref={bannerRef}
            className="carta-banner"
            style={negocio.banner_url ? { backgroundImage: `url(${negocio.banner_url})` } : undefined}
          />
        </div>
        <div className="carta-negocio">
          {negocio.logo_url && <img className="carta-logo" src={negocio.logo_url} alt="" />}
          <h1>{negocio.nombre_negocio}</h1>
          {negocio.bienvenida && <p className="carta-bienvenida">{negocio.bienvenida}</p>}
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
        </div>
      </header>

      <nav className={`carta-nav ${pegado ? "pegado" : ""}`}>
        <div className="carta-buscador">
          <Search size={15} />
          <input
            type="text"
            placeholder="Buscar en la carta..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button
              type="button"
              className="carta-buscador-limpiar"
              onClick={() => setBusqueda("")}
              aria-label="Borrar búsqueda"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="carta-chips" ref={chipsRef}>
          {categorias.map((c) => (
            <button
              key={c.nombre}
              type="button"
              className={`carta-chip ${activa === c.nombre ? "activo" : ""}`}
              onClick={() => irA(c.nombre)}
            >
              {c.imagen_url && <img className="carta-chip-img" src={c.imagen_url} alt="" />}
              {c.nombre}
            </button>
          ))}
        </div>
      </nav>

      <main className="carta-contenido">
        {!filtro && destacados.length >= 2 && (
          <section className="carta-destacados" aria-label="Destacados">
            <h2>Para empezar</h2>
            <div className="carta-destacados-pista">
              {destacados.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="carta-destacado"
                  onClick={() => setDetalle(p)}
                >
                  <img src={p.imagen_url} alt="" loading="lazy" />
                  <span className={`carta-etiqueta ${CLASE_ETIQUETA[p.etiqueta] || ""}`}>
                    {p.etiqueta}
                  </span>
                  <strong>{p.nombre}</strong>
                  <em>{moneda(p.precio)}</em>
                </button>
              ))}
            </div>
          </section>
        )}

        {categorias.map((c) => (
          <section key={c.nombre} id={`cat-${c.nombre}`} data-cat={c.nombre} className="carta-seccion">
            {c.imagen_url ? (
              <div
                className="carta-seccion-portada"
                style={{ backgroundImage: `url(${c.imagen_url})` }}
              >
                <h2>{c.nombre}</h2>
              </div>
            ) : (
              <h2>{c.nombre}</h2>
            )}

            {c.productos.map((p) => (
              <article
                key={p.id}
                className={`carta-producto ${p.agotado ? "agotado" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => setDetalle(p)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setDetalle(p)}
              >
                <div className="carta-producto-texto">
                  {p.etiqueta && (
                    <span className={`carta-etiqueta ${CLASE_ETIQUETA[p.etiqueta] || ""}`}>
                      {p.etiqueta}
                    </span>
                  )}
                  <h3>{p.nombre}</h3>
                  {p.descripcion && <p>{p.descripcion}</p>}
                  <strong className="carta-precio">{moneda(p.precio)}</strong>
                </div>

                {p.imagen_url && (
                  <div className="carta-producto-foto">
                    <img src={p.imagen_url} alt={p.nombre} loading="lazy" />
                    {p.agotado && <span className="carta-agotado">Agotado</span>}
                  </div>
                )}

                {!p.imagen_url && p.agotado && <span className="carta-agotado-texto">Agotado</span>}
              </article>
            ))}
          </section>
        ))}

        {categorias.length === 0 && (
          <p className="carta-vacio">
            {filtro ? "Nada coincide con tu búsqueda" : "La carta se está preparando"}
          </p>
        )}
      </main>

      {enlaceGeneral && (
        <a
          className={`carta-whatsapp ${pegado && !detalle ? "visible" : ""}`}
          href={enlaceGeneral}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle size={18} />
          Pedir por WhatsApp
        </a>
      )}

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
              <div className="carta-modal-foto">
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
              {detalle.descripcion && <p>{detalle.descripcion}</p>}
              <strong className="carta-precio">{moneda(detalle.precio)}</strong>

              {detalle.agotado ? (
                <span className="carta-agotado-texto">Agotado por ahora</span>
              ) : (
                enlaceWhatsapp(detalle) && (
                  <a
                    className="carta-modal-pedir"
                    href={enlaceWhatsapp(detalle)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle size={18} />
                    Pedir este producto
                  </a>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}