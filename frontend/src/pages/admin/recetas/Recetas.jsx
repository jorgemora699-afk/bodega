import { useEffect, useState } from "react";
import { ChefHat, Plus, Trash2, X, Search, ListChecks } from "lucide-react";
import {
  obtenerReceta,
  guardarReceta,
  eliminarReceta,
  listarRecetas,
  crearRecetaStandalone,
  actualizarRecetaPorId,
  eliminarRecetaPorId,
} from "../../../api/recetas";
import { listarProductos } from "../../../api/productos";
import "./Recetas.css";

const UNIDADES = ["g", "kg", "ml", "l", "unidad"];

function ingredienteVacio() {
  return { nombre_ingrediente: "", cantidad: "", unidad: "g" };
}

export default function Recetas() {
  const [modo, setModo] = useState("producto"); // "producto" | "independiente"

  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [productoId, setProductoId] = useState("");

  const [recetasStandalone, setRecetasStandalone] = useState([]);
  const [busquedaStandalone, setBusquedaStandalone] = useState("");
  const [recetaId, setRecetaId] = useState(null); // null = nueva receta sin producto
  const [nombreStandalone, setNombreStandalone] = useState("");

  const [ingredientes, setIngredientes] = useState([ingredienteVacio()]);
  const [tieneReceta, setTieneReceta] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);

  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    listarProductos().then(setProductos).catch(() => setError("No se pudieron cargar los productos"));
    cargarRecetasStandalone();
  }, []);

  async function cargarRecetasStandalone() {
    try {
      const todas = await listarRecetas();
      setRecetasStandalone(todas.filter((r) => r.es_standalone));
    } catch (err) {
      setRecetasStandalone([]);
    }
  }

  /* ---------- Modo "por producto" (igual que antes) ---------- */

  useEffect(() => {
    if (modo !== "producto") return;
    if (!productoId) {
      setIngredientes([ingredienteVacio()]);
      setTieneReceta(false);
      return;
    }
    cargarRecetaDeProducto(productoId);
  }, [productoId, modo]);

  async function cargarRecetaDeProducto(id) {
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

  /* ---------- Modo "independiente" (sin producto) ---------- */

  function iniciarRecetaStandaloneNueva() {
    setRecetaId(null);
    setNombreStandalone("");
    setIngredientes([ingredienteVacio()]);
    setTieneReceta(false);
    setMensaje(null);
    setError(null);
    setConfirmandoEliminar(false);
  }

  async function abrirRecetaStandalone(receta) {
    setCargando(true);
    setMensaje(null);
    setError(null);
    setConfirmandoEliminar(false);
    try {
      const completa = await obtenerRecetaPorId(receta.id);
      setRecetaId(completa.id);
      setNombreStandalone(completa.nombre || "");
      setIngredientes(
        completa.ingredientes.length > 0
          ? completa.ingredientes.map((i) => ({
              nombre_ingrediente: i.nombre_ingrediente,
              cantidad: i.cantidad,
              unidad: i.unidad,
            }))
          : [ingredienteVacio()]
      );
      setTieneReceta(true);
    } catch (err) {
      setError("No se pudo cargar la receta");
    } finally {
      setCargando(false);
    }
  }

  function cambiarModo(nuevoModo) {
    setModo(nuevoModo);
    setMensaje(null);
    setError(null);
    setConfirmandoEliminar(false);

    if (nuevoModo === "producto") {
      setProductoId("");
      setIngredientes([ingredienteVacio()]);
      setTieneReceta(false);
    } else {
      iniciarRecetaStandaloneNueva();
    }
  }

  /* ---------- Ingredientes (compartido entre ambos modos) ---------- */

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

  /* ---------- Guardar ---------- */

  async function handleGuardar() {
    const validos = ingredientes.filter(
      (i) => i.nombre_ingrediente.trim() && i.cantidad
    );

    if (validos.length === 0) {
      setError("Agrega al menos un ingrediente con nombre y cantidad");
      return;
    }

    const ingredientesLimpios = validos.map((i) => ({
      nombre_ingrediente: i.nombre_ingrediente.trim(),
      cantidad: Number(i.cantidad),
      unidad: i.unidad,
    }));

    if (modo === "producto") {
      if (!productoId) {
        setError("Selecciona un producto");
        return;
      }

      setGuardando(true);
      setError(null);
      setMensaje(null);
      try {
        await guardarReceta(productoId, ingredientesLimpios);
        setMensaje("Receta guardada correctamente");
        setTieneReceta(true);
      } catch (err) {
        setError(err.response?.data?.error || "No se pudo guardar la receta");
      } finally {
        setGuardando(false);
      }
      return;
    }

    // modo === "independiente"
    if (!nombreStandalone.trim()) {
      setError("Ingresa un nombre para esta receta");
      return;
    }

    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      if (recetaId) {
        await actualizarRecetaPorId(recetaId, nombreStandalone.trim(), ingredientesLimpios);
        setMensaje("Receta actualizada correctamente");
      } else {
        const creada = await crearRecetaStandalone(nombreStandalone.trim(), ingredientesLimpios);
        setRecetaId(creada.id);
        setMensaje("Receta creada correctamente");
      }
      setTieneReceta(true);
      cargarRecetasStandalone();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar la receta");
    } finally {
      setGuardando(false);
    }
  }

  /* ---------- Eliminar ---------- */

  async function handleEliminar() {
    setGuardando(true);
    setError(null);
    try {
      if (modo === "producto") {
        await eliminarReceta(productoId);
      } else {
        await eliminarRecetaPorId(recetaId);
        iniciarRecetaStandaloneNueva();
        cargarRecetasStandalone();
      }
      setMensaje("Receta eliminada");
      if (modo === "producto") {
        setIngredientes([ingredienteVacio()]);
        setTieneReceta(false);
      }
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

  const recetasStandaloneFiltradas = recetasStandalone.filter((r) =>
    (r.nombre || "").toLowerCase().includes(busquedaStandalone.toLowerCase())
  );

  const mostrarFormulario =
    (modo === "producto" && productoId && !cargando) ||
    (modo === "independiente" && !cargando);

  return (
    <div className="rec-container">
      <header className="rec-header">
        <div>
          <h1>Recetas</h1>
          <p>Ingredientes y cantidades por producto</p>
        </div>
      </header>

      <div className="rec-modo-toggle">
        <button
          type="button"
          className={`rec-modo-btn ${modo === "producto" ? "activo" : ""}`}
          onClick={() => cambiarModo("producto")}
        >
          Por producto
        </button>
        <button
          type="button"
          className={`rec-modo-btn ${modo === "independiente" ? "activo" : ""}`}
          onClick={() => cambiarModo("independiente")}
        >
          Sin producto
        </button>
      </div>

      {mensaje && <div className="rec-mensaje-exito">{mensaje}</div>}
      {error && <div className="rec-mensaje-error">{error}</div>}

      {modo === "producto" && (
        <>
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

          {!productoId && (
            <div className="rec-vacio">
              <ChefHat size={28} />
              <p>Selecciona un producto para ver o crear su receta</p>
            </div>
          )}
        </>
      )}

      {modo === "independiente" && (
        <>
          <div className="rec-buscador">
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar receta guardada..."
              value={busquedaStandalone}
              onChange={(e) => setBusquedaStandalone(e.target.value)}
            />
          </div>

          {recetasStandaloneFiltradas.length > 0 && (
            <div className="rec-lista-standalone">
              {recetasStandaloneFiltradas.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`rec-standalone-item ${recetaId === r.id ? "activo" : ""}`}
                  onClick={() => abrirRecetaStandalone(r)}
                >
                  {r.nombre}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            className="rec-btn-agregar"
            onClick={iniciarRecetaStandaloneNueva}
          >
            <Plus size={14} />
            Nueva receta sin producto
          </button>

          <label className="rec-label">Nombre de la receta</label>
          <input
            type="text"
            value={nombreStandalone}
            onChange={(e) => setNombreStandalone(e.target.value)}
            placeholder="Ej: Salsa napolitana"
          />
        </>
      )}

      {mostrarFormulario && (
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
    </div>
  );
}