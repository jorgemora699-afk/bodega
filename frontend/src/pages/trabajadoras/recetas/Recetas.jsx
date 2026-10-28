import { useEffect, useMemo, useState } from "react";
import { ChefHat, Scale, Search, X, UtensilsCrossed } from "lucide-react";
import { listarProductos } from "../../../api/productos";
import { listarRecetas, obtenerRecetaPorId } from "../../../api/recetas";
import "./Recetas.css";

export default function Recetas() {
  const [productos, setProductos] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [busqueda, setBusqueda] = useState("");

  const [recetaSeleccionada, setRecetaSeleccionada] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [cargandoLista, setCargandoLista] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargandoLista(true);
    setError(null);
    try {
      const [productosData, recetasData] = await Promise.all([
        listarProductos(),
        listarRecetas(),
      ]);
      setProductos(productosData);
      // Solo recetas que de verdad tienen ingredientes cargados
      setRecetas(recetasData.filter((r) => r.ingredientes?.length > 0));
    } catch (err) {
      setError("No se pudieron cargar las recetas");
    } finally {
      setCargandoLista(false);
    }
  }

  async function abrirReceta(receta) {
    setCargandoDetalle(true);
    setError(null);
    try {
      const completa = await obtenerRecetaPorId(receta.id);
      setRecetaSeleccionada(completa);
    } catch (err) {
      setError("No se pudo cargar la receta");
    } finally {
      setCargandoDetalle(false);
    }
  }

  function cerrarDetalle() {
    setRecetaSeleccionada(null);
  }

  // Combina productos (su nombre real) con recetas independientes (su propio nombre)
  const tarjetas = useMemo(() => {
    return recetas.map((r) => {
      if (r.es_standalone) {
        return {
          id: r.id,
          nombre: r.nombre,
          cantidadIngredientes: r.ingredientes.length,
          independiente: true,
        };
      }
      const producto = productos.find((p) => p.id === r.producto_id);
      return {
        id: r.id,
        nombre: producto?.nombre || r.nombre || "Producto",
        cantidadIngredientes: r.ingredientes.length,
        independiente: false,
      };
    });
  }, [recetas, productos]);

  const tarjetasFiltradas = tarjetas.filter((t) =>
    t.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="rec-container">
      <header className="rec-header">
        <h1>Recetas</h1>
        <p>Consulta los ingredientes de cada producto o preparación</p>
      </header>

      <div className="rec-buscador">
        <Search size={16} />
        <input
          type="text"
          placeholder="Buscar receta..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {error && <div className="rec-mensaje-error">{error}</div>}

      {cargandoLista && (
        <div className="rec-grid">
          <div className="rec-sk-tarjeta" />
          <div className="rec-sk-tarjeta" />
          <div className="rec-sk-tarjeta" />
          <div className="rec-sk-tarjeta" />
        </div>
      )}

      {!cargandoLista && tarjetasFiltradas.length === 0 && (
        <div className="rec-sin-receta">
          <ChefHat size={28} />
          <p>
            {busqueda
              ? "Ninguna receta coincide con la búsqueda"
              : "Todavía no hay recetas registradas"}
          </p>
        </div>
      )}

      {!cargandoLista && tarjetasFiltradas.length > 0 && (
        <div className="rec-grid">
          {tarjetasFiltradas.map((t) => (
            <button
              key={t.id}
              type="button"
              className="rec-tarjeta-producto"
              onClick={() => abrirReceta(t)}
            >
              <span className="rec-tarjeta-icono">
                {t.independiente ? <UtensilsCrossed size={20} /> : <ChefHat size={20} />}
              </span>
              <span className="rec-tarjeta-nombre">{t.nombre}</span>
              <span className="rec-tarjeta-meta">
                {t.cantidadIngredientes} ingrediente{t.cantidadIngredientes === 1 ? "" : "s"}
              </span>
              {t.independiente && <span className="rec-tarjeta-badge">Preparación base</span>}
            </button>
          ))}
        </div>
      )}

      {/* ---------- Detalle (overlay) ---------- */}

      {(recetaSeleccionada || cargandoDetalle) && (
        <div className="rec-detalle-overlay" onClick={cerrarDetalle}>
          <div className="rec-detalle-panel" onClick={(e) => e.stopPropagation()}>
            <div className="rec-detalle-header">
              <h2>
                {cargandoDetalle
                  ? "Cargando..."
                  : recetaSeleccionada.producto_id
                  ? productos.find((p) => p.id === recetaSeleccionada.producto_id)?.nombre
                  : recetaSeleccionada.nombre}
              </h2>
              <button type="button" className="rec-detalle-cerrar" onClick={cerrarDetalle}>
                <X size={18} />
              </button>
            </div>

            {cargandoDetalle ? (
              <div className="rec-detalle-skeleton">
                <div className="rec-sk-fila" />
                <div className="rec-sk-fila" />
                <div className="rec-sk-fila" />
              </div>
            ) : (
              <>
                <ul className="rec-lista">
                  {recetaSeleccionada.ingredientes.map((ing) => (
                    <li key={ing.id} className="rec-fila-vista">
                      <span className="rec-ing-icono">
                        <Scale size={15} />
                      </span>
                      <span className="rec-ing-nombre">{ing.nombre_ingrediente}</span>
                      <span className="rec-ing-cantidad">
                        {ing.cantidad} {ing.unidad}
                      </span>
                    </li>
                  ))}
                </ul>

                {recetaSeleccionada.pasos?.length > 0 && (
                  <>
                    <h3 className="rec-seccion-titulo">Preparación</h3>
                    <ol className="rec-pasos-vista">
                      {recetaSeleccionada.pasos.map((paso) => (
                        <li key={paso.id} className="rec-paso-vista">
                          <span className="rec-paso-numero">{paso.orden}</span>
                          <p>{paso.descripcion}</p>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}