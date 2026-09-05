import { useEffect, useState } from "react";
import {
  listarProductos,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
} from "../../../api/productos";
import "./Productos.css";

function formVacio() {
  return { nombre: "", categoria: "", precio_unitario: "", stock_actual: "" };
}

export default function Productos() {
  const [productos, setProductos] = useState([]);

  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(formVacio());
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(null);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setError(null);
    try {
      setProductos(await listarProductos());
    } catch (err) {
      setError("No se pudieron cargar los productos");
    }
  }

  function iniciarCreacion() {
    setCreando(true);
    setEditandoId(null);
    setForm(formVacio());
    setMensaje(null);
    setError(null);
  }

  function iniciarEdicion(producto) {
    setEditandoId(producto.id);
    setCreando(false);
    setMensaje(null);
    setError(null);
    setForm({
      nombre: producto.nombre,
      categoria: producto.categoria || "",
      precio_unitario: producto.precio_unitario,
      // stock_actual no se edita aquí — los cambios de stock pasan por Inventario
    });
  }

  function cancelar() {
    setCreando(false);
    setEditandoId(null);
    setForm(formVacio());
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.precio_unitario) {
      setError("Nombre y precio son obligatorios");
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      if (editandoId) {
        await actualizarProducto(editandoId, {
          nombre: form.nombre,
          categoria: form.categoria || null,
          precio_unitario: Number(form.precio_unitario),
        });
        setMensaje("Producto actualizado");
      } else {
        await crearProducto({
          nombre: form.nombre,
          categoria: form.categoria || null,
          precio_unitario: Number(form.precio_unitario),
          stock_actual: Number(form.stock_actual) || 0,
        });
        setMensaje("Producto creado");
      }
      cancelar();
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar el producto");
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminar(productoId) {
    setGuardando(true);
    setError(null);
    try {
      await eliminarProducto(productoId);
      setMensaje("Producto desactivado");
      setConfirmandoEliminar(null);
      cargarDatos();
    } catch (err) {
      setError("No se pudo desactivar el producto");
    } finally {
      setGuardando(false);
    }
  }

  const formularioAbierto = creando || editandoId !== null;

  return (
    <div className="prodad-container">
      <div className="prodad-header">
        <h1>Productos</h1>
        {!formularioAbierto && (
          <button className="prodad-btn-nuevo" onClick={iniciarCreacion}>
            + Nuevo
          </button>
        )}
      </div>

      {mensaje && <div className="prodad-mensaje-exito">{mensaje}</div>}
      {error && <div className="prodad-mensaje-error">{error}</div>}

      {formularioAbierto && (
        <div className="prodad-form">
          <label>Nombre</label>
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          />

          <label>Categoría (opcional)</label>
          <input
            type="text"
            value={form.categoria}
            onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
            placeholder="Ej: congelados"
          />

          <label>Precio unitario</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.precio_unitario}
            onChange={(e) => setForm((f) => ({ ...f, precio_unitario: e.target.value }))}
          />

          {creando && (
            <>
              <label>Stock inicial</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.stock_actual}
                onChange={(e) => setForm((f) => ({ ...f, stock_actual: e.target.value }))}
              />
            </>
          )}

          {editandoId && (
            <p className="prodad-nota-stock">
              Para cambiar el stock, usa la sección de Inventario.
            </p>
          )}

          <div className="prodad-botones">
            <button className="prodad-btn-secundario" onClick={cancelar} disabled={guardando}>
              Cancelar
            </button>
            <button className="prodad-btn-primario" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {!formularioAbierto && (
        <div className="prodad-lista">
          {productos.map((p) => (
            <div key={p.id} className="prodad-tarjeta">
              <div className="prodad-fila-principal">
                <div>
                  <span className="prodad-nombre">{p.nombre}</span>
                  {p.categoria && <span className="prodad-categoria">{p.categoria}</span>}
                </div>
                <span className="prodad-precio">
                  ${Number(p.precio_unitario).toLocaleString("es-CO")}
                </span>
              </div>

              <div className="prodad-stock">Stock actual: {p.stock_actual}</div>

              {confirmandoEliminar === p.id ? (
                <div className="prodad-confirmar">
                  <span>¿Desactivar este producto?</span>
                  <div className="prodad-botones">
                    <button
                      className="prodad-btn-secundario"
                      onClick={() => setConfirmandoEliminar(null)}
                      disabled={guardando}
                    >
                      No
                    </button>
                    <button
                      className="prodad-btn-peligro"
                      onClick={() => confirmarEliminar(p.id)}
                      disabled={guardando}
                    >
                      Sí, desactivar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="prodad-acciones">
                  <button className="prodad-btn-secundario" onClick={() => iniciarEdicion(p)}>
                    Editar
                  </button>
                  <button
                    className="prodad-btn-peligro-outline"
                    onClick={() => setConfirmandoEliminar(p.id)}
                  >
                    Desactivar
                  </button>
                </div>
              )}
            </div>
          ))}

          {productos.length === 0 && (
            <p className="prodad-sin-datos">Todavía no hay productos registrados</p>
          )}
        </div>
      )}
    </div>
  );
}