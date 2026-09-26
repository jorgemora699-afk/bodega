import { useEffect, useMemo, useState } from "react";
import { ChefHat, Plus, Trash2, X, Search, ListChecks, Check, PackageSearch } from "lucide-react";
import {
  obtenerReceta,
  guardarReceta,
  eliminarReceta,
  listarRecetas,
  crearRecetaStandalone,
  obtenerRecetaPorId,
  actualizarRecetaPorId,
  eliminarRecetaPorId,
} from "../../../api/recetas";
import { listarProductos } from "../../../api/productos";
import "./Recetas.css";

const UNIDADES = ["g", "kg", "ml", "l", "unidad"];

function ingredienteVacio() {
  return { nombre_ingrediente: "", cantidad: "", unidad: "g" };
}

function snapshotDe(ingredientes, nombre = "") {
  return JSON.stringify({ ingredientes, nombre });
}

export default function Recetas() {
  const [modo, setModo] = useState("producto"); // "producto" | "independiente"

  const [productos, setProductos] = useState([]);
  const [recetasTodas, setRecetasTodas] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [busquedaLista, setBusquedaLista] = useState("");

  const [productoId, setProductoId] = useState("");
  const [recetaId, setRecetaId] = useState(null); // null = nueva receta sin producto
  const [nombreStandalone, setNombreStandalone] = useState("");

  const [ingredientes, setIngredientes] = useState([ingredienteVacio()]);
  const [tieneReceta, setTieneReceta] = useState(false);
  const [snapshotGuardado, setSnapshotGuardado] = useState(snapshotDe([ingredienteVacio()]));

  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);

  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    setCargandoLista(true);
    try {
      const [productosData, recetasData] = await Promise.all([
        listarProductos(),
        listarRecetas(),
      ]);
      setProductos(productosData);
      setRecetasTodas(recetasData);
    } catch (err) {
      setError("No se pudieron cargar los datos");
    } finally {
      setCargandoLista(false);
    }
  }

  const recetasStandalone = useMemo(
    () => recetasTodas.filter((r) => r.es_standalone),
    [recetasTodas]
  );

  const productoIdsConReceta = useMemo(
    () =>
      new Set(
        recetasTodas.filter((r) => !r.es_standalone).map((r) => r.producto_id)
      ),
    [recetasTodas]
  );

  /* ---------- Modo "por producto" ---------- */

  useEffect(() => {
    if (modo !== "producto") return;
    if (!productoId) {
      setIngredientes([ingredienteVacio()]);
      setSnapshotGuardado(snapshotDe([ingredienteVacio()]));
      setTieneReceta(false);
      return;
    }
    cargarRecetaDeProducto(productoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoId, modo]);

  async function cargarRecetaDeProducto(id) {
    setCargando(true);
    setMensaje(null);
    setError(null);
    setConfirmandoEliminar(false);
    try {
      const receta = await obtenerReceta(id);
      if (receta && receta.ingredientes.length > 0) {
        const lista = receta.ingredientes.map((i) => ({
          nombre_ingrediente: i.nombre_ingrediente,
          cantidad: i.cantidad,
          unidad: i.unidad,
        }));
        setIngredientes(lista);
        setSnapshotGuardado(snapshotDe(lista));
        setTieneReceta(true);
      } else {
        setIngredientes([ingredienteVacio()]);
        setSnapshotGuardado(snapshotDe([ingredienteVacio()]));
        setTieneReceta(false);
      }
    } catch (err) {
      // 404 = todavía no tiene receta, no es un error real
      setIngredientes([ingredienteVacio()]);
      setSnapshotGuardado(snapshotDe([ingredienteVacio()]));
      setTieneReceta(false);
    } finally {
      setCargando(false);
    }
  }

  /* ---------- Modo "independiente" ---------- */

  function iniciarRecetaStandaloneNueva() {
    setRecetaId(null);
    setNombreStandalone("");
    setIngredientes([ingredienteVacio()]);
    setSnapshotGuardado(snapshotDe([ingredienteVacio()], ""));
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
      const lista =
        completa.ingredientes.length > 0
          ? completa.ingredientes.map((i) => ({
              nombre_ingrediente: i.nombre_ingrediente,
              cantidad: i.cantidad,
              unidad: i.unidad,
            }))
          : [ingredienteVacio()];

      setRecetaId(completa.id);
      setNombreStandalone(completa.nombre || "");
      setIngredientes(lista);
      setSnapshotGuardado(snapshotDe(lista, completa.nombre || ""));
      setTieneReceta(true);
    } catch (err) {
      setError("No se pudo cargar la receta");
    } finally {
      setCargando(false);
    }
  }

  function cambiarModo(nuevoModo) {
    if (nuevoModo === modo) return;
    setModo(nuevoModo);
    setBusquedaLista("");
    setMensaje(null);
    setError(null);
    setConfirmandoEliminar(false);

    if (nuevoModo === "producto") {
      setProductoId("");
      setIngredientes([ingredienteVacio()]);
      setSnapshotGuardado(snapshotDe([ingredienteVacio()]));
      setTieneReceta(false);
    } else {
      iniciarRecetaStandaloneNueva();
    }
  }

  /* ---------- Ingredientes ---------- */

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
        setSnapshotGuardado(snapshotDe(ingredientesLimpios));
        cargarTodo();
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
      setSnapshotGuardado(snapshotDe(ingredientesLimpios, nombreStandalone.trim()));
      cargarTodo();
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
        setIngredientes([ingredienteVacio()]);
        setSnapshotGuardado(snapshotDe([ingredienteVacio()]));
        setTieneReceta(false);
      } else {
        await eliminarRecetaPorId(recetaId);
        iniciarRecetaStandaloneNueva();
      }
      setMensaje("Receta eliminada");
      setConfirmandoEliminar(false);
      cargarTodo();
    } catch (err) {
      setError("No se pudo eliminar la receta");
    } finally {
      setGuardando(false);
    }
  }

  /* ---------- Derivados ---------- */

  const productosFiltrados = productos.filter((p) =>
    p.nombre.toLowerCase().includes(busquedaLista.toLowerCase())
  );

  const recetasStandaloneFiltradas = recetasStandalone.filter((r) =>
    (r.nombre || "").toLowerCase().includes(busquedaLista.toLowerCase())
  );

  const productoSeleccionado = productos.find((p) => p.id === Number(productoId));

  const nombreEnEncabezado =
    modo === "producto" ? productoSeleccionado?.nombre : nombreStandalone || "Nueva receta";

  const ingredientesValidos = ingredientes.filter(
    (i) => i.nombre_ingrediente.trim() && i.cantidad
  ).length;

  const snapshotActual =
    modo === "producto" ? snapshotDe(ingredientes) : snapshotDe(ingredientes, nombreStandalone);
  const hayCambiosSinGuardar = snapshotActual !== snapshotGuardado;

  const mostrarPanelDetalle =
    (modo === "producto" && productoId) || modo === "independiente";

  return (
    <div className="rec-container">
      <header className="rec-header">
        <div>
          <h1>Recetas</h1>
          <p>Ingredientes y cantidades por producto, o recetas base independientes</p>
        </div>
      </header>

      {mensaje && <div className="rec-mensaje-exito"><Check size={14} /> {mensaje}</div>}
      {error && <div className="rec-mensaje-error">{error}</div>}

      <div className="rec-segmented">
        <button
          type="button"
          className={`rec-segmented-btn ${modo === "producto" ? "activo" : ""}`}
          onClick={() => cambiarModo("producto")}
        >
          Por producto
        </button>
        <button
          type="button"
          className={`rec-segmented-btn ${modo === "independiente" ? "activo" : ""}`}
          onClick={() => cambiarModo("independiente")}
        >
          Sin producto
        </button>
      </div>

      <div className="rec-layout">
        {/* ================= SIDEBAR ================= */}

        <aside className="rec-sidebar">
          <div className="rec-buscador">
            <Search size={15} />
            <input
              type="text"
              placeholder={modo === "producto" ? "Buscar producto..." : "Buscar receta..."}
              value={busquedaLista}
              onChange={(e) => setBusquedaLista(e.target.value)}
            />
          </div>

          {modo === "independiente" && (
            <button
              type="button"
              className="rec-btn-nueva-sidebar"
              onClick={iniciarRecetaStandaloneNueva}
            >
              <Plus size={14} />
              Nueva receta sin producto
            </button>
          )}

          <div className="rec-lista-sidebar">
            {cargandoLista && (
              <>
                <div className="rec-sk-item" />
                <div className="rec-sk-item" />
                <div className="rec-sk-item" />
              </>
            )}

            {!cargandoLista && modo === "producto" &&
              productosFiltrados.map((p) => {
                const tiene = productoIdsConReceta.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`rec-item-sidebar ${productoId === Number(p.id) || productoId === String(p.id) ? "activo" : ""}`}
                    onClick={() => setProductoId(String(p.id))}
                  >
                    <span className="rec-item-nombre">{p.nombre}</span>
                    <span className={`rec-item-tag ${tiene ? "con-receta" : "sin-receta"}`}>
                      {tiene ? "Con receta" : "Sin receta"}
                    </span>
                  </button>
                );
              })}

            {!cargandoLista && modo === "producto" && productosFiltrados.length === 0 && (
              <p className="rec-lista-sin-resultados">Ningún producto coincide</p>
            )}

            {!cargandoLista && modo === "independiente" &&
              recetasStandaloneFiltradas.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`rec-item-sidebar ${recetaId === r.id ? "activo" : ""}`}
                  onClick={() => abrirRecetaStandalone(r)}
                >
                  <span className="rec-item-nombre">{r.nombre}</span>
                  <span className="rec-item-tag neutro">
                    {r.ingredientes?.length || 0} ingr.
                  </span>
                </button>
              ))}

            {!cargandoLista && modo === "independiente" && recetasStandaloneFiltradas.length === 0 && (
              <p className="rec-lista-sin-resultados">
                {busquedaLista ? "Ninguna receta coincide" : "Todavía no hay recetas independientes"}
              </p>
            )}
          </div>
        </aside>

        {/* ================= DETALLE ================= */}

        <main className="rec-detalle">
          {!mostrarPanelDetalle && (
            <div className="rec-vacio">
              <PackageSearch size={30} />
              <p>Selecciona un producto de la lista para ver o crear su receta</p>
            </div>
          )}

          {mostrarPanelDetalle && cargando && (
            <div className="rec-form">
              <div className="rec-sk-linea" style={{ width: "60%" }} />
              <div className="rec-sk-linea" style={{ width: "35%" }} />
              <div className="rec-sk-tabla" />
            </div>
          )}

          {mostrarPanelDetalle && !cargando && (
            <div className="rec-form">
              <div className="rec-detalle-header">
                <div className="rec-detalle-header-info">
                  <span className={`rec-badge ${modo === "producto" ? "vinculada" : "independiente"}`}>
                    {modo === "producto" ? "Vinculada a producto" : "Receta independiente"}
                  </span>
                  <h2>{nombreEnEncabezado}</h2>
                  <span className="rec-detalle-contador">
                    <ListChecks size={13} />
                    {ingredientesValidos} ingrediente{ingredientesValidos === 1 ? "" : "s"}
                  </span>
                </div>

                {hayCambiosSinGuardar && (
                  <span className="rec-pill-cambios">Cambios sin guardar</span>
                )}
              </div>

              {modo === "independiente" && (
                <>
                  <label className="rec-label">Nombre de la receta</label>
                  <input
                    type="text"
                    className="rec-input-nombre"
                    value={nombreStandalone}
                    onChange={(e) => setNombreStandalone(e.target.value)}
                    placeholder="Ej: Salsa napolitana"
                  />
                </>
              )}

              <table className="rec-tabla">
                <thead>
                  <tr>
                    <th>Ingrediente</th>
                    <th>Cantidad</th>
                    <th>Unidad</th>
                    <th aria-hidden="true"></th>
                  </tr>
                </thead>
                <tbody>
                  {ingredientes.map((ing, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          type="text"
                          placeholder="Ingrediente"
                          value={ing.nombre_ingrediente}
                          onChange={(e) =>
                            actualizarIngrediente(index, "nombre_ingrediente", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          placeholder="Cant."
                          value={ing.cantidad}
                          onChange={(e) => actualizarIngrediente(index, "cantidad", e.target.value)}
                        />
                      </td>
                      <td>
                        <select
                          className={`rec-select-unidad rec-unidad-${ing.unidad}`}
                          value={ing.unidad}
                          onChange={(e) => actualizarIngrediente(index, "unidad", e.target.value)}
                        >
                          {UNIDADES.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {ingredientes.length > 1 && (
                          <button
                            type="button"
                            className="rec-btn-quitar"
                            onClick={() => quitarFila(index)}
                            aria-label="Quitar ingrediente"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button type="button" className="rec-btn-agregar" onClick={agregarFila}>
                <Plus size={14} />
                Agregar ingrediente
              </button>

              <div className="rec-botones-principales">
                <button className="rec-btn-guardar" onClick={handleGuardar} disabled={guardando}>
                  {guardando ? "Guardando..." : "Guardar receta"}
                </button>

                {tieneReceta && (
                  <button
                    type="button"
                    className="rec-btn-eliminar-outline"
                    onClick={() => setConfirmandoEliminar(true)}
                    disabled={guardando}
                    aria-label="Eliminar receta"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ================= MODAL ELIMINAR ================= */}

      {confirmandoEliminar && (
        <div className="rec-modal-overlay" onClick={() => setConfirmandoEliminar(false)}>
          <div className="rec-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rec-modal-icono">
              <Trash2 size={20} />
            </div>
            <h3>¿Eliminar esta receta?</h3>
            <p>Se eliminará permanentemente junto con todos sus ingredientes. Esta acción no se puede deshacer.</p>
            <div className="rec-modal-botones">
              <button
                className="rec-btn-secundario"
                onClick={() => setConfirmandoEliminar(false)}
                disabled={guardando}
              >
                Cancelar
              </button>
              <button className="rec-btn-eliminar" onClick={handleEliminar} disabled={guardando}>
                {guardando ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}