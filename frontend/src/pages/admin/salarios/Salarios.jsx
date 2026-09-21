import { useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { actualizarTrabajadora } from "../../../api/trabajadoras";
import { listarHorarios, actualizarHorario } from "../../../api/horarios";
import "./Salarios.css";
import {
  Wallet,
  Pencil,
  ChevronDown,
  ChevronUp,
  Clock,
  Check,
  X,
  Download,
  AlertTriangle,
  Users,
} from "lucide-react";
import {
  calcularSalarios,
  generarPdfTrabajadora,
  generarReporteGeneralPdf,
} from "../../../api/admin";

/* =========================
   FECHAS Y PERIODOS
   ========================= */

function toISODate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseISO(fechaString) {
  const [y, m, d] = fechaString.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function diasRango(desde, hasta) {
  return Math.round((parseISO(hasta) - parseISO(desde)) / 86400000) + 1;
}

function lunesDeEstaSemana() {
  const hoy = new Date();
  const offset = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - offset);
  return lunes;
}

function calcularSemana() {
  return [toISODate(lunesDeEstaSemana()), toISODate(new Date())];
}

function calcularSemanaPasada() {
  const lunesActual = lunesDeEstaSemana();

  const lunes = new Date(lunesActual);
  lunes.setDate(lunesActual.getDate() - 7);

  const domingo = new Date(lunesActual);
  domingo.setDate(lunesActual.getDate() - 1);

  return [toISODate(lunes), toISODate(domingo)];
}

function calcularQuincena() {
  const hoy = new Date();
  const inicio =
    hoy.getDate() <= 15
      ? new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      : new Date(hoy.getFullYear(), hoy.getMonth(), 16);
  return [toISODate(inicio), toISODate(hoy)];
}

function calcularQuincenaAnterior() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = hoy.getMonth();

  if (hoy.getDate() <= 15) {
    return [toISODate(new Date(y, m - 1, 16)), toISODate(new Date(y, m, 0))];
  }

  return [toISODate(new Date(y, m, 1)), toISODate(new Date(y, m, 15))];
}

function calcularMes() {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  return [toISODate(inicio), toISODate(hoy)];
}

function calcularMesAnterior() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = hoy.getMonth();
  return [toISODate(new Date(y, m - 1, 1)), toISODate(new Date(y, m, 0))];
}

const PERIODOS = [
  { valor: "mes_anterior", label: "Mes anterior", calcular: calcularMesAnterior },
  { valor: "quincena_anterior", label: "Quincena anterior", calcular: calcularQuincenaAnterior },
  { valor: "semana_pasada", label: "Semana pasada", calcular: calcularSemanaPasada },
  { valor: "semana", label: "Esta semana", calcular: calcularSemana },
  { valor: "quincena", label: "Quincena actual", calcular: calcularQuincena },
  { valor: "mes", label: "Este mes", calcular: calcularMes },
  { valor: "personalizado", label: "Personalizado", calcular: null },
];

/* =========================
   FORMATOS
   ========================= */

function formatearMoneda(valor) {
  return `$${Number(valor).toLocaleString("es-CO")}`;
}

function formatearHoras(valor) {
  return `${Number(valor || 0).toLocaleString("es-CO", {
    maximumFractionDigits: 2,
  })} h`;
}

function formatearFechaCorta(fechaString) {
  const [, mes, dia] = fechaString.split("-");
  return `${dia}/${mes}`;
}

function formatearDiaLargo(fechaString) {
  const diaSemana = parseISO(fechaString)
    .toLocaleDateString("es-CO", { weekday: "short" })
    .replace(".", "");

  return `${diaSemana.charAt(0).toUpperCase()}${diaSemana.slice(1)} ${formatearFechaCorta(fechaString)}`;
}

function formatearHora(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleTimeString("es-CO", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function isoAHoraInput(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function ahoraHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function iniciales(nombre) {
  const partes = (nombre || "").trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] || "") + (partes[1]?.[0] || "")).toUpperCase() || "?";
}

/* Horas por día para la mini gráfica (rellena días vacíos si el rango es corto) */
function datosHorasPorDia(turnos, desde, hasta) {
  const mapa = {};

  turnos.forEach((t) => {
    mapa[t.fecha] = (mapa[t.fecha] || 0) + (Number(t.horas_trabajadas) || 0);
  });

  const redondear = (n) => Math.round(n * 100) / 100;
  const dias = diasRango(desde, hasta);

  if (dias <= 31) {
    const inicio = parseISO(desde);

    return Array.from({ length: dias }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      const fecha = toISODate(d);
      return { fecha, horas: redondear(mapa[fecha] || 0) };
    });
  }

  return Object.keys(mapa)
    .sort()
    .map((fecha) => ({ fecha, horas: redondear(mapa[fecha]) }));
}

/* =========================
   COMPONENTES PEQUEÑOS
   ========================= */

function Skeleton({ className = "", style }) {
  return <div className={`sal-skeleton ${className}`} style={style} />;
}

function TooltipHoras({ active, payload }) {
  if (!active || !payload?.length) return null;

  const dato = payload[0].payload;

  return (
    <div className="sal-tooltip">
      <span>{formatearDiaLargo(dato.fecha)}</span>
      <strong>{formatearHoras(dato.horas)}</strong>
    </div>
  );
}

function GraficaHoras({ datos }) {
  return (
    <div className="sal-grafica">
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={datos} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--color-border)"
          />

          <XAxis
            dataKey="fecha"
            tickFormatter={(f) => f.split("-")[2]}
            tick={{ fontSize: 10, fill: "var(--color-text-secondary)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={8}
          />

          <YAxis
            tickFormatter={(v) => `${v}h`}
            tick={{ fontSize: 10, fill: "var(--color-text-secondary)" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={32}
          />

          <Tooltip
            cursor={{ fill: "rgba(0, 0, 0, 0.04)" }}
            content={<TooltipHoras />}
          />

          <Bar dataKey="horas" radius={[4, 4, 0, 0]} maxBarSize={22}>
            {datos.map((d) => (
              <Cell
                key={d.fecha}
                fill={d.horas > 10 ? "var(--color-danger)" : "var(--color-brand)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* =========================
   PANTALLA
   ========================= */

export default function Salarios() {
  const [periodoTipo, setPeriodoTipo] = useState("semana");
  const [desde, setDesde] = useState(() => calcularSemana()[0]);
  const [hasta, setHasta] = useState(() => calcularSemana()[1]);
  const esPersonalizado = useRef(false);

  const [salarios, setSalarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [recarga, setRecarga] = useState(0);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  const [generandoPdfId, setGenerandoPdfId] = useState(null);
  const [generandoReporte, setGenerandoReporte] = useState(false);

  const [expandidoId, setExpandidoId] = useState(null);
  const [detallePorId, setDetallePorId] = useState({});

  const [editandoId, setEditandoId] = useState(null);
  const [valorPagoForm, setValorPagoForm] = useState("");

  const [editandoTurnoId, setEditandoTurnoId] = useState(null);
  const [formTurno, setFormTurno] = useState({ hora_entrada: "", hora_salida: "" });
  const [advertenciaTurno, setAdvertenciaTurno] = useState(null);

  const [guardando, setGuardando] = useState(false);

  /* Validación del rango */
  const rangoValido = Boolean(desde && hasta && desde >= "2000-01-01" && desde <= hasta);

  let rangoError = null;
  if (!desde || !hasta) rangoError = "Selecciona ambas fechas";
  else if (desde < "2000-01-01") rangoError = "Revisa la fecha inicial";
  else if (desde > hasta) rangoError = "La fecha inicial debe ser anterior o igual a la final";

  /* Cargar salarios (descarta respuestas viejas; espera un poco en fechas personalizadas) */
  useEffect(() => {
    if (!rangoValido) return undefined;

    let activo = true;
    setCargando(true);
    setError(null);

    const espera = esPersonalizado.current ? 350 : 0;

    const temporizador = setTimeout(async () => {
      try {
        const data = await calcularSalarios(desde, hasta);
        if (activo) setSalarios(data);
      } catch (err) {
        if (activo) setError("No se pudieron calcular los salarios");
      } finally {
        if (activo) setCargando(false);
      }
    }, espera);

    return () => {
      activo = false;
      clearTimeout(temporizador);
    };
  }, [desde, hasta, recarga, rangoValido]);

  /* Aviso de éxito temporal */
  useEffect(() => {
    if (!aviso) return undefined;
    const temporizador = setTimeout(() => setAviso(null), 3000);
    return () => clearTimeout(temporizador);
  }, [aviso]);

  function claveDetalle(trabajadoraId) {
    return `${trabajadoraId}|${desde}|${hasta}`;
  }

  function colapsar() {
    setExpandidoId(null);
    setEditandoId(null);
    setEditandoTurnoId(null);
    setAdvertenciaTurno(null);
  }

  function cambiarPeriodo(tipo) {
    const periodo = PERIODOS.find((p) => p.valor === tipo);

    esPersonalizado.current = tipo === "personalizado";
    setPeriodoTipo(tipo);

    if (periodo.calcular) {
      const [d, h] = periodo.calcular();
      setDesde(d);
      setHasta(h);
    }

    colapsar();
  }

  function cambiarFecha(campo, valor) {
    if (campo === "desde") setDesde(valor);
    else setHasta(valor);

    colapsar();
  }

  async function recargarDetalle(trabajadoraId) {
    const clave = claveDetalle(trabajadoraId);

    try {
      const historial = await listarHorarios({
        trabajadora_id: trabajadoraId,
        desde,
        hasta,
      });

      const enRango = historial
        .filter(
          (h) =>
            h.trabajadora_id === trabajadoraId &&
            h.fecha >= desde &&
            h.fecha <= hasta
        )
        .sort((a, b) => a.fecha.localeCompare(b.fecha));

      setDetallePorId((prev) => ({ ...prev, [clave]: enRango }));
    } catch (err) {
      setDetallePorId((prev) => ({ ...prev, [clave]: null }));
    }
  }

  function reintentarDetalle(trabajadoraId) {
    const clave = claveDetalle(trabajadoraId);
    setDetallePorId((prev) => ({ ...prev, [clave]: undefined }));
    recargarDetalle(trabajadoraId);
  }

  function toggleDetalle(trabajadoraId) {
    if (expandidoId === trabajadoraId) {
      colapsar();
      return;
    }

    setExpandidoId(trabajadoraId);
    setEditandoId(null);
    setEditandoTurnoId(null);
    setAdvertenciaTurno(null);

    if (detallePorId[claveDetalle(trabajadoraId)] === undefined) {
      recargarDetalle(trabajadoraId);
    }
  }

  /* ---------- Valor de pago ---------- */

  function iniciarEdicion(trabajadora) {
    const valor =
      trabajadora.tipo_pago === "mensual"
        ? trabajadora.salario_mensual
        : trabajadora.valor_hora;

    setEditandoId(trabajadora.trabajadora_id);
    setValorPagoForm(
      valor != null && valor !== "" ? String(Math.round(Number(valor))) : ""
    );
  }

  function configurar(trabajadora) {
    const id = trabajadora.trabajadora_id;

    setExpandidoId(id);
    setEditandoTurnoId(null);
    iniciarEdicion(trabajadora);

    if (detallePorId[claveDetalle(id)] === undefined) {
      recargarDetalle(id);
    }
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setValorPagoForm("");
  }

  async function guardarValorPago(trabajadoraId, tipoPago) {
    setGuardando(true);
    setError(null);

    try {
      const campo = tipoPago === "mensual" ? "salario_mensual" : "valor_hora";

      await actualizarTrabajadora(trabajadoraId, {
        [campo]: valorPagoForm ? Number(valorPagoForm) : null,
      });

      setEditandoId(null);
      setAviso("Valor de pago actualizado");
      setRecarga((n) => n + 1);
    } catch (err) {
      setError("No se pudo actualizar el valor de pago");
    } finally {
      setGuardando(false);
    }
  }

  /* ---------- Turnos ---------- */

  function iniciarEdicionTurno(turno, { cerrar = false } = {}) {
    setEditandoTurnoId(turno.id);
    setAdvertenciaTurno(null);
    setFormTurno({
      hora_entrada: isoAHoraInput(turno.hora_entrada),
      hora_salida: cerrar ? ahoraHHMM() : isoAHoraInput(turno.hora_salida),
    });
    setError(null);
  }

  function cancelarEdicionTurno() {
    setEditandoTurnoId(null);
    setAdvertenciaTurno(null);
    setFormTurno({ hora_entrada: "", hora_salida: "" });
  }

  function cambiarHoraTurno(campo, valor) {
    setFormTurno((f) => ({ ...f, [campo]: valor }));
    setAdvertenciaTurno(null);
  }

  async function guardarTurno(turnoId, trabajadoraId) {
    const { hora_entrada, hora_salida } = formTurno;

    /* Advertencia (se confirma guardando por segunda vez) */
    if (hora_entrada && hora_salida) {
      const [he, me] = hora_entrada.split(":").map(Number);
      const [hs, ms] = hora_salida.split(":").map(Number);
      const minutos = hs * 60 + ms - (he * 60 + me);

      let mensaje = null;
      if (minutos <= 0) mensaje = "La salida es anterior o igual a la entrada.";
      else if (minutos > 12 * 60) mensaje = "Este turno dura más de 12 horas.";

      if (mensaje && advertenciaTurno !== mensaje) {
        setAdvertenciaTurno(mensaje);
        return;
      }
    }

    setGuardando(true);
    setError(null);

    const payload = {};
    if (hora_entrada) payload.hora_entrada = hora_entrada;
    if (hora_salida) payload.hora_salida = hora_salida;

    try {
      await actualizarHorario(turnoId, payload);
      await recargarDetalle(trabajadoraId);
      setEditandoTurnoId(null);
      setAdvertenciaTurno(null);
      setAviso("Turno actualizado");
      setRecarga((n) => n + 1);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo actualizar el turno");
    } finally {
      setGuardando(false);
    }
  }

  function teclasTurno(e, turnoId, trabajadoraId) {
    if (e.key === "Enter") {
      e.preventDefault();
      guardarTurno(turnoId, trabajadoraId);
    }

    if (e.key === "Escape") {
      cancelarEdicionTurno();
    }
  }

  /* ---------- PDF ---------- */

  function descargarBlob(blob, nombreArchivo) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nombreArchivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  async function descargarPdf(trabajadoraId, trabajadoraNombre) {
    setGenerandoPdfId(trabajadoraId);
    setError(null);

    try {
      const blob = await generarPdfTrabajadora(trabajadoraId, desde, hasta);
      descargarBlob(
        blob,
        `salario_${trabajadoraNombre.replace(/\s+/g, "_")}_${desde}_${hasta}.pdf`
      );
      setAviso("PDF descargado");
    } catch (err) {
      setError("No se pudo generar el PDF");
    } finally {
      setGenerandoPdfId(null);
    }
  }

  async function descargarReporteGeneral() {
    setGenerandoReporte(true);
    setError(null);

    try {
      const blob = await generarReporteGeneralPdf(desde, hasta);
      descargarBlob(blob, `reporte_nomina_${desde}_${hasta}.pdf`);
      setAviso("Reporte descargado");
    } catch (err) {
      setError("No se pudo generar el reporte");
    } finally {
      setGenerandoReporte(false);
    }
  }

  /* =========================
     DERIVADOS
     ========================= */

  const totalAPagar = salarios.reduce(
    (sum, s) => sum + (s.salario_calculado || 0),
    0
  );

  const totalHoras = salarios.reduce(
    (sum, s) => sum + (Number(s.total_horas) || 0),
    0
  );

  const sinConfigurar = salarios.filter((s) => s.salario_calculado == null);
  const diasDelRango = rangoValido ? diasRango(desde, hasta) : 0;

  const mostrarSkeleton = cargando && salarios.length === 0 && rangoValido;
  const atenuado = cargando || !rangoValido;

  return (
    <div className="sal-container">
      <header className="sal-header">
        <div>
          <h1>Salarios</h1>
          <p>Cálculo de pago según horas trabajadas o sueldo fijo</p>
        </div>

        {salarios.length > 0 && (
          <button
            className="sal-btn-reporte"
            onClick={descargarReporteGeneral}
            disabled={generandoReporte || !rangoValido}
          >
            <Download size={15} />
            {generandoReporte ? "Generando..." : "Reporte PDF"}
          </button>
        )}
      </header>

      <div className="sal-periodos" role="group" aria-label="Periodo">
        {PERIODOS.map((p) => (
          <button
            key={p.valor}
            className={`sal-periodo-btn ${periodoTipo === p.valor ? "activo" : ""}`}
            onClick={() => cambiarPeriodo(p.valor)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {periodoTipo === "personalizado" && (
        <div className="sal-fechas">
          <div>
            <label htmlFor="sal-desde">Desde</label>
            <input
              id="sal-desde"
              type="date"
              value={desde}
              onChange={(e) => cambiarFecha("desde", e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="sal-hasta">Hasta</label>
            <input
              id="sal-hasta"
              type="date"
              value={hasta}
              onChange={(e) => cambiarFecha("hasta", e.target.value)}
            />
          </div>
        </div>
      )}

      {periodoTipo === "personalizado" && rangoError && (
        <div className="sal-mensaje-error">{rangoError}</div>
      )}

      {error && <div className="sal-mensaje-error">{error}</div>}

      {aviso && (
        <div className="sal-mensaje-exito" role="status">
          <Check size={15} />
          {aviso}
        </div>
      )}

      {/* =========================
          SKELETON
          ========================= */}

      {mostrarSkeleton && (
        <>
          <Skeleton className="sal-sk-resumen" />

          <div className="sal-lista">
            <Skeleton className="sal-sk-tarjeta" />
            <Skeleton className="sal-sk-tarjeta" />
            <Skeleton className="sal-sk-tarjeta" />
          </div>
        </>
      )}

      {/* =========================
          RESUMEN
          ========================= */}

      {salarios.length > 0 && (
        <section className={`sal-resumen ${atenuado ? "atenuado" : ""}`}>
          <div className="sal-resumen-fila">
            <div className="sal-resumen-principal">
              <span className="sal-resumen-label">
                <Wallet size={15} />
                Total a pagar
              </span>

              <span className="sal-resumen-total">{formatearMoneda(totalAPagar)}</span>

              {rangoValido && (
                <span className="sal-resumen-rango">
                  Del {formatearFechaCorta(desde)} al {formatearFechaCorta(hasta)} ·{" "}
                  {diasDelRango} día{diasDelRango === 1 ? "" : "s"}
                </span>
              )}
            </div>

            <div className="sal-resumen-stats">
              <div>
                <strong>{formatearHoras(totalHoras)}</strong>
                <span>trabajadas</span>
              </div>

              <div>
                <strong>{salarios.length}</strong>
                <span>trabajadora{salarios.length === 1 ? "" : "s"}</span>
              </div>
            </div>
          </div>

          {sinConfigurar.length > 0 && (
            <div className="sal-resumen-alerta">
              <AlertTriangle size={14} />
              <span>
                Falta configurar el pago de{" "}
                {sinConfigurar.map((s) => s.trabajadora_nombre).join(", ")}:{" "}
                {sinConfigurar.length === 1 ? "no se incluye" : "no se incluyen"} en el total.
              </span>
            </div>
          )}
        </section>
      )}

      {/* =========================
          LISTA
          ========================= */}

      {!cargando && rangoValido && salarios.length === 0 && !error && (
        <div className="sal-vacio">
          <Users size={28} />
          <p>No hay trabajadoras activas registradas</p>
        </div>
      )}

      {salarios.length > 0 && (
        <div className={`sal-lista ${atenuado ? "atenuada" : ""}`}>
          {salarios.map((s) => {
            const id = s.trabajadora_id;
            const esMensual = s.tipo_pago === "mensual";
            const abierto = expandidoId === id;
            const sinConfig = s.salario_calculado == null;

            const pct =
              !sinConfig && totalAPagar > 0
                ? Math.round((s.salario_calculado / totalAPagar) * 100)
                : null;

            const turnos = detallePorId[claveDetalle(id)];
            const cargaOk = Array.isArray(turnos);

            const horasDetalle = cargaOk
              ? turnos.reduce((sum, t) => sum + (Number(t.horas_trabajadas) || 0), 0)
              : 0;

            /* Nota del prorrateo (solo si el cálculo coincide con el backend) */
            let notaProrrateo = null;
            if (esMensual && s.salario_mensual != null && diasDelRango > 0) {
              const esperado = Math.round((Number(s.salario_mensual) / 30) * diasDelRango);

              notaProrrateo =
                s.salario_calculado != null &&
                Math.abs(esperado - Number(s.salario_calculado)) <= 1
                  ? `Sueldo ${formatearMoneda(s.salario_mensual)} ÷ 30 × ${diasDelRango} día${
                      diasDelRango === 1 ? "" : "s"
                    } = ${formatearMoneda(s.salario_calculado)}`
                  : "Sueldo fijo prorrateado por los días del período (sueldo ÷ 30 × días).";
            }

            return (
              <div key={id} className="sal-tarjeta">
                <button
                  className="sal-tarjeta-header"
                  onClick={() => toggleDetalle(id)}
                  aria-expanded={abierto}
                >
                  <span className="sal-avatar">{iniciales(s.trabajadora_nombre)}</span>

                  <span className="sal-tarjeta-info">
                    <span className="sal-nombre">{s.trabajadora_nombre}</span>

                    <span className="sal-horas">
                      {esMensual ? <Wallet size={12} /> : <Clock size={12} />}
                      {esMensual ? "Sueldo fijo" : formatearHoras(s.total_horas)}
                      {pct != null && ` · ${pct}% del total`}
                    </span>

                    {pct != null && (
                      <span className="sal-barra">
                        <span className="sal-barra-fill" style={{ width: `${pct}%` }} />
                      </span>
                    )}
                  </span>

                  <span className="sal-tarjeta-derecha">
                    <span className={`sal-monto ${sinConfig ? "sin-configurar" : ""}`}>
                      {sinConfig ? "Sin configurar" : formatearMoneda(s.salario_calculado)}
                    </span>

                    {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </button>

                {sinConfig && editandoId !== id && (
                  <div className="sal-configurar">
                    <span>
                      <AlertTriangle size={13} />
                      {esMensual ? "Falta el salario mensual" : "Falta el valor por hora"}
                    </span>

                    <button type="button" onClick={() => configurar(s)}>
                      Configurar
                    </button>
                  </div>
                )}

                {abierto && (
                  <div className="sal-detalle">
                    {/* ---------- Valor de pago ---------- */}

                    <div className="sal-valor-hora-row">
                      {editandoId === id ? (
                        <>
                          <div className="sal-valor-input">
                            <span>$</span>

                            <input
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              autoFocus
                              value={
                                valorPagoForm
                                  ? Number(valorPagoForm).toLocaleString("es-CO")
                                  : ""
                              }
                              onChange={(e) =>
                                setValorPagoForm(e.target.value.replace(/\D/g, "").slice(0, 9))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") guardarValorPago(id, s.tipo_pago);
                                if (e.key === "Escape") cancelarEdicion();
                              }}
                              placeholder={esMensual ? "Salario mensual" : "Valor por hora"}
                              aria-label={esMensual ? "Salario mensual" : "Valor por hora"}
                            />
                          </div>

                          <button
                            className="sal-btn-guardar-mini"
                            onClick={() => guardarValorPago(id, s.tipo_pago)}
                            disabled={guardando}
                          >
                            Guardar
                          </button>

                          <button className="sal-btn-cancelar-mini" onClick={cancelarEdicion}>
                            Cancelar
                          </button>

                          <p className="sal-hint">
                            Enter guarda · Esc cancela · vacío quita el valor
                          </p>
                        </>
                      ) : (
                        <>
                          <span className="sal-valor-hora-label">
                            {esMensual ? "Salario mensual: " : "Valor por hora: "}
                            <strong>
                              {esMensual
                                ? s.salario_mensual != null
                                  ? formatearMoneda(s.salario_mensual)
                                  : "No configurado"
                                : s.valor_hora != null
                                ? formatearMoneda(s.valor_hora)
                                : "No configurado"}
                            </strong>
                          </span>

                          <button className="sal-btn-editar-mini" onClick={() => iniciarEdicion(s)}>
                            <Pencil size={13} />
                            Editar
                          </button>
                        </>
                      )}
                    </div>

                    {notaProrrateo && <p className="sal-nota-prorrateo">{notaProrrateo}</p>}

                    {/* ---------- Detalle por día ---------- */}

                    <div className="sal-detalle-header-row">
                      <p className="sal-detalle-titulo">Detalle por día</p>

                      <button
                        className="sal-btn-pdf-individual"
                        onClick={() => descargarPdf(id, s.trabajadora_nombre)}
                        disabled={generandoPdfId === id}
                      >
                        <Download size={13} />
                        {generandoPdfId === id ? "Generando..." : "PDF"}
                      </button>
                    </div>

                    {turnos === undefined && (
                      <div className="sal-dias-lista">
                        <Skeleton className="sal-sk-fila" />
                        <Skeleton className="sal-sk-fila" />
                        <Skeleton className="sal-sk-fila" />
                      </div>
                    )}

                    {turnos === null && (
                      <div className="sal-detalle-error">
                        <span>No se pudo cargar el detalle de horario</span>

                        <button type="button" onClick={() => reintentarDetalle(id)}>
                          Reintentar
                        </button>
                      </div>
                    )}

                    {cargaOk && turnos.length === 0 && (
                      <p className="sal-sin-turnos">No hay turnos registrados en este período</p>
                    )}

                    {cargaOk && turnos.length > 1 && (
                      <GraficaHoras datos={datosHorasPorDia(turnos, desde, hasta)} />
                    )}

                    {cargaOk && turnos.length > 0 && (
                      <div className="sal-dias-lista">
                        {turnos.map((turno) => {
                          if (editandoTurnoId === turno.id) {
                            return (
                              <div
                                key={turno.id}
                                className="sal-dia-fila-edit"
                                onKeyDown={(e) => teclasTurno(e, turno.id, id)}
                              >
                                <span className="sal-dia-fecha">
                                  {formatearFechaCorta(turno.fecha)}
                                </span>

                                <div className="sal-dia-edit-inputs">
                                  <input
                                    type="time"
                                    aria-label="Hora de entrada"
                                    value={formTurno.hora_entrada}
                                    onChange={(e) => cambiarHoraTurno("hora_entrada", e.target.value)}
                                  />

                                  <span>-</span>

                                  <input
                                    type="time"
                                    aria-label="Hora de salida"
                                    value={formTurno.hora_salida}
                                    onChange={(e) => cambiarHoraTurno("hora_salida", e.target.value)}
                                    autoFocus={turno.horas_trabajadas == null}
                                  />
                                </div>

                                <div className="sal-dia-edit-botones">
                                  <button
                                    className="sal-dia-edit-cancelar"
                                    aria-label="Cancelar edición del turno"
                                    onClick={cancelarEdicionTurno}
                                    disabled={guardando}
                                  >
                                    <X size={13} />
                                  </button>

                                  <button
                                    className="sal-dia-edit-guardar"
                                    aria-label="Guardar turno"
                                    onClick={() => guardarTurno(turno.id, id)}
                                    disabled={guardando}
                                  >
                                    <Check size={13} />
                                  </button>
                                </div>

                                {advertenciaTurno && (
                                  <p className="sal-dia-advertencia">
                                    <AlertTriangle size={13} />
                                    {advertenciaTurno} Toca ✓ otra vez para guardar de todos modos.
                                  </p>
                                )}
                              </div>
                            );
                          }

                          const enCurso = turno.horas_trabajadas == null;

                          const pago =
                            !esMensual && !enCurso && s.valor_hora != null
                              ? Math.round(Number(turno.horas_trabajadas) * Number(s.valor_hora))
                              : null;

                          return (
                            <div
                              key={turno.id}
                              className={`sal-dia-fila ${enCurso ? "en-curso" : ""}`}
                            >
                              <span className="sal-dia-fecha">
                                {formatearFechaCorta(turno.fecha)}
                              </span>

                              <span className="sal-dia-rango">
                                {formatearHora(turno.hora_entrada)} -{" "}
                                {formatearHora(turno.hora_salida)}
                              </span>

                              <span className="sal-dia-total">
                                {enCurso ? (
                                  <span className="sal-en-curso">
                                    <span className="sal-en-curso-dot" />
                                    En curso
                                  </span>
                                ) : (
                                  <>
                                    <strong>{formatearHoras(turno.horas_trabajadas)}</strong>
                                    {pago != null && <small>{formatearMoneda(pago)}</small>}
                                  </>
                                )}
                              </span>

                              <span className="sal-dia-acciones">
                                {enCurso && (
                                  <button
                                    className="sal-dia-cerrar-btn"
                                    onClick={() => iniciarEdicionTurno(turno, { cerrar: true })}
                                  >
                                    Cerrar
                                  </button>
                                )}

                                <button
                                  className="sal-dia-editar-btn"
                                  aria-label={`Editar turno del ${formatearFechaCorta(turno.fecha)}`}
                                  onClick={() => iniciarEdicionTurno(turno)}
                                >
                                  <Pencil size={13} />
                                </button>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {cargaOk && turnos.length > 0 && (
                      <div className="sal-detalle-total">
                        <span>Total del período</span>

                        <span>
                          {formatearHoras(horasDetalle)}
                          {s.salario_calculado != null && (
                            <>
                              {" · "}
                              <strong>{formatearMoneda(s.salario_calculado)}</strong>
                            </>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}