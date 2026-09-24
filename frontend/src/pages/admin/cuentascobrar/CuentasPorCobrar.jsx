import { useEffect, useState } from "react";
import { Clock3, Check, User, Building2, Calendar } from "lucide-react";
import { listarOrdenesPendientes, marcarOrdenPagada } from "../../../api/ordenes";
import "./CuentasPorCobrar.css";

function formatearFecha(isoString) {
  return new Date(isoString).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatearMoneda(valor) {
  return `$${Number(valor).toLocaleString("es-CO")}`;
}

function diasDeAntiguedad(isoString) {
  const fecha = new Date(isoString);
  const ahora = new Date();
  const dias = Math.floor((ahora - fecha) / (1000 * 60 * 60 * 24));
  return dias;
}

export default function CuentasPorCobrar() {
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
      const data = await listarOrdenesPendientes();
      setOrdenes(data);
    } catch (err) {
      setError("No se pudieron cargar las cuentas por cobrar");
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
      setOrdenes((actual) => actual.filter((o) => o.id !== ordenId));
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo marcar el pedido como pagado");
    } finally {
      setMarcandoId(null);
    }
  }

  const totalPendiente = ordenes.reduce((sum, o) => sum + Number(o.total), 0);

  /* Agrupar por cliente para ver quién debe más */
  const porCliente = {};
  ordenes.forEach((o) => {
    const nombre = o.cliente_nombre || "Sin cliente";
    if (!porCliente[nombre]) porCliente[nombre] = 0;
    porCliente[nombre] += Number(o.total);
  });
  const clientesOrdenados = Object.entries(porCliente).sort((a, b) => b[1] - a[1]);

  return (
    <div className="cxc-container">
      <header className="cxc-header">
        <div>
          <h1>Cuentas por cobrar</h1>
          <p>Pedidos a crédito pendientes de pago</p>
        </div>
      </header>

      <div className="cxc-resumen">
        <div className="cxc-resumen-total">
          <span>Total pendiente</span>
          <strong>{formatearMoneda(totalPendiente)}</strong>
        </div>
        <div className="cxc-resumen-contador">
          <span>{ordenes.length}</span>
          <small>{ordenes.length === 1 ? "cuenta" : "cuentas"}</small>
        </div>
      </div>

      {mensaje && <div className="cxc-mensaje-exito">{mensaje}</div>}
      {error && <div className="cxc-mensaje-error">{error}</div>}

      {clientesOrdenados.length > 1 && (
        <div className="cxc-por-cliente">
          <span className="cxc-por-cliente-titulo">Quién debe más</span>
          {clientesOrdenados.slice(0, 5).map(([nombre, total]) => (
            <div key={nombre} className="cxc-por-cliente-fila">
              <span>{nombre}</span>
              <strong>{formatearMoneda(total)}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="cxc-lista">
        {cargando ? (
          <p className="cxc-sin-datos">Cargando...</p>
        ) : ordenes.length === 0 ? (
          <div className="cxc-vacio">
            <Check size={22} />
            <strong>No hay cuentas pendientes</strong>
            <span>Todos los créditos están al día.</span>
          </div>
        ) : (
          ordenes.map((orden) => {
            const dias = diasDeAntiguedad(orden.fecha);
            const marcandoEsta = marcandoId === orden.id;

            return (
              <div key={orden.id} className="cxc-tarjeta">
                <div className="cxc-fila-principal">
                  <div className="cxc-cliente">
                    <span className="cxc-cliente-icono">
                      {orden.cliente_tipo === "juridica" ? <Building2 size={16} /> : <User size={16} />}
                    </span>
                    <span className="cxc-cliente-nombre">{orden.cliente_nombre || "Sin cliente"}</span>
                  </div>
                  <span className="cxc-total">{formatearMoneda(orden.total)}</span>
                </div>

                <div className="cxc-detalle">
                  <span>Pedido #{orden.id}</span>
                  <span>·</span>
                  <span>{orden.trabajadora_nombre}</span>
                </div>

                <div className="cxc-detalle cxc-fecha">
                  <Calendar size={12} />
                  {formatearFecha(orden.fecha)}
                  {dias > 0 && (
                    <span className={`cxc-badge-antiguedad ${dias > 15 ? "critico" : ""}`}>
                      hace {dias} {dias === 1 ? "día" : "días"}
                    </span>
                  )}
                </div>

                <div className="cxc-acciones">
                  <button
                    className="cxc-btn-pagar"
                    onClick={() => marcarPagada(orden.id)}
                    disabled={marcandoEsta}
                  >
                    <Check size={14} />
                    {marcandoEsta ? "Marcando..." : "Marcar como pagada"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}