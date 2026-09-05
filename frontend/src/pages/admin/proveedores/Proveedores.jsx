import { useEffect, useState } from "react";
import {
  listarProveedores,
  crearProveedor,
  actualizarProveedor,
  eliminarProveedor,
} from "../../../api/proveedores";
import { listarProductos } from "../../../api/productos";
import "./Proveedores.css";

function formVacio() {
  return { nombre: "", celular: "", notas: "", producto_ids: [] };
}

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);

  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState(formVacio());
  const [editandoId, setEditandoId] = useState(null);
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
      const [proveedoresData, productosData] = await Promise.all([
        listarProveedores(),
        listarProductos(),
      ]);
      setProveedores(proveedoresData);
      setProductos(productosData);
    } catch (err) {
      setError("No se pudieron cargar los proveedores");
    }
  }

  function toggleProducto(productoId) {
    setForm((f) => {
      const yaEsta = f.producto_ids.includes(productoId);
      return {
        ...f,
        producto_ids: yaEsta
          ? f.producto_ids.filter((id) => id !== productoId)
          : [...f.producto_ids, productoId],
      };
    });
  }

  function iniciarCreacion() {
    setCreando(true);
    setEditandoId(null);
    setForm(formVacio());
    setMensaje(null);
    setError(null);
  }

  function iniciarEdicion(proveedor) {
    setEditandoId(proveedor.id);
    setCreando(false);
    setMensaje(null);
    setError(null);
    setForm({
      nombre: proveedor.nombre,
      celular: proveedor.celular,
      notas: proveedor.notas || "",
      producto_ids: proveedor.productos.map((p) => p.id),
    });
  }

  function cancelar() {
    setCreando(false);
    setEditandoId(null);
    setForm(formVacio());
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.celular.trim()) {
      setError("Nombre y celular son obligatorios");
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      if (editandoId) {
        await actualizarProveedor(editandoId, form);
        setMensaje("Proveedor actualizado");
      } else {
        await crearProveedor(form);
        setMensaje("Proveedor creado");
      }
      cancelar();
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar el proveedor");
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminar(proveedorId) {
    setGuardando(true);
    setError(null);
    try {
      await eliminarProveedor(proveedorId);
      setMensaje("Proveedor eliminado");
      setConfirmandoEliminar(null);
      cargarDatos();
    } catch (err) {
      setError("No se pudo eliminar el proveedor");
    } finally {
      setGuardando(false);
    }
  }

  const formularioAbierto = creando || editandoId !== null;

  return (
    <div className="prov-container">
      <div className="prov-header">
        <h1>Proveedores</h1>
        {!formularioAbierto && (
          <button className="prov-btn-nuevo" onClick={iniciarCreacion}>
            + Nuevo
          </button>
        )}
      </div>

      {mensaje && <div className="prov-mensaje-exito">{mensaje}</div>}
      {error && <div className="prov-mensaje-error">{error}</div>}

      {formularioAbierto && (
        <div className="prov-form">
          <label>Nombre</label>
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          />

          <label>Celular</label>
          <input
            type="text"
            value={form.celular}
            onChange={(e) => setForm((f) => ({ ...f, celular: e.target.value }))}
          />

          <label>Notas (opcional)</label>
          <textarea
            value={form.notas}
            onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
            rows={2}
          />

          <label>Productos que suministra</label>
          <div className="prov-checks">
            {productos.map((p) => (
              <label key={p.id} className="prov-check-item">
                <input
                  type="checkbox"
                  checked={form.producto_ids.includes(p.id)}
                  onChange={() => toggleProducto(p.id)}
                />
                {p.nombre}
              </label>
            ))}
          </div>

          <div className="prov-botones">
            <button className="prov-btn-secundario" onClick={cancelar} disabled={guardando}>
              Cancelar
            </button>
            <button className="prov-btn-primario" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {!formularioAbierto && (
        <div className="prov-lista">
          {proveedores.map((prov) => (
            <div key={prov.id} className="prov-tarjeta">
              <div className="prov-fila-principal">
                <span className="prov-nombre">{prov.nombre}</span>
                <a href={`tel:${prov.celular}`} className="prov-celular">
                  {prov.celular}
                </a>
              </div>

              {prov.notas && <p className="prov-notas">{prov.notas}</p>}

              {prov.productos.length > 0 && (
                <div className="prov-productos-tags">
                  {prov.productos.map((p) => (
                    <span key={p.id} className="prov-tag">
                      {p.nombre}
                    </span>
                  ))}
                </div>
              )}

              {confirmandoEliminar === prov.id ? (
                <div className="prov-confirmar">
                  <span>¿Eliminar este proveedor?</span>
                  <div className="prov-botones">
                    <button
                      className="prov-btn-secundario"
                      onClick={() => setConfirmandoEliminar(null)}
                      disabled={guardando}
                    >
                      No
                    </button>
                    <button
                      className="prov-btn-peligro"
                      onClick={() => confirmarEliminar(prov.id)}
                      disabled={guardando}
                    >
                      Sí, eliminar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="prov-acciones">
                  <button className="prov-btn-secundario" onClick={() => iniciarEdicion(prov)}>
                    Editar
                  </button>
                  <button
                    className="prov-btn-peligro-outline"
                    onClick={() => setConfirmandoEliminar(prov.id)}
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          ))}

          {proveedores.length === 0 && (
            <p className="prov-sin-datos">Todavía no hay proveedores registrados</p>
          )}
        </div>
      )}
    </div>
  );
}