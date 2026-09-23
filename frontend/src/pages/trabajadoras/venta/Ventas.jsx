import { useEffect, useState } from "react";
import { ShoppingBag, Check, Clock3, Calendar } from "lucide-react";
import { listarOrdenes, marcarOrdenPagada } from "../../../api/ordenes";
import "./Ventas.css";

function formatearFecha(isoString) {
  return new Date(isoString).toLocaleString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatearMoneda(valor) {
  return `$${Number(valor).toLocaleString("es-CO")}`;
}

function hoyISO() {
  const hoy = new Date();
  const offset = hoy.getTimezoneOffset();
  const local = new Date(hoy.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function esHoyLocal(isoString) {
  const fecha = new Date(isoString);
  const offset = fecha.getTimezoneOffset();
  const local = new Date(fecha.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10) === hoyISO();
}

export default function Ventas() {
  const [ordenes, setOrdenes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [marcandoId, setMarcandoId] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargando(true);
    setError(null);
    try {
      const data = await listarOrdenes();
      setOrdenes(data.filter((o) => esHoyLocal(o.fecha)));
    } catch (err) {
      setError("No se pudieron cargar las ventas de hoy");
    } finally {
      setCargando(false);
    }
  }

  async function marcarPagada(ordenId) {
    setMarcandoId(ordenId);
    setError(null);
    try {
      await marcarOrdenPagada(ordenId);
      setMensaje("Pedido marcado como pagado");
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo marcar como pagado");
    } finally {
      setMarcandoId(null);
    }
  }

  const totalHoy = ordenes.reduce((sum, o) => sum + Number(o.total), 0);
  const pendientes = ordenes.filter((o) => o.metodo_pago === "credito" && !o.pagada);

  return (
    <div className="tvad-container">
      <header className="tvad-header">
        <h1>Ventas de hoy</h1>
        <p>
          <Calendar size={13} /> {ordenes.length} pedido{ordenes.length !== 1 ? "s" : ""} · {formatearMoneda(totalHoy)}
        </p>
      </header>

      {mensaje && <div className="tvad-mensaje-exito">{mensaje}</div>}
      {error && <div className="tvad-mensaje-error">{error}</div>}

      {pendientes.length > 0 && (
        <div className="tvad-aviso-pendientes">
          <Clock3 size={14} />
          {pendientes.length} pedido{pendientes.length !== 1 ? "s" : ""} pendiente{pendientes.length !== 1 ? "s" : ""} por cobrar hoy
        </div>
      )}

      {cargando ? (
        <p className="tvad-cargando">Cargando...</p>
      ) : (
        <div className="tvad-lista">
          {ordenes.map((orden) => {
            const esCredito = orden.metodo_pago === "credito";
            const pendiente = esCredito && !orden.pagada;
            const marcandoEsta = marcandoId === orden.id;

            return (
              <div key={orden.id} className="tvad-tarjeta">
                <div className="tvad-fila-principal">
                  <div className="tvad-titulo">
                    <ShoppingBag size={15} />
                    <span>Pedido #{orden.id}</span>
                  </div>
                  <span className="tvad-total">{formatearMoneda(orden.total)}</span>
                </div>

                {esCredito && (
                  <div className="tvad-fila-credito">
                    <span className={`tvad-badge ${pendiente ? "pendiente" : "pagada"}`}>
                      {pendiente ? (
                        <>
                          <Clock3 size={11} /> Pendiente por cobrar
                        </>
                      ) : (
                        <>
                          <Check size={11} /> Pagada
                        </>
                      )}
                    </span>
                    {orden.cliente_nombre && (
                      <span className="tvad-cliente">{orden.cliente_nombre}</span>
                    )}
                  </div>
                )}

                <div className="tvad-items">
                  {orden.ventas.map((v) => (
                    <div key={v.id} className="tvad-item">
                      <span>{v.cantidad} × {v.producto_nombre}</span>
                      <span>{formatearMoneda(v.total)}</span>
                    </div>
                  ))}
                </div>

                <div className="tvad-detalle">
                  <span className="tvad-capitalize">
                    {esCredito ? "Cuenta por cobrar" : orden.metodo_pago}
                  </span>
                  <span>·</span>
                  <span>{orden.trabajadora_nombre}</span>
                  <span>·</span>
                  <span>{formatearFecha(orden.fecha)}</span>
                </div>

                {pendiente && (
                  <button
                    className="tvad-btn-pagar"
                    onClick={() => marcarPagada(orden.id)}
                    disabled={marcandoEsta}
                  >
                    <Check size={14} />
                    {marcandoEsta ? "Marcando..." : "Marcar como pagada"}
                  </button>
                )}
              </div>
            );
          })}

          {ordenes.length === 0 && (
            <p className="tvad-sin-ventas">Todavía no hay ventas hoy</p>
          )}
        </div>
      )}
    </div>
  );
}