import { useEffect, useState } from "react";
import { LogIn, LogOut, Clock, CheckCircle2 } from "lucide-react";
import { listarTrabajadoras } from "../../api/trabajadoras";
import { marcarEntrada, marcarSalida, listarHorarios } from "../../api/horarios";
import "./Horario.css";

export default function Horario() {
  const [trabajadoras, setTrabajadoras] = useState([]);
  const [trabajadoraId, setTrabajadoraId] = useState("");
  const [turnoAbierto, setTurnoAbierto] = useState(null);

  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarTrabajadoras();
  }, []);

  useEffect(() => {
    if (trabajadoraId) {
      cargarEstadoTurno(trabajadoraId);
    } else {
      setTurnoAbierto(null);
    }
  }, [trabajadoraId]);

  async function cargarTrabajadoras() {
    try {
      const data = await listarTrabajadoras();
      setTrabajadoras(data);
    } catch (err) {
      setError("No se pudieron cargar las trabajadoras");
    }
  }

  async function cargarEstadoTurno(id) {
    try {
      const historial = await listarHorarios({ trabajadora_id: Number(id) });
      const abierto = historial.find((t) => !t.hora_salida) || null;
      setTurnoAbierto(abierto);
    } catch (err) {
      setError("No se pudo consultar el estado del turno");
    }
  }

  async function handleEntrada() {
    if (!trabajadoraId) {
      setError("Selecciona quién eres primero");
      return;
    }
    setEnviando(true);
    setError(null);
    setMensaje(null);
    try {
      await marcarEntrada(Number(trabajadoraId));
      setMensaje("Entrada registrada");
      cargarEstadoTurno(trabajadoraId);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo marcar la entrada");
    } finally {
      setEnviando(false);
    }
  }

  async function handleSalida() {
    if (!trabajadoraId) {
      setError("Selecciona quién eres primero");
      return;
    }
    setEnviando(true);
    setError(null);
    setMensaje(null);
    try {
      await marcarSalida(Number(trabajadoraId));
      setMensaje("Salida registrada");
      cargarEstadoTurno(trabajadoraId);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo marcar la salida");
    } finally {
      setEnviando(false);
    }
  }

  function formatearHora(isoString) {
    if (!isoString) return "—";
    return new Date(isoString).toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="hor-container">
      <header className="hor-header">
        <h1>Horario</h1>
        <p>Marca tu entrada y salida del turno</p>
      </header>

      <label className="hor-label">¿Quién eres?</label>
      <select
        className="hor-select"
        value={trabajadoraId}
        onChange={(e) => setTrabajadoraId(e.target.value)}
      >
        <option value="">Selecciona...</option>
        {trabajadoras.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
      </select>

      {mensaje && (
        <div className="hor-mensaje-exito">
          <CheckCircle2 size={16} /> {mensaje}
        </div>
      )}
      {error && <div className="hor-mensaje-error">{error}</div>}

      {trabajadoraId && (
        <div className={`hor-estado ${turnoAbierto ? "activo" : ""}`}>
          <Clock size={16} />
          {turnoAbierto
            ? `Turno en curso desde las ${formatearHora(turnoAbierto.hora_entrada)}`
            : "No hay ningún turno abierto"}
        </div>
      )}

      <div className="hor-botones">
        <button
          className="hor-btn-entrada"
          onClick={handleEntrada}
          disabled={enviando || !!turnoAbierto}
        >
          <LogIn size={20} />
          Marcar entrada
        </button>
        <button
          className="hor-btn-salida"
          onClick={handleSalida}
          disabled={enviando || !turnoAbierto}
        >
          <LogOut size={20} />
          Marcar salida
        </button>
      </div>
    </div>
  );
}