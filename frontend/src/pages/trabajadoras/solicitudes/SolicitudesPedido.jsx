import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  ShoppingCart,
  X,
  Check,
  RefreshCw,
  Clock3,
  Inbox,
  ChefHat,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import {
  listarSolicitudesPendientes,
  rechazarSolicitud,
  recibirSolicitud,
  prepararSolicitud,
} from "../../../api/solicitudesPedido";
import "./SolicitudesPedido.css";

function formatearFecha(isoString) {
  return new Date(isoString).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function formatearHora(isoString) {
  return new Date(isoString).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ESTADOS = {
  pendiente: { label: "Pendiente", Icon: Clock3, clase: "sp-badge-pendiente" },
  recibida: { label: "Recibido", Icon: Inbox, clase: "sp-badge-recibida" },
  preparada: { label: "Preparado", Icon: ChefHat, clase: "sp-badge-preparada" },
};

export default function SolicitudesPedido() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [avanzandoId, setAvanzandoId] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [rechazandoId, setRechazandoId] = useState(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [enviandoRechazo, setEnviandoRechazo] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const data = await listarSolicitudesPendientes();
      setSolicitudes(data);
    } catch (err) {
      setError("No se pudieron cargar los pedidos pendientes");
    } finally {
      setCargando(false);
    }
  }

  async function avanzar(solicitudId, accion) {
    setAvanzandoId(solicitudId);
    setError(null);
    try {
      const actualizada =
        accion === "recibir"
          ? await recibirSolicitud(solicitudId)
          : await prepararSolicitud(solicitudId);
      setSolicitudes((prev) =>
        prev.map((s) => (s.id === solicitudId ? actualizada : s))
      );
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo actualizar el pedido");
      cargar();
    } finally {
      setAvanzandoId(null);
    }
  }

  function pasarAlCarrito(solicitud) {
    const destino = usuario?.rol === "jefe" ? "/admin/ventas/registrar" : "/venta";
    navigate(destino, { state: { solicitud } });
  }

  function iniciarRechazo(solicitudId) {
    setRechazandoId(solicitudId);
    setMotivoRechazo("");
  }

  function cancelarRechazo() {
    setRechazandoId(null);
    setMotivoRechazo("");
  }

  async function confirmarRechazo(solicitudId) {
    setEnviandoRechazo(true);
    setError(null);

    try {
      await rechazarSolicitud(solicitudId, motivoRechazo.trim() || undefined);
      setRechazandoId(null);
      setMotivoRechazo("");
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo rechazar el pedido");
    } finally {
      setEnviandoRechazo(false);
    }
  }

  return (
    <div className="sp-container">
      <header className="sp-header">
        <div>
          <h1>
            <ClipboardList size={20} />
            Pedidos de Arte Frío
          </h1>
          <p>Solicitudes por recibir, preparar y registrar</p>
        </div>

        <button className="sp-btn-refrescar" onClick={cargar} disabled={cargando}>
          <RefreshCw size={14} className={cargando ? "sp-girando" : ""} />
          Actualizar
        </button>
      </header>

      {error && <div className="sp-mensaje-error">{error}</div>}

      {cargando && solicitudes.length === 0 && (
        <p className="sp-cargando">Cargando...</p>
      )}

      {!cargando && solicitudes.length === 0 && !error && (
        <div className="sp-vacio">
          <Check size={28} />
          <p>No hay pedidos pendientes por ahora</p>
        </div>
      )}

      <div className="sp-lista">
        {solicitudes.map((s) => (
          <div key={s.id} className="sp-tarjeta">
            <div className="sp-fila-principal">
              {(() => {
                const est = ESTADOS[s.estado] || ESTADOS.pendiente;
                return (
                  <span className={`sp-badge ${est.clase}`}>
                    <est.Icon size={12} />
                    {est.label}
                  </span>
                );
              })()}
              <span className="sp-fecha">{formatearFecha(s.fecha)}</span>
            </div>

            <div className="sp-items">
              {s.items.map((item) => (
                <span key={item.id} className="sp-item">
                  {item.cantidad} × {item.producto_nombre}
                </span>
              ))}
            </div>

            {s.nota && <p className="sp-nota">"{s.nota}"</p>}
            {(s.recibida_en || s.preparada_en) && (
              <p className="sp-linea-tiempo">
                {s.recibida_en && <span>Recibido {formatearHora(s.recibida_en)}</span>}
                {s.preparada_en && <span>Preparado {formatearHora(s.preparada_en)}</span>}
              </p>
            )}

            {rechazandoId === s.id ? (
              <div className="sp-rechazo">
                <label htmlFor={`sp-motivo-${s.id}`}>
                  Motivo del rechazo (opcional)
                </label>
                <textarea
                  id={`sp-motivo-${s.id}`}
                  rows={2}
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                  placeholder="Ej: No hay stock suficiente de hamburguesas"
                />
                <div className="sp-rechazo-botones">
                  <button
                    className="sp-btn-secundario"
                    onClick={cancelarRechazo}
                    disabled={enviandoRechazo}
                  >
                    Cancelar
                  </button>
                  <button
                    className="sp-btn-peligro"
                    onClick={() => confirmarRechazo(s.id)}
                    disabled={enviandoRechazo}
                  >
                    {enviandoRechazo ? "Rechazando..." : "Confirmar rechazo"}
                  </button>
                </div>
              </div>
            ) : (
              <>
              {s.estado !== "preparada" && (
                <div className="sp-acciones-estado">
                  {s.estado === "pendiente" && (
                    <button
                      className="sp-btn-estado"
                      onClick={() => avanzar(s.id, "recibir")}
                      disabled={avanzandoId === s.id}
                    >
                      <Inbox size={14} />
                      Recibido
                    </button>
                  )}
                  <button
                    className="sp-btn-estado"
                    onClick={() => avanzar(s.id, "preparar")}
                    disabled={avanzandoId === s.id}
                  >
                    <ChefHat size={14} />
                    Preparado
                  </button>
                </div>
              )}
              <div className="sp-acciones">
                <button
                  className="sp-btn-primario"
                  onClick={() => pasarAlCarrito(s)}
                >
                  <ShoppingCart size={14} />
                  Pasar al carrito
                </button>
                <button
                  className="sp-btn-peligro-outline"
                  onClick={() => iniciarRechazo(s.id)}
                >
                  <X size={14} />
                  Rechazar
                </button>
              </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}