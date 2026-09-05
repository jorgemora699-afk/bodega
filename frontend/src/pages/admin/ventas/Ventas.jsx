import { useEffect, useState } from "react";
import { listarVentas, actualizarVenta, eliminarVenta } from "../../../api/ventas";
import { listarProductos } from "../../../api/productos";
import { listarTrabajadoras } from "../../../api/trabajadoras";
import "./Ventas.css";

const METODOS_PAGO = ["efectivo", "transferencia", "datafono"];

function formatearFecha(isoString) {
  return new Date(isoString).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatearMoneda(valor) {
  return `$${Number(valor).toLocaleString("es-CO")}`;
}

export default function Ventas() {
  const [ventas, setVentas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [trabajadoras, setTrabajadoras] = useState([]);

  const [editandoId, setEditandoId] = useState(null);
  const [formEdicion, setFormEdicion] = useState({});
  const [confirmandoAnular, setConfirmandoAnular] = useState(null);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setError(null);
    try {
      const [ventasData, productosData, trabajadorasData] = await Promise.all([
        listarVentas(),
        listarProductos(),
        listarTrabajadoras(),
      ]);
      setVentas(ventasData);
      setProductos(productosData);
      setTrabajadoras(trabajadorasData);
    } catch (err) {
      setError("No se pudieron cargar las ventas");
    }
  }

  function iniciarEdicion(venta) {
    setEditandoId(venta.id);
    setConfirmandoAnular(null);
    setMensaje(null);
    setError(null);
    setFormEdicion({
      producto_id: venta.producto_id,
      cantidad: venta.cantidad,
      metodo_pago: venta.metodo_pago,
      trabajadora_id: venta.trabajadora_id,
    });
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setFormEdicion({});
  }

  async function guardarEdicion(ventaId) {
    setGuardando(true);
    setError(null);
    try {
      await actualizarVenta(ventaId, {
        producto_id: Number(formEdicion.producto_id),
        cantidad: Number(formEdicion.cantidad),
        metodo_pago: formEdicion.metodo_pago,
        trabajadora_id: Number(formEdicion.trabajadora_id),
      });
      setMensaje("Venta actualizada correctamente");
      setEditandoId(null);
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo actualizar la venta");
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarAnular(ventaId) {
    setGuardando(true);
    setError(null);
    try {
      await eliminarVenta(ventaId);
      setMensaje("Venta anulada, el stock fue devuelto al inventario");
      setConfirmandoAnular(null);
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo anular la venta");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="vad-container">
      <h1>Ventas</h1>

      {mensaje && <div className="vad-mensaje-exito">{mensaje}</div>}
      {error && <div className="vad-mensaje-error">{error}</div>}

      <div className="vad-lista">
        {ventas.map((venta) => (
          <div key={venta.id} className="vad-tarjeta">
            {editandoId === venta.id ? (
              <div className="vad-form-edicion">
                <label>Producto</label>
                <select
                  value={formEdicion.producto_id}
                  onChange={(e) =>
                    setFormEdicion((f) => ({ ...f, producto_id: e.target.value }))
                  }
                >
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>

                <label>Cantidad</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formEdicion.cantidad}
                  onChange={(e) =>
                    setFormEdicion((f) => ({ ...f, cantidad: e.target.value }))
                  }
                />

                <label>Método de pago</label>
                <div className="vad-metodos">
                  {METODOS_PAGO.map((metodo) => (
                    <button
                      key={metodo}
                      className={`vad-metodo-btn ${
                        formEdicion.metodo_pago === metodo ? "activo" : ""
                      }`}
                      onClick={() => setFormEdicion((f) => ({ ...f, metodo_pago: metodo }))}
                    >
                      {metodo}
                    </button>
                  ))}
                </div>

                <label>Vendido por</label>
                <select
                  value={formEdicion.trabajadora_id}
                  onChange={(e) =>
                    setFormEdicion((f) => ({ ...f, trabajadora_id: e.target.value }))
                  }
                >
                  {trabajadoras.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>

                <div className="vad-botones-edicion">
                  <button
                    className="vad-btn-secundario"
                    onClick={cancelarEdicion}
                    disabled={guardando}
                  >
                    Cancelar
                  </button>
                  <button
                    className="vad-btn-primario"
                    onClick={() => guardarEdicion(venta.id)}
                    disabled={guardando}
                  >
                    {guardando ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="vad-fila-principal">
                  <div>
                    <span className="vad-producto">{venta.producto_nombre}</span>
                    {venta.editado && <span className="vad-badge-editado">Editada</span>}
                  </div>
                  <span className="vad-total">{formatearMoneda(venta.total)}</span>
                </div>

                <div className="vad-detalle">
                  <span>{venta.cantidad} un.</span>
                  <span>·</span>
                  <span className="vad-capitalize">{venta.metodo_pago}</span>
                  <span>·</span>
                  <span>{venta.trabajadora_nombre}</span>
                </div>

                <div className="vad-detalle vad-fecha">{formatearFecha(venta.fecha)}</div>

                {confirmandoAnular === venta.id ? (
                  <div className="vad-confirmar-anular">
                    <span>¿Anular esta venta?</span>
                    <div className="vad-botones-edicion">
                      <button
                        className="vad-btn-secundario"
                        onClick={() => setConfirmandoAnular(null)}
                        disabled={guardando}
                      >
                        No
                      </button>
                      <button
                        className="vad-btn-peligro"
                        onClick={() => confirmarAnular(venta.id)}
                        disabled={guardando}
                      >
                        {guardando ? "Anulando..." : "Sí, anular"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="vad-acciones">
                    <button className="vad-btn-secundario" onClick={() => iniciarEdicion(venta)}>
                      Editar
                    </button>
                    <button
                      className="vad-btn-peligro-outline"
                      onClick={() => setConfirmandoAnular(venta.id)}
                    >
                      Anular
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {ventas.length === 0 && <p className="vad-sin-ventas">Todavía no hay ventas registradas</p>}
      </div>
    </div>
  );
}