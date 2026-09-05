import { useEffect, useState } from "react";
import { listarTrabajadoras } from "../../../api/trabajadoras";
import { listarHorarios, marcarEntrada, marcarSalida } from "../../../api/horarios";
import "./Horario.css";

function hoyISO() {
  const ahora = new Date();
  const yyyy = ahora.getFullYear();
  const mm = String(ahora.getMonth() + 1).padStart(2, "0");
  const dd = String(ahora.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatearHora(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Horario() {
  const [trabajadoras, setTrabajadoras] = useState([]);
  const [trabajadoraId, setTrabajadoraId] = useState("");
  const [horarios, setHorarios] = useState([]);

  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    listarTrabajadoras()
      .then(setTrabajadoras)
      .catch(() => setError("No se pudieron cargar las trabajadoras"));
  }, []);

  useEffect(() => {
    if (!trabajadoraId) {
      setHorarios([]);
      return;
    }
    cargarHorarios(trabajadoraId);
  }, [trabajadoraId]);

  async function cargarHorarios(id) {
    try {
      const data = await listarHorarios({ trabajadora_id: id });
      setHorarios(data);
    } catch (err) {
      setError("No se pudo cargar el historial de horarios");
    }
  }

  const turnoAbierto = horarios.find(
    (h) => h.fecha === hoyISO() && !h.hora_salida
  );

  const nombreSeleccionada = trabajadoras.find(
    (t) => t.id === Number(trabajadoraId)
  )?.nombre;

  function pedirConfirmacion() {
    if (!trabajadoraId) {
      setError("Selecciona quién va a marcar");
      return;
    }
    setError(null);
    setMensaje(null);
    setConfirmando(true);
  }

  async function confirmarMarcaje() {
    setEnviando(true);
    setError(null);

    try {
      if (turnoAbierto) {
        await marcarSalida(Number(trabajadoraId));
        setMensaje("Salida registrada");
      } else {
        await marcarEntrada(Number(trabajadoraId));
        setMensaje("Entrada registrada");
      }
      setConfirmando(false);
      cargarHorarios(trabajadoraId);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo registrar el marcaje");
      setConfirmando(false);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="hor-container">
      <h1>Horario</h1>

      {mensaje && <div className="hor-mensaje-exito">{mensaje}</div>}
      {error && <div className="hor-mensaje-error">{error}</div>}

      {!confirmando && (
        <>
          <label className="hor-label">¿Quién va a marcar?</label>
          <select
            value={trabajadoraId}
            onChange={(e) => {
              setTrabajadoraId(e.target.value);
              setMensaje(null);
              setError(null);
            }}
          >
            <option value="">Selecciona...</option>
            {trabajadoras.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>

          {trabajadoraId && (
            <div className="hor-estado">
              {turnoAbierto ? (
                <p className="hor-estado-texto">
                  Turno abierto desde las <strong>{formatearHora(turnoAbierto.hora_entrada)}</strong>
                </p>
              ) : (
                <p className="hor-estado-texto">No hay un turno abierto hoy</p>
              )}

              <button
                className={`hor-btn-marcar ${turnoAbierto ? "salida" : "entrada"}`}
                onClick={pedirConfirmacion}
              >
                {turnoAbierto ? "Marcar salida" : "Marcar entrada"}
              </button>
            </div>
          )}

          {trabajadoraId && horarios.length > 0 && (
            <section className="hor-historial">
              <h2>Historial reciente</h2>
              {horarios.slice(0, 10).map((h) => (
                <div key={h.id} className="hor-fila">
                  <span className="hor-fecha">{h.fecha}</span>
                  <span>{formatearHora(h.hora_entrada)} - {formatearHora(h.hora_salida)}</span>
                  <span className="hor-horas">
                    {h.horas_trabajadas != null ? `${h.horas_trabajadas} h` : "En curso"}
                  </span>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {confirmando && (
        <div className="hor-confirmacion">
          <h2>{turnoAbierto ? "Confirmar salida" : "Confirmar entrada"}</h2>
          <div className="hor-resumen-fila">
            <span>Trabajadora</span>
            <span>{nombreSeleccionada}</span>
          </div>
          <div className="hor-resumen-fila">
            <span>Acción</span>
            <span>{turnoAbierto ? "Marcar salida" : "Marcar entrada"}</span>
          </div>
          <div className="hor-resumen-fila">
            <span>Hora</span>
            <span>{new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>

          <div className="hor-confirmacion-botones">
            <button
              className="hor-btn-secundario"
              onClick={() => setConfirmando(false)}
              disabled={enviando}
            >
              Cancelar
            </button>
            <button
              className={`hor-btn-marcar ${turnoAbierto ? "salida" : "entrada"}`}
              onClick={confirmarMarcaje}
              disabled={enviando}
            >
              {enviando ? "Registrando..." : "Confirmar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}