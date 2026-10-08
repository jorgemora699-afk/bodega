import { useEffect, useState } from "react";
import { Clock3, Check, X, RefreshCw, Calendar, ChevronDown, ChevronUp, EyeOff } from "lucide-react";
import { obtenerMiCliente } from "../../../api/clientes";
import { listarSolicitudes } from "../../../api/solicitudesPedido";
import "./MisPedidos.css";

function formatearFecha(isoString) {
  return new Date(isoString).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function etiquetaEstado(estado) {
  if (estado === "pendiente") return { texto: "Pendiente", clase: "pendiente", Icon: Clock3 };
  if (estado === "atendida") return { texto: "Atendido", clase: "atendida", Icon: Check };
  return { texto: "Rechazado", clase: "rechazada", Icon: X };
}

/* Fecha local de hoy en formato yyyy-mm-dd, para el input type="date" */
function hoyISO() {
  const hoy = new Date();
  const offset = hoy.getTimezoneOffset();
  const local = new Date(hoy.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

/* Compara si una fecha ISO (con hora, en UTC) cae en el día local elegido */
function esMismoDiaLocal(isoString, fechaISO) {
  const fecha = new Date(isoString);
  const offset = fecha.getTimezoneOffset();
  const local = new Date(fecha.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10) === fechaISO;
}

export default function MisPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [fechaFiltro, setFechaFiltro] = useState(hoyISO);
  const [verTodos, setVerTodos] = useState(false);
  const [ocultos, setOcultos] = useState(() => new Set());

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    setError(null);

    try {
      const miCliente = await obtenerMiCliente();
      const todas = await listarSolicitudes();
      setPedidos(todas.filter((s) => s.cliente_id === miCliente.id));
    } catch (err) {
      setError("No se pudo cargar tu historial de pedidos");
    } finally {
      setCargando(false);
    }
  }

  function toggleOcultar(pedidoId) {
    setOcultos((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(pedidoId)) {
        nuevo.delete(pedidoId);
      } else {
        nuevo.add(pedidoId);
      }
      return nuevo;
    });
  }

  const pedidosFiltrados = pedidos
    .filter((p) => verTodos || !fechaFiltro || esMismoDiaLocal(p.fecha, fechaFiltro))
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  return (
    <div className="mp-container">
      <header className="mp-header">
        <h1>Mis pedidos</h1>
        <p>Historial de lo que has pedido a Punto Amarillo</p>
      </header>

      <div className="mp-filtro-fecha">
        <Calendar size={15} />
        <input
          type="date"
          value={fechaFiltro}
          disabled={verTodos}
          onChange={(e) => setFechaFiltro(e.target.value)}
        />

        {!verTodos && fechaFiltro !== hoyISO() && (
          <button
            type="button"
            className="mp-filtro-fecha-hoy"
            onClick={() => setFechaFiltro(hoyISO())}
          >
            Hoy
          </button>
        )}

        <button
          type="button"
          className={`mp-filtro-ver-todos ${verTodos ? "activo" : ""}`}
          onClick={() => setVerTodos((v) => !v)}
        >
          {verTodos ? "Ver solo un día" : "Ver todos"}
        </button>
      </div>

      {error && (
        <div className="mp-mensaje-error">
          <span>{error}</span>
          <button onClick={cargar}>
            <RefreshCw size={13} />
            Reintentar
          </button>
        </div>
      )}

      {cargando ? (
        <p className="mp-cargando">Cargando...</p>
      ) : (
        <div className="mp-lista">
          {pedidosFiltrados.map((pedido) => {
            const estado = etiquetaEstado(pedido.estado);
            const oculto = ocultos.has(pedido.id);

            return (
              <div key={pedido.id} className="mp-tarjeta">
                <div className="mp-fila-principal">
                  <span className={`mp-badge ${estado.clase}`}>
                    <estado.Icon size={11} />
                    {estado.texto}
                  </span>

                  <span className="mp-fecha">{formatearFecha(pedido.fecha)}</span>

                  <button
                    type="button"
                    className="mp-btn-ocultar"
                    onClick={() => toggleOcultar(pedido.id)}
                    aria-label={oculto ? "Mostrar detalle" : "Ocultar detalle"}
                  >
                    {oculto ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                  </button>
                </div>

                {!oculto && (
                  <>
                    <div className="mp-items">
                      {pedido.items.map((item) => (
                        <span key={item.id}>
                          {item.cantidad} × {item.producto_nombre}
                        </span>
                      ))}
                    </div>

                    {pedido.nota && <p className="mp-nota">"{pedido.nota}"</p>}

                    {pedido.estado === "rechazada" && pedido.motivo_rechazo && (
                      <p className="mp-motivo-rechazo">
                        Motivo: {pedido.motivo_rechazo}
                      </p>
                    )}
                  </>
                )}

                {oculto && (
                  <p className="mp-oculto-aviso">
                    <EyeOff size={12} />
                    Detalle oculto
                  </p>
                )}
              </div>
            );
          })}

          {pedidosFiltrados.length === 0 && !error && (
            <p className="mp-sin-pedidos">
              {verTodos
                ? "Todavía no has hecho ningún pedido"
                : "No hay pedidos en la fecha seleccionada"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}