import { useEffect, useState } from "react";
import { ChefHat, Plus, Trash2, X, Search, ListChecks } from "lucide-react";
import { obtenerReceta, guardarReceta, eliminarReceta } from "../../../api/recetas";
import { listarProductos } from "../../../api/productos";
import "./Recetas.css";

const UNIDADES = ["g", "kg", "ml", "l", "unidad"];

function ingredienteVacio() {
  return { nombre_ingrediente: "", cantidad: "", unidad: "g" };
}

export default function Recetas() {
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [productoId, setProductoId] = useState("");
  const [ingredientes, setIngredientes] = useState([ingredienteVacio()]);
  const [tieneReceta, setTieneReceta] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);

  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    listarProductos().then(setProductos).catch(() => setError("No se pudieron cargar los productos"));
  }, []);

  useEffect(() => {
    if (!productoId) {
      setIngredientes([ingredienteVacio()]);
      setTieneReceta(false);
      return;
    }
    cargarReceta(productoId);
  }, [productoId]);

  async function cargarReceta(id) {
    setCargando(true);
    setMensaje(null);
    setError(null);
    setConfirmandoEliminar(false);
    try {
      const receta = await obtenerReceta(id);
      if (receta && receta.ingredientes.length > 0) {
        setIngredientes(
          receta.ingredientes.map((i) => ({
            nombre_ingrediente: i.nombre_ingrediente,
            cantidad: i.cantidad,
            unidad: i.unidad,
          }))
        );
        setTieneReceta(true);
      } else {
        setIngredientes([ingredienteVacio()]);
        setTieneReceta(false);
      }
    } catch (err) {
      setError("No se pudo cargar la receta");
    } finally {
      setCargando(false);
    }
  }

  function actualizarIngrediente(index, campo, valor) {
    setIngredientes((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, [campo]: valor } : ing))
    );
  }

  function agregarFila() {
    setIngredientes((prev) => [...prev, ingredienteVacio()]);
  }

  function quitarFila(index) {
    setIngredientes((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleGuardar() {
    const validos = ingredientes.filter(
      (i) => i.nombre_ingrediente.trim() && i.cantidad
    );

    if (validos.length === 0) {
      setError("Agrega al menos un ingrediente con nombre y cantidad");
      return;
    }

    setGuardando(true);
    setError(null);
    setMensaje(null);

    try {
      await guardarReceta(
        productoId,
        validos.map((i) => ({
          nombre_ingrediente: i.nombre_ingrediente.trim(),
          cantidad: Number(i.cantidad),
          unidad: i.unidad,
        }))
      );
      setMensaje("Receta guardada correctamente");
      setTieneReceta(true);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar la receta");
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar() {
    setGuardando(true);
    setError(null);
    try {
      await eliminarReceta(productoId);
      setMensaje("Receta eliminada");
      setIngredientes([ingredienteVacio()]);
      setTieneReceta(false);
      setConfirmandoEliminar(false);
    } catch (err) {
      setError("No se pudo eliminar la receta");
    } finally {
      setGuardando(false);
    }
  }

  const productosFiltrados = productos.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="rec-container">
      <header className="rec-header">
        <div>
          <h1>Recetas</h1>
          <p>Ingredientes y cantidades por producto</p>
        </div>
      </header>

      {mensaje && <div className="rec-mensaje-exito">{mensaje}</div>}
      {error && <div className="rec-mensaje-error">{error}</div>}

      <div className="rec-buscador">
        <Search size={16} />
        <input
          type="text"
          placeholder="Buscar producto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <label className="rec-label">Producto</label>
      <select value={productoId} onChange={(e) => setProductoId(e.target.value)}>
        <option value="">Selecciona un producto...</option>
        {productosFiltrados.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </select>

      {productoId && !cargando && (
        <div className="rec-form">
          <div className="rec-form-titulo">
            <ListChecks size={15} />
            Ingredientes
          </div>

          {ingredientes.map((ing, index) => (
            <div key={index} className="rec-fila">
              <input
                type="text"
                placeholder="Ingrediente"
                value={ing.nombre_ingrediente}
                onChange={(e) => actualizarIngrediente(index, "nombre_ingrediente", e.target.value)}
              />
              <input
                type="number"
                placeholder="Cant."
                value={ing.cantidad}
                onChange={(e) => actualizarIngrediente(index, "cantidad", e.target.value)}
              />
              <select
                value={ing.unidad}
                onChange={(e) => actualizarIngrediente(index, "unidad", e.target.value)}
              >
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              {ingredientes.length > 1 && (
                <button className="rec-btn-quitar" onClick={() => quitarFila(index)}>
                  <X size={14} />
                </button>
              )}
            </div>
          ))}

          <button className="rec-btn-agregar" onClick={agregarFila}>
            <Plus size={14} />
            Agregar ingrediente
          </button>

          <div className="rec-botones-principales">
            <button className="rec-btn-guardar" onClick={handleGuardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar receta"}
            </button>

            {tieneReceta && !confirmandoEliminar && (
              <button
                className="rec-btn-eliminar-outline"
                onClick={() => setConfirmandoEliminar(true)}
                disabled={guardando}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          {confirmandoEliminar && (
            <div className="rec-confirmar">
              <span>¿Eliminar esta receta por completo?</span>
              <div className="rec-confirmar-botones">
                <button
                  className="rec-btn-secundario"
                  onClick={() => setConfirmandoEliminar(false)}
                  disabled={guardando}
                >
                  No
                </button>
                <button className="rec-btn-eliminar" onClick={handleEliminar} disabled={guardando}>
                  {guardando ? "Eliminando..." : "Sí, eliminar"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!productoId && (
        <div className="rec-vacio">
          <ChefHat size={28} />
          <p>Selecciona un producto para ver o crear su receta</p>
        </div>
      )}
    </div>
  );
}