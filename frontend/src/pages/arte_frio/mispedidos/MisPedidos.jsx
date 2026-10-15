import { useEffect, useState } from "react";
import {
  Clock3, Check, X, RefreshCw, Calendar, ChevronDown, ChevronUp,
  EyeOff, Eye, Trash2, Undo2,
} from "lucide-react";
import {
  listarMisSolicitudes,
  ocultarSolicitud,
  mostrarSolicitud,
} from "../../../api/solicitudesPedido";
import "./MisPedidos.css";

const RANGOS = [
  { id: "hoy", texto: "Hoy" },
  { id: "ayer", texto: "Ayer" },
  { id: "semana", texto: "Esta semana" },
  { id: "mes", texto: "Este mes" },
  { id: "todos", texto: "Todos" },
];

const ESTADOS = [
  { id: "todos", texto: "Todos" },
  { id: "pendiente", texto: "Pendientes" },
  { id: "atendida", texto: "Atendidos" },
  { id: "rechazada", texto: "Rechazados" },
];

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

/* yyyy-mm-dd en hora local a partir de un Date */
function aISOLocal(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function hoyISO() {
  return aISOLocal(new Date());
}

function diaRelativoISO(offsetDias) {
  const f = new Date();
  f.setDate(f.getDate() + offsetDias);
  return aISOLocal(f);
}

/* Día local (yyyy-mm-dd) de una fecha ISO que viene en UTC */
function diaLocal(isoString) {
  return aISOLocal(new Date(isoString));
}

function enRango(pedido, rango, fechaSel) {
  const dia = diaLocal(pedido.fecha);
  const hoy = hoyISO();

  switch (rango) {
    case "hoy":
      return dia === hoy;
    case "ayer":
      return dia === diaRelativoISO(-1);
    case "semana":
      return dia >= diaRelativoISO(-6) && dia <= hoy;
    case "mes":
      return dia.slice(0, 7) === hoy.slice(0, 7);
    case "fecha":
      return dia === (fechaSel || hoy);
    default:
      return true; // "todos"
  }
}

export default function MisPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [rango, setRango] = useState("hoy");
  const [fechaSel, setFechaSel] = useState(hoyISO);
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [verQuitados, setVerQuitados] = useState(false);
  const [plegados, setPlegados] = useState(() => new Set());
  const [trabajando, setTrabajando] = useState(null); // id del pedido en proceso

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verQuitados]);

  async function cargar() {
    setCargando(true);
    setError(null);

    try {
      const data = await listarMisSolicitudes(verQuitados);
      setPedidos(data);
    } catch (err) {
      setError("No se pudo cargar tu historial de pedidos");
    } finally {
      setCargando(false);
    }
  }

  function togglePlegar(pedidoId) {
    setPlegados((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(pedidoId)) nuevo.delete(pedidoId);
      else nuevo.add(pedidoId);
      return nuevo;
    });
  }

  async function quitarDeMiLista(pedidoId) {
    setTrabajando(pedidoId);
    setError(null);
    try {
      await ocultarSolicitud(pedidoId);
      setPedidos((actual) =>
        verQuitados
          ? actual.map((p) => (p.id === pedidoId ? { ...p, oculto_cliente: true } : p))
          : actual.filter((p) => p.id !== pedidoId)
      );
    } catch (err) {
      setError(err?.response?.data?.error || "No se pudo quitar el pedido de tu lista");
    } finally {
      setTrabajando(null);
    }
  }

  async function restaurar(pedidoId) {
    setTrabajando(pedidoId);
    setError(null);
    try {
      await mostrarSolicitud(pedidoId);
      setPedidos((actual) =>
        actual.map((p) => (p.id === pedidoId ? { ...p, oculto_cliente: false } : p))
      );
    } catch (err) {
      setError(err?.response?.data?.error || "No se pudo restaurar el pedido");
    } finally {
      setTrabajando(null);
    }
  }

  function elegirFecha(valor) {
    setFechaSel(valor);
    setRango("fecha");
  }

  const totalPendientes = pedidos.filter(
    (p) => p.estado === "pendiente" && !p.oculto_cliente
  ).length;

  /* Los pendientes se ven siempre (aunque sean de otro día): son los que
     el cliente está esperando. El rango de fechas aplica al resto. */
  const pedidosFiltrados = pedidos
    .filter((p) => enRango(p, rango, fechaSel))
    .filter((p) => filtroEstado === "todos" || p.estado === filtroEstado)
    .sort((a, b) => {
      const aPend = a.estado === "pendiente" ? 0 : 1;
      const bPend = b.estado === "pendiente" ? 0 : 1;
      if (aPend !== bPend) return aPend - bPend;
      return new Date(b.fecha) - new Date(a.fecha);
    });

  return (
    <div className="mp-container">
      <header className="mp-header">
        <h1>
          Mis pedidos
          {totalPendientes > 0 && (
            <span className="mp-contador-pendientes">
              {totalPendientes} {totalPendientes === 1 ? "pendiente" : "pendientes"}
            </span>
          )}
        </h1>
        <p>Historial de lo que has pedido a Punto Amarillo</p>
      </header>

      {/* Rango de fechas */}
      <div className="mp-chips">
        {RANGOS.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`mp-chip ${rango === r.id ? "activo" : ""}`}
            onClick={() => setRango(r.id)}
          >
            {r.texto}
          </button>
        ))}

        <label className={`mp-chip mp-chip-fecha ${rango === "fecha" ? "activo" : ""}`}>
          <Calendar size={13} />
          <input
            type="date"
            value={fechaSel}
            max={hoyISO()}
            onChange={(e) => e.target.value && elegirFecha(e.target.value)}
          />
        </label>
      </div>

      {/* Estado */}
      <div className="mp-chips mp-chips-estado">
        {ESTADOS.map((e) => (
          <button
            key={e.id}
            type="button"
            className={`mp-chip mp-chip-chico ${filtroEstado === e.id ? "activo" : ""}`}
            onClick={() => setFiltroEstado(e.id)}
          >
            {e.texto}
          </button>
        ))}

        <button
          type="button"
          className={`mp-toggle-quitados ${verQuitados ? "activo" : ""}`}
          onClick={() => setVerQuitados((v) => !v)}
        >
          {verQuitados ? <EyeOff size={12} /> : <Eye size={12} />}
          {verQuitados ? "Ocultar quitados" : "Ver quitados"}
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
            const plegado = plegados.has(pedido.id);
            const quitado = pedido.oculto_cliente;
            const puedeQuitar = pedido.estado !== "pendiente" && !quitado;

            return (
              <div key={pedido.id} className={`mp-tarjeta ${quitado ? "quitada" : ""}`}>
                <div className="mp-fila-principal">
                  <span className={`mp-badge ${estado.clase}`}>
                    <estado.Icon size={11} />
                    {estado.texto}
                  </span>

                  <span className="mp-fecha">{formatearFecha(pedido.fecha)}</span>

                  <button
                    type="button"
                    className="mp-btn-ocultar"
                    onClick={() => togglePlegar(pedido.id)}
                    aria-label={plegado ? "Mostrar detalle" : "Ocultar detalle"}
                  >
                    {plegado ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                  </button>
                </div>

                {!plegado && (
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
                      <p className="mp-motivo-rechazo">Motivo: {pedido.motivo_rechazo}</p>
                    )}
                  </>
                )}

                {plegado && (
                  <p className="mp-oculto-aviso">
                    <EyeOff size={12} />
                    Detalle oculto
                  </p>
                )}

                {puedeQuitar && (
                  <div className="mp-acciones">
                    <button
                      type="button"
                      className="mp-btn-quitar"
                      disabled={trabajando === pedido.id}
                      onClick={() => quitarDeMiLista(pedido.id)}
                    >
                      <Trash2 size={12} />
                      Quitar de mi lista
                    </button>
                  </div>
                )}

                {quitado && (
                  <div className="mp-acciones">
                    <button
                      type="button"
                      className="mp-btn-restaurar"
                      disabled={trabajando === pedido.id}
                      onClick={() => restaurar(pedido.id)}
                    >
                      <Undo2 size={12} />
                      Restaurar
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {pedidosFiltrados.length === 0 && !error && (
            <p className="mp-sin-pedidos">
              {pedidos.length === 0
                ? "Todavía no has hecho ningún pedido"
                : "No hay pedidos con estos filtros"}
              {pedidos.length > 0 && (rango !== "todos" || filtroEstado !== "todos") && (
                <>
                  <br />
                  <button
                    type="button"
                    className="mp-link"
                    onClick={() => {
                      setRango("todos");
                      setFiltroEstado("todos");
                    }}
                  >
                    Ver todos los pedidos
                  </button>
                </>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}