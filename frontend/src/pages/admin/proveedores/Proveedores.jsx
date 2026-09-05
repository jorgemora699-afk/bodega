import { useEffect, useState } from "react";
import { Truck, Plus, Phone, Pencil, Trash2, X, Search, Package } from "lucide-react";
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
  const [busqueda, setBusqueda] = useState("");

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

  const proveedoresFiltrados = proveedores.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="prov-container">
      <header className="prov-header">
        <div>
          <h1>Proveedores</h1>
          <p>Contactos para reabastecer el inventario</p>
        </div>
        {!formularioAbierto && (
          <button className="prov-btn-nuevo" onClick={iniciarCreacion}>
            <Plus size={16} />
            Nuevo
          </button>
        )}
      </header>

      {mensaje && <div className="prov-mensaje-exito">{mensaje}</div>}
      {error && <div className="prov-mensaje-error">{error}</div>}

      {formularioAbierto && (
        <div className="prov-form">
          <label>Nombre</label>
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            placeholder="Ej: Distribuidora Los Andes"
          />

          <label>Celular</label>
          <input
            type="text"
            value={form.celular}
            onChange={(e) => setForm((f) => ({ ...f, celular: e.target.value }))}
            placeholder="Ej: 3001234567"
          />

          <label>Notas (opcional)</label>
          <textarea
            value={form.notas}
            onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
            rows={2}
            placeholder="Ej: entrega los martes y viernes"
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
            {productos.length === 0 && (
              <p className="prov-checks-vacio">No hay productos creados todavía</p>
            )}
          </div>

          <div className="prov-botones">
            <button className="prov-btn-secundario" onClick={cancelar} disabled={guardando}>
              <X size={15} />
              Cancelar
            </button>
            <button className="prov-btn-primario" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {!formularioAbierto && (
        <>
          {proveedores.length > 0 && (
            <div className="prov-buscador">
              <Search size={16} />
              <input
                type="text"
                placeholder="Buscar proveedor..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          )}

          <div className="prov-lista">
            {proveedoresFiltrados.map((prov) => (
              <div key={prov.id} className="prov-tarjeta">
                <div className="prov-fila-principal">
                  <div className="prov-nombre-icono">
                    <div className="prov-icono-avatar">
                      <Truck size={16} />
                    </div>
                    <span className="prov-nombre">{prov.nombre}</span>
                  </div>
                  <a href={`tel:${prov.celular}`} className="prov-celular">
                    <Phone size={13} />
                    {prov.celular}
                  </a>
                </div>

                {prov.notas && <p className="prov-notas">{prov.notas}</p>}

                {prov.productos.length > 0 && (
                  <div className="prov-productos-tags">
                    {prov.productos.map((p) => (
                      <span key={p.id} className="prov-tag">
                        <Package size={11} />
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
                      <Pencil size={13} />
                      Editar
                    </button>
                    <button
                      className="prov-btn-peligro-outline"
                      onClick={() => setConfirmandoEliminar(prov.id)}
                    >
                      <Trash2 size={13} />
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            ))}

            {proveedores.length === 0 && (
              <p className="prov-sin-datos">Todavía no hay proveedores registrados</p>
            )}
            {proveedores.length > 0 && proveedoresFiltrados.length === 0 && (
              <p className="prov-sin-datos">Ningún proveedor coincide con "{busqueda}"</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}