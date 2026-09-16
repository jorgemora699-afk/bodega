import { useEffect, useState } from "react";
import { Pencil, Trash2, ShoppingBag, Plus, Minus, X } from "lucide-react";
import { listarVentas, actualizarVenta, eliminarVenta } from "../../../api/ventas";
import { listarOrdenes, actualizarOrden, anularOrden } from "../../../api/ordenes";
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

function formOrdenVacio() {
  return { metodo_pago: "", trabajadora_id: "", items: [] };
}

export default function Ventas() {
  const [ordenes, setOrdenes] = useState([]);
  const [ventasSueltas, setVentasSueltas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [trabajadoras, setTrabajadoras] = useState([]);

  const [editandoVentaId, setEditandoVentaId] = useState(null);
  const [formEdicion, setFormEdicion] = useState({});

  const [editandoOrdenId, setEditandoOrdenId] = useState(null);
  const [formOrden, setFormOrden] = useState(formOrdenVacio());
  const [productoParaAgregar, setProductoParaAgregar] = useState("");

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
    setEditandoOrdenId(null);
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

  // --- edición de un pedido (orden con varias líneas) ---

  function iniciarEdicionOrden(orden) {
    setEditandoOrdenId(orden.id);
    setEditandoVentaId(null);
    setConfirmandoAnular(null);
    setMensaje(null);
    setError(null);
    setProductoParaAgregar("");
    setFormOrden({
      metodo_pago: orden.metodo_pago,
      trabajadora_id: orden.trabajadora_id,
      items: orden.ventas.map((v) => ({
        producto_id: v.producto_id,
        nombre: v.producto_nombre,
        precio_unitario: v.precio_unitario,
        cantidad: v.cantidad,
      })),
    });
  }

  function cancelarEdicionOrden() {
    setEditandoOrdenId(null);
    setFormOrden(formOrdenVacio());
    setProductoParaAgregar("");
  }

  function ajustarCantidadItem(productoId, delta) {
    setFormOrden((f) => ({
      ...f,
      items: f.items
        .map((item) =>
          item.producto_id === productoId
            ? { ...item, cantidad: item.cantidad + delta }
            : item
        )
        .filter((item) => item.cantidad > 0),
    }));
  }

  function quitarItem(productoId) {
    setFormOrden((f) => ({
      ...f,
      items: f.items.filter((item) => item.producto_id !== productoId),
    }));
  }

  function agregarItem() {
    if (!productoParaAgregar) return;

    const producto = productos.find((p) => p.id === Number(productoParaAgregar));
    if (!producto) return;

    setFormOrden((f) => {
      const existente = f.items.find((item) => item.producto_id === producto.id);
      if (existente) {
        return {
          ...f,
          items: f.items.map((item) =>
            item.producto_id === producto.id
              ? { ...item, cantidad: item.cantidad + 1 }
              : item
          ),
        };
      }
      return {
        ...f,
        items: [
          ...f.items,
          {
            producto_id: producto.id,
            nombre: producto.nombre,
            precio_unitario: producto.precio_unitario,
            cantidad: 1,
          },
        ],
      };
    });
    setProductoParaAgregar("");
  }

  async function guardarEdicionOrden(ordenId) {
    if (!formOrden.metodo_pago || !formOrden.trabajadora_id) {
      setError("Selecciona método de pago y quién realiza la venta");
      return;
    }
    if (formOrden.items.length === 0) {
      setError("El pedido debe tener al menos un producto");
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      await actualizarOrden(ordenId, {
        metodo_pago: formOrden.metodo_pago,
        trabajadora_id: Number(formOrden.trabajadora_id),
        items: formOrden.items.map((i) => ({
          producto_id: i.producto_id,
          cantidad: i.cantidad,
        })),
      });
      setMensaje("Pedido actualizado correctamente");
      cancelarEdicionOrden();
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo actualizar el pedido");
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

  const totalFormOrden = formOrden.items.reduce(
    (sum, i) => sum + Number(i.precio_unitario) * i.cantidad,
    0
  );

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
            const editandoEsta = editandoOrdenId === orden.id;

            return (
              <div key={`orden-${orden.id}`} className="vad-tarjeta">
                {editandoEsta ? (
                  <div className="vad-form-edicion">
                    <label>Productos del pedido</label>
                    <div className="vad-orden-edit-items">
                      {formOrden.items.map((item) => (
                        <div key={item.producto_id} className="vad-orden-edit-item">
                          <span className="vad-orden-edit-item-nombre">{item.nombre}</span>
                          <div className="vad-orden-edit-stepper">
                            <button
                              type="button"
                              onClick={() => ajustarCantidadItem(item.producto_id, -1)}
                            >
                              <Minus size={13} />
                            </button>
                            <span>{item.cantidad}</span>
                            <button
                              type="button"
                              onClick={() => ajustarCantidadItem(item.producto_id, 1)}
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                          <span className="vad-orden-edit-subtotal">
                            {formatearMoneda(Number(item.precio_unitario) * item.cantidad)}
                          </span>
                          <button
                            type="button"
                            className="vad-orden-edit-quitar"
                            onClick={() => quitarItem(item.producto_id)}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      {formOrden.items.length === 0 && (
                        <p className="vad-orden-edit-vacio">Sin productos — agrega al menos uno</p>
                      )}
                    </div>

                    <div className="vad-orden-edit-agregar">
                      <select
                        value={productoParaAgregar}
                        onChange={(e) => setProductoParaAgregar(e.target.value)}
                      >
                        <option value="">Agregar producto...</option>
                        {productos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={agregarItem} disabled={!productoParaAgregar}>
                        <Plus size={14} />
                      </button>
                    </div>

                    <label>Método de pago</label>
                    <div className="vad-metodos">
                      {METODOS_PAGO.map((metodo) => (
                        <button
                          key={metodo}
                          className={`vad-metodo-btn ${
                            formOrden.metodo_pago === metodo ? "activo" : ""
                          }`}
                          onClick={() => setFormOrden((f) => ({ ...f, metodo_pago: metodo }))}
                        >
                          {metodo}
                        </button>
                      ))}
                    </div>

                    <label>Vendido por</label>
                    <select
                      value={formOrden.trabajadora_id}
                      onChange={(e) =>
                        setFormOrden((f) => ({ ...f, trabajadora_id: e.target.value }))
                      }
                    >
                      <option value="">Selecciona...</option>
                      {trabajadoras.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nombre}
                        </option>
                      ))}
                    </select>

                    <div className="vad-orden-edit-total">
                      <span>Total</span>
                      <span>{formatearMoneda(totalFormOrden)}</span>
                    </div>

                    <div className="vad-botones-edicion">
                      <button
                        className="vad-btn-secundario"
                        onClick={cancelarEdicionOrden}
                        disabled={guardando}
                      >
                        Cancelar
                      </button>
                      <button
                        className="vad-btn-primario"
                        onClick={() => guardarEdicionOrden(orden.id)}
                        disabled={guardando}
                      >
                        {guardando ? "Guardando..." : "Guardar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
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
                        <button className="vad-btn-secundario" onClick={() => iniciarEdicionOrden(orden)}>
                          <Pencil size={13} />
                          Editar
                        </button>
                        <button
                          className="vad-btn-peligro-outline"
                          onClick={() => setConfirmandoAnular({ tipo: "orden", id: orden.id })}
                        >
                          <Trash2 size={13} />
                          Anular pedido
                        </button>
                      </div>
                    )}
                  </>
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