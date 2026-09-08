import { useEffect, useState } from "react";
import { Receipt, Pencil, Trash2, ShoppingBag } from "lucide-react";
import { listarVentas, actualizarVenta, eliminarVenta } from "../../../api/ventas";
import { listarOrdenes, anularOrden } from "../../../api/ordenes";
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
  const [ordenes, setOrdenes] = useState([]);
  const [ventasSueltas, setVentasSueltas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [trabajadoras, setTrabajadoras] = useState([]);

  const [editandoVentaId, setEditandoVentaId] = useState(null);
  const [formEdicion, setFormEdicion] = useState({});
  const [confirmandoAnular, setConfirmandoAnular] = useState(null); // { tipo: 'orden'|'venta', id }

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setError(null);
    try {
      const [ordenesData, ventasData, productosData, trabajadorasData] = await Promise.all([
        listarOrdenes(),
        listarVentas(),
        listarProductos(),
        listarTrabajadoras(),
      ]);
      setOrdenes(ordenesData);
      setVentasSueltas(ventasData.filter((v) => v.orden_id == null));
      setProductos(productosData);
      setTrabajadoras(trabajadorasData);
    } catch (err) {
      setError("No se pudieron cargar las ventas");
    }
  }

  // --- edición de una venta suelta (sistema antiguo, un solo producto) ---

  function iniciarEdicionVenta(venta) {
    setEditandoVentaId(venta.id);
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

  function cancelarEdicionVenta() {
    setEditandoVentaId(null);
    setFormEdicion({});
  }

  async function guardarEdicionVenta(ventaId) {
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
      setEditandoVentaId(null);
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo actualizar la venta");
    } finally {
      setGuardando(false);
    }
  }

  // --- anular (orden completa o venta suelta) ---

  async function confirmarAnular() {
    if (!confirmandoAnular) return;
    setGuardando(true);
    setError(null);
    try {
      if (confirmandoAnular.tipo === "orden") {
        await anularOrden(confirmandoAnular.id);
        setMensaje("Venta anulada, el stock fue devuelto al inventario");
      } else {
        await eliminarVenta(confirmandoAnular.id);
        setMensaje("Venta anulada, el stock fue devuelto al inventario");
      }
      setConfirmandoAnular(null);
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo anular la venta");
    } finally {
      setGuardando(false);
    }
  }

  // --- combinar órdenes + ventas sueltas en una sola línea de tiempo ---

  const entradas = [
    ...ordenes.map((o) => ({ tipo: "orden", fecha: o.fecha, data: o })),
    ...ventasSueltas.map((v) => ({ tipo: "venta", fecha: v.fecha, data: v })),
  ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  return (
    <div className="vad-container">
      <header className="vad-header">
        <div>
          <h1>Ventas</h1>
          <p>Historial de pedidos y ventas registradas</p>
        </div>
      </header>

      {mensaje && <div className="vad-mensaje-exito">{mensaje}</div>}
      {error && <div className="vad-mensaje-error">{error}</div>}

      <div className="vad-lista">
        {entradas.map((entrada) => {
          if (entrada.tipo === "orden") {
            const orden = entrada.data;
            const anulandoEsta =
              confirmandoAnular?.tipo === "orden" && confirmandoAnular.id === orden.id;

            return (
              <div key={`orden-${orden.id}`} className="vad-tarjeta">
                <div className="vad-fila-principal">
                  <div className="vad-orden-titulo">
                    <ShoppingBag size={15} />
                    <span>
                      Pedido #{orden.id}
                      {orden.editado && <span className="vad-badge-editado">Editada</span>}
                    </span>
                  </div>
                  <span className="vad-total">{formatearMoneda(orden.total)}</span>
                </div>

                <div className="vad-orden-items">
                  {orden.ventas.map((v) => (
                    <div key={v.id} className="vad-orden-item">
                      <span>
                        {v.cantidad} × {v.producto_nombre}
                      </span>
                      <span>{formatearMoneda(v.total)}</span>
                    </div>
                  ))}
                </div>

                <div className="vad-detalle">
                  <span className="vad-capitalize">{orden.metodo_pago}</span>
                  <span>·</span>
                  <span>{orden.trabajadora_nombre}</span>
                </div>

                <div className="vad-detalle vad-fecha">{formatearFecha(orden.fecha)}</div>

                {anulandoEsta ? (
                  <div className="vad-confirmar-anular">
                    <span>¿Anular este pedido completo?</span>
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
                        onClick={confirmarAnular}
                        disabled={guardando}
                      >
                        {guardando ? "Anulando..." : "Sí, anular"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="vad-acciones">
                    <button
                      className="vad-btn-peligro-outline"
                      onClick={() => setConfirmandoAnular({ tipo: "orden", id: orden.id })}
                    >
                      <Trash2 size={13} />
                      Anular pedido
                    </button>
                  </div>
                )}
              </div>
            );
          }

          // venta suelta (sistema antiguo)
          const venta = entrada.data;
          const anulandoEsta =
            confirmandoAnular?.tipo === "venta" && confirmandoAnular.id === venta.id;

          return (
            <div key={`venta-${venta.id}`} className="vad-tarjeta">
              {editandoVentaId === venta.id ? (
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
                      onClick={cancelarEdicionVenta}
                      disabled={guardando}
                    >
                      Cancelar
                    </button>
                    <button
                      className="vad-btn-primario"
                      onClick={() => guardarEdicionVenta(venta.id)}
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

                  {anulandoEsta ? (
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
                          onClick={confirmarAnular}
                          disabled={guardando}
                        >
                          {guardando ? "Anulando..." : "Sí, anular"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="vad-acciones">
                      <button
                        className="vad-btn-secundario"
                        onClick={() => iniciarEdicionVenta(venta)}
                      >
                        <Pencil size={13} />
                        Editar
                      </button>
                      <button
                        className="vad-btn-peligro-outline"
                        onClick={() => setConfirmandoAnular({ tipo: "venta", id: venta.id })}
                      >
                        <Trash2 size={13} />
                        Anular
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {entradas.length === 0 && (
          <p className="vad-sin-ventas">Todavía no hay ventas registradas</p>
        )}
      </div>
    </div>
  );
}