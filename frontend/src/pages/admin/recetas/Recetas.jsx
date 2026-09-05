import { useEffect, useState } from "react";
import { listarProductos } from "../../../api/productos";
import { obtenerReceta, guardarReceta } from "../../../api/recetas";
import "./Recetas.css";

const UNIDADES = ["g", "kg", "ml", "l", "unidad"];

function ingredienteVacio() {
  return { nombre_ingrediente: "", cantidad: "", unidad: "g" };
}

export default function Recetas() {
  const [productos, setProductos] = useState([]);
  const [productoId, setProductoId] = useState("");
  const [ingredientes, setIngredientes] = useState([ingredienteVacio()]);

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
      return;
    }
    cargarReceta(productoId);
  }, [productoId]);

  async function cargarReceta(id) {
    setCargando(true);
    setMensaje(null);
    setError(null);
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
      } else {
        setIngredientes([ingredienteVacio()]);
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
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar la receta");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rec-container">
      <h1>Recetas</h1>

      <label>Producto</label>
      <select value={productoId} onChange={(e) => setProductoId(e.target.value)}>
        <option value="">Selecciona un producto...</option>
        {productos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </select>

      {mensaje && <div className="rec-mensaje-exito">{mensaje}</div>}
      {error && <div className="rec-mensaje-error">{error}</div>}

      {productoId && !cargando && (
        <div className="rec-form">
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
                  ✕
                </button>
              )}
            </div>
          ))}

          <button className="rec-btn-agregar" onClick={agregarFila}>
            + Agregar ingrediente
          </button>

          <button className="rec-btn-guardar" onClick={handleGuardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar receta"}
          </button>
        </div>
      )}
    </div>
  );
}