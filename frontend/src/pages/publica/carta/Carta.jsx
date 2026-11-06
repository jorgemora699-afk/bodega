import { useEffect, useMemo, useState } from "react";
import { MapPin, Clock, MessageCircle, Search } from "lucide-react";
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
  const enlaceWhatsapp = negocio.whatsapp
    ? `https://wa.me/${negocio.whatsapp}?text=${encodeURIComponent(
        `Hola ${negocio.nombre_negocio}, quiero hacer un pedido`
      )}`
    : null;

  return (
    <div className="carta-pagina">
      <header className="carta-hero">
        <div
          className="carta-banner"
          style={negocio.banner_url ? { backgroundImage: `url(${negocio.banner_url})` } : undefined}
        />
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

      <nav className="carta-nav">
        <div className="carta-buscador">
          <Search size={15} />
          <input
            type="text"
            placeholder="Buscar en la carta..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="carta-chips">
          {categorias.map((c) => (
            <button
              key={c.nombre}
              type="button"
              className={`carta-chip ${activa === c.nombre ? "activo" : ""}`}
              onClick={() => irA(c.nombre)}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      </nav>

      <main className="carta-contenido">
        {categorias.map((c) => (
          <section key={c.nombre} id={`cat-${c.nombre}`} data-cat={c.nombre} className="carta-seccion">
            <h2>{c.nombre}</h2>

            {c.productos.map((p) => (
              <article key={p.id} className={`carta-producto ${p.agotado ? "agotado" : ""}`}>
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

      {enlaceWhatsapp && (
        <a className="carta-whatsapp" href={enlaceWhatsapp} target="_blank" rel="noreferrer">
          <MessageCircle size={18} />
          Pedir por WhatsApp
        </a>
      )}
    </div>
  );
}