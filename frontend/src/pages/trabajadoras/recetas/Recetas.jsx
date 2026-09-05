import { useEffect, useState } from "react";
import { ChefHat, Scale } from "lucide-react";
import { listarProductos } from "../../../api/productos";
import { obtenerReceta } from "../../../api/recetas";
import "./Recetas.css";

export default function Recetas() {
  const [productos, setProductos] = useState([]);
  const [productoId, setProductoId] = useState("");
  const [receta, setReceta] = useState(null);

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    listarProductos().then(setProductos).catch(() => setError("No se pudieron cargar los productos"));
  }, []);

  useEffect(() => {
    if (!productoId) {
      setReceta(null);
      return;
    }
    cargarReceta(productoId);
  }, [productoId]);

  async function cargarReceta(id) {
    setCargando(true);
    setError(null);
    try {
      const data = await obtenerReceta(id);
      setReceta(data);
    } catch (err) {
      setError("No se pudo cargar la receta");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="rec-container">
      <header className="rec-header">
        <h1>Recetas</h1>
        <p>Consulta los ingredientes de cada producto</p>
      </header>

      <label className="rec-label">Producto</label>
      <select className="rec-select" value={productoId} onChange={(e) => setProductoId(e.target.value)}>
        <option value="">Selecciona un producto...</option>
        {productos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </select>

      {error && <div className="rec-mensaje-error">{error}</div>}

      {productoId && !cargando && (
        <div className="rec-vista">
          {receta === null || receta.ingredientes.length === 0 ? (
            <div className="rec-sin-receta">
              <ChefHat size={28} />
              <p>Este producto todavía no tiene receta registrada</p>
            </div>
          ) : (
            <ul className="rec-lista">
              {receta.ingredientes.map((ing) => (
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
          )}
        </div>
      )}
    </div>
  );
}