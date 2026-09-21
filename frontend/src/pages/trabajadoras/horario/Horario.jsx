import { useEffect, useRef, useState } from "react";
import { LogIn, LogOut, Clock, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { listarTrabajadoras } from "../../../api/trabajadoras";
import { marcarEntrada, marcarSalida, listarHorarios } from "../../../api/horarios";
import "./Horario.css";

const HISTORIAL_VISIBLE = 6;

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

function formatearFechaCorta(fechaString) {
  const [, mes, dia] = fechaString.split("-");
  return `${dia}/${mes}`;
}

function formatearFechaLarga(fechaString) {
  const [y, m, d] = fechaString.split("-").map(Number);
  const fecha = new Date(y, m - 1, d);

  const diaSemana = fecha
    .toLocaleDateString("es-CO", { weekday: "long" })
    .replace(/^\w/, (c) => c.toUpperCase());

  return `${diaSemana} ${d}/${m}`;
}

function diasDesde(fechaString) {
  const [y, m, d] = fechaString.split("-").map(Number);
  const fecha = new Date(y, m - 1, d);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((hoy - fecha) / 86400000);
}

export default function Horario() {
  const [trabajadoras, setTrabajadoras] = useState([]);
  const [cargandoTrabajadoras, setCargandoTrabajadoras] = useState(true);
  const [trabajadoraId, setTrabajadoraId] = useState("");

  const [turnoAbierto, setTurnoAbierto] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cargandoEstado, setCargandoEstado] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  const [confirmandoSalida, setConfirmandoSalida] = useState(false);

  const [ahora, setAhora] = useState(new Date());

  const peticionActual = useRef(0);

  /* Reloj en vivo */
  useEffect(() => {
    const intervalo = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(intervalo);
  }, []);

  /* Trabajadoras */
  useEffect(() => {
    cargarTrabajadoras();
  }, []);

  /* Estado del turno de la trabajadora seleccionada */
  useEffect(() => {
    if (trabajadoraId) {
      cargarEstadoTurno(trabajadoraId);
    } else {
      setTurnoAbierto(null);
      setHistorial([]);
    }
  }, [trabajadoraId]);

  /* Los mensajes desaparecen solos */
  useEffect(() => {
    if (!mensaje) return undefined;
    const t = setTimeout(() => setMensaje(null), 3500);
    return () => clearTimeout(t);
  }, [mensaje]);

  useEffect(() => {
    if (!error) return undefined;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  async function cargarTrabajadoras() {
    setCargandoTrabajadoras(true);
    try {
      const data = await listarTrabajadoras();
      setTrabajadoras(data);
    } catch (err) {
      setError("No se pudieron cargar las trabajadoras");
    } finally {
      setCargandoTrabajadoras(false);
    }
  }

  async function cargarEstadoTurno(id) {
    const idPeticion = ++peticionActual.current;
    setCargandoEstado(true);

    try {
      const data = await listarHorarios({ trabajadora_id: Number(id) });

      /* Descarta esta respuesta si el usuario ya cambió de trabajadora */
      if (idPeticion !== peticionActual.current) return;

      const ordenado = [...data].sort((a, b) => {
        const claveA = `${a.fecha}T${a.hora_entrada || ""}`;
        const claveB = `${b.fecha}T${b.hora_entrada || ""}`;
        return claveB.localeCompare(claveA);
      });

      setTurnoAbierto(ordenado.find((t) => !t.hora_salida) || null);
      setHistorial(ordenado.filter((t) => t.hora_salida).slice(0, HISTORIAL_VISIBLE));
    } catch (err) {
      if (idPeticion === peticionActual.current) {
        setError("No se pudo consultar el estado del turno");
      }
    } finally {
      if (idPeticion === peticionActual.current) {
        setCargandoEstado(false);
      }
    }
  }

  function elegirTrabajadora(id) {
    setTrabajadoraId(id);
    setConfirmandoSalida(false);
    setMensaje(null);
    setError(null);
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
      setMensaje("Entrada registrada. ¡Buen turno!");
      elegirTrabajadora("");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo marcar la entrada");
      setEnviando(false);
      return;
    }

    setEnviando(false);
  }

  function pedirConfirmacionSalida() {
    if (!trabajadoraId) {
      setError("Selecciona quién eres primero");
      return;
    }

    setConfirmandoSalida(true);
  }

  async function confirmarSalida() {
    setEnviando(true);
    setError(null);
    setMensaje(null);

    try {
      await marcarSalida(Number(trabajadoraId));
      setMensaje("Salida registrada. ¡Hasta la próxima!");
      setConfirmandoSalida(false);
      elegirTrabajadora("");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo marcar la salida");
      setConfirmandoSalida(false);
    } finally {
      setEnviando(false);
    }
  }

  const trabajadoraActual = trabajadoras.find(
    (t) => String(t.id) === String(trabajadoraId)
  );

  const turnoAbiertoHoy = turnoAbierto && turnoAbierto.fecha === hoyISO();
  const diasAbierto = turnoAbierto ? diasDesde(turnoAbierto.fecha) : 0;
  const turnoAbiertoAtrasado = turnoAbierto && diasAbierto > 0;

  return (
    <div className="hor-container">
      <header className="hor-header">
        <h1>Horario</h1>
        <p>Marca tu entrada y salida del turno</p>
      </header>

      <div className="hor-reloj" aria-hidden="true">
        <span className="hor-reloj-hora">
          {ahora.toLocaleTimeString("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>

        <span className="hor-reloj-fecha">
          {ahora
            .toLocaleDateString("es-CO", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })
            .replace(/^\w/, (c) => c.toUpperCase())}
        </span>
      </div>

      <label className="hor-label" htmlFor="hor-select-trabajadora">
        ¿Quién eres?
      </label>

      {cargandoTrabajadoras ? (
        <div className="hor-select-skeleton" />
      ) : (
        <select
          id="hor-select-trabajadora"
          className="hor-select"
          value={trabajadoraId}
          onChange={(e) => elegirTrabajadora(e.target.value)}
        >
          <option value="">Selecciona...</option>
          {trabajadoras.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
      )}

      {mensaje && (
        <div className="hor-mensaje-exito" role="status">
          <CheckCircle2 size={16} /> {mensaje}
        </div>
      )}

      {error && (
        <div className="hor-mensaje-error" role="alert">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {trabajadoraId && (
        <>
          {cargandoEstado ? (
            <div className="hor-estado-skeleton" />
          ) : (
            <div
              className={`hor-estado ${turnoAbierto ? "activo" : ""} ${
                turnoAbiertoAtrasado ? "atrasado" : ""
              }`}
              role="status"
            >
              {turnoAbiertoAtrasado ? (
                <>
                  <AlertTriangle size={16} />
                  <span>
                    Turno abierto desde el {formatearFechaLarga(turnoAbierto.fecha)} a las{" "}
                    {formatearHora(turnoAbierto.hora_entrada)} — olvidaste marcar salida
                    {diasAbierto === 1 ? " ayer" : ` hace ${diasAbierto} días`}. Avísale al
                    jefe si algo quedó mal registrado.
                  </span>
                </>
              ) : (
                <>
                  <Clock size={16} />
                  {turnoAbierto
                    ? `Turno en curso desde las ${formatearHora(turnoAbierto.hora_entrada)}`
                    : "No hay ningún turno abierto"}
                </>
              )}
            </div>
          )}

          {!confirmandoSalida && (
            <div className="hor-botones">
              <button
                className="hor-btn-entrada"
                onClick={handleEntrada}
                disabled={enviando || !!turnoAbiertoHoy || cargandoEstado}
              >
                <LogIn size={22} />
                {enviando ? "Marcando..." : "Marcar entrada"}
              </button>

              <button
                className="hor-btn-salida"
                onClick={pedirConfirmacionSalida}
                disabled={enviando || !turnoAbierto || cargandoEstado}
              >
                <LogOut size={22} />
                Marcar salida
              </button>
            </div>
          )}

          {confirmandoSalida && (
            <div className="hor-confirmacion">
              <p>
                ¿<strong>{trabajadoraActual?.nombre}</strong> cierra turno a las{" "}
                <strong>{formatearHora(ahora.toISOString())}</strong>?
              </p>

              <div className="hor-confirmacion-botones">
                <button
                  className="hor-confirmacion-cancelar"
                  onClick={() => setConfirmandoSalida(false)}
                  disabled={enviando}
                >
                  <X size={16} />
                  Cancelar
                </button>

                <button
                  className="hor-confirmacion-confirmar"
                  onClick={confirmarSalida}
                  disabled={enviando}
                >
                  <CheckCircle2 size={16} />
                  {enviando ? "Registrando..." : "Sí, marcar salida"}
                </button>
              </div>
            </div>
          )}

          {!cargandoEstado && (
            <div className="hor-historial">
              <h2>Tus últimos turnos</h2>

              {historial.length === 0 ? (
                <p className="hor-sin-registros">
                  Aún no hay turnos cerrados registrados
                </p>
              ) : (
                <div className="hor-lista">
                  {historial.map((turno) => (
                    <div key={turno.id} className="hor-fila">
                      <span className="hor-fecha">
                        {formatearFechaCorta(turno.fecha)}
                      </span>

                      <span className="hor-horas-rango">
                        {formatearHora(turno.hora_entrada)} -{" "}
                        {formatearHora(turno.hora_salida)}
                      </span>

                      <span className="hor-badge">
                        {turno.horas_trabajadas != null
                          ? `${turno.horas_trabajadas} h`
                          : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}