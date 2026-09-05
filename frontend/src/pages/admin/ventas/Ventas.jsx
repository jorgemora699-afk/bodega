import { useEffect, useState } from "react";
import { Receipt, Plus, Minus, Banknote, ArrowLeftRight, CreditCard } from "lucide-react";
import { listarVentas, crearVenta, actualizarVenta, eliminarVenta } from "../../../api/ventas";
import { listarProductos } from "../../../api/productos";
import { listarTrabajadoras } from "../../../api/trabajadoras";
import "./Ventas.css";

const PERIODOS = [
  { valor: "dia", label: "Hoy" },
  { valor: "semana", label: "Esta semana" },
  { valor: "mes", label: "Este mes" },
  { valor: "todas", label: "Todas" },
];

const METODOS_PAGO = [
  { valor: "efectivo", label: "Efectivo", Icon: Banknote },
  { valor: "transferencia", label: "Transferencia", Icon: ArrowLeftRight },
  { valor: "datafono", label: "Datáfono", Icon: CreditCard },
];

function formVacio() {
  return { producto_id: "", cantidad: 1, metodo_pago: "", trabajadora_id: "" };
}

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
  const [periodo, setPeriodo] = useState("dia");

  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(formVacio());
  const [confirmandoAnular, setConfirmandoAnular] = useState(null);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarProductosYTrabajadoras();
  }, []);

  useEffect(() => {
    cargarVentas();
  }, [periodo]);

  async function cargarProductosYTrabajadoras() {
    try {
      const [productosData, trabajadorasData] = await Promise.all([
        listarProductos(),
        listarTrabajadoras(),
      ]);
      setProductos(productosData);
      setTrabajadoras(trabajadorasData);
    } catch (err) {
      setError("No se pudieron cargar productos o trabajadoras");
    }
  }

  async function cargarVentas() {
    setError(null);
    try {
      setVentas(await listarVentas(periodo));
    } catch (err) {
      setError("No se pudieron cargar las ventas");
    }
  }

  function iniciarCreacion() {
    setCreando(true);
    setEditandoId(null);
    setForm(formVacio());
    setMensaje(null);
    setError(null);
  }

  function iniciarEdicion(venta) {
    setEditandoId(venta.id);
    setCreando(false);
    setConfirmandoAnular(null);
    setMensaje(null);
    setError(null);
    setForm({
      producto_id: venta.producto_id,
      cantidad: venta.cantidad,
      metodo_pago: venta.metodo_pago,
      trabajadora_id: venta.trabajadora_id,
    });
  }

  function cancelar() {
    setCreando(false);
    setEditandoId(null);
    setForm(formVacio());
  }

  function ajustarCantidad(delta) {
    setForm((f) => ({ ...f, cantidad: Math.max(1, Number(f.cantidad) + delta) }));
  }

  async function guardar() {
    if (!form.producto_id || !form.metodo_pago || !form.trabajadora_id) {
      setError("Selecciona producto, método de pago y trabajadora");
      return;
    }

    setGuardando(true);
    setError(null);

    const payload = {
      producto_id: Number(form.producto_id),
      cantidad: Number(form.cantidad),
      metodo_pago: form.metodo_pago,
      trabajadora_id: Number(form.trabajadora_id),
    };

    try {
      if (editandoId) {
        await actualizarVenta(editandoId, payload);
        setMensaje("Venta actualizada correctamente");
      } else {
        await crearVenta(payload);
        setMensaje("Venta registrada correctamente");
      }
      cancelar();
      cargarVentas();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar la venta");
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
      cargarVentas();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo anular la venta");
    } finally {
      setGuardando(false);
    }
  }

  const formularioAbierto = creando || editandoId !== null;
  const totalPeriodo = ventas.reduce((sum, v) => sum + Number(v.total), 0);

  return (
    <div className="vad-container">
      <header className="vad-header">
        <div>
          <h1>Ventas</h1>
          <p>Historial de ventas registradas</p>
        </div>
        {!formularioAbierto && (
          <button className="vad-btn-nuevo" onClick={iniciarCreacion}>
            <Plus size={16} />
            Nueva venta
          </button>
        )}
      </header>

      {mensaje && <div className="vad-mensaje-exito">{mensaje}</div>}
      {error && <div className="vad-mensaje-error">{error}</div>}

      {formularioAbierto && (
        <div className="vad-form">
          <h2>{editandoId ? "Editar venta" : "Registrar venta"}</h2>

          <label>Producto</label>
          <select
            value={form.producto_id}
            onChange={(e) => setForm((f) => ({ ...f, producto_id: e.target.value }))}
          >
            <option value="">Selecciona...</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>

          <label>Cantidad</label>
          <div className="vad-stepper">
            <button type="button" onClick={() => ajustarCantidad(-1)}>
              <Minus size={15} />
            </button>
            <span>{form.cantidad}</span>
            <button type="button" onClick={() => ajustarCantidad(1)}>
              <Plus size={15} />
            </button>
          </div>

          <label>Método de pago</label>
          <div className="vad-metodos">
            {METODOS_PAGO.map(({ valor, label, Icon }) => (
              <button
                key={valor}
                type="button"
                className={`vad-metodo-btn ${form.metodo_pago === valor ? "activo" : ""}`}
                onClick={() => setForm((f) => ({ ...f, metodo_pago: valor }))}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          <label>Trabajadora</label>
          <select
            value={form.trabajadora_id}
            onChange={(e) => setForm((f) => ({ ...f, trabajadora_id: e.target.value }))}
          >
            <option value="">Selecciona...</option>
            {trabajadoras.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>

          <div className="vad-botones-form">
            <button className="vad-btn-secundario" onClick={cancelar} disabled={guardando}>
              Cancelar
            </button>
            <button className="vad-btn-primario" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {!formularioAbierto && (
        <>
          <div className="vad-periodos">
            {PERIODOS.map((p) => (
              <button
                key={p.valor}
                className={`vad-periodo-btn ${periodo === p.valor ? "activo" : ""}`}
                onClick={() => setPeriodo(p.valor)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="vad-resumen">
            <Receipt size={16} />
            <span>{ventas.length} venta(s)</span>
            <span className="vad-resumen-total">{formatearMoneda(totalPeriodo)}</span>
          </div>

          <div className="vad-lista">
            {ventas.map((venta) => (
              <div key={venta.id} className="vad-tarjeta">
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

                <div className="vad-fecha">{formatearFecha(venta.fecha)}</div>

                {confirmandoAnular === venta.id ? (
                  <div className="vad-confirmar-anular">
                    <span>¿Anular esta venta?</span>
                    <div className="vad-botones-form">
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
              </div>
            ))}

            {ventas.length === 0 && (
              <p className="vad-sin-ventas">No hay ventas registradas en este período</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}