import { useEffect, useState } from "react";
import { actualizarTrabajadora } from "../../../api/trabajadoras";
import { listarHorarios, actualizarHorario } from "../../../api/horarios";
import "./Salarios.css";
import { Wallet, Pencil, ChevronDown, ChevronUp, Clock, Check, X, Download } from "lucide-react";
import { calcularSalarios, generarPdfTrabajadora, generarReporteGeneralPdf } from "../../../api/admin";

function toISODate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function calcularSemana() {
  const hoy = new Date();
  const diaSemana = hoy.getDay();
  const offset = diaSemana === 0 ? 6 : diaSemana - 1;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - offset);
  return [toISODate(lunes), toISODate(hoy)];
}

function calcularQuincena() {
  const hoy = new Date();
  const dia = hoy.getDate();
  const inicio = dia <= 15
    ? new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    : new Date(hoy.getFullYear(), hoy.getMonth(), 16);
  return [toISODate(inicio), toISODate(hoy)];
}

function calcularMes() {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  return [toISODate(inicio), toISODate(hoy)];
}

const PERIODOS = [
  { valor: "semana", label: "Esta semana", calcular: calcularSemana },
  { valor: "quincena", label: "Quincena actual", calcular: calcularQuincena },
  { valor: "mes", label: "Este mes", calcular: calcularMes },
  { valor: "personalizado", label: "Personalizado", calcular: null },
];

function formatearMoneda(valor) {
  return `$${Number(valor).toLocaleString("es-CO")}`;
}

function formatearFechaCorta(fechaString) {
  const [, mes, dia] = fechaString.split("-");
  return `${dia}/${mes}`;
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

export default function Salarios() {
  const [periodoTipo, setPeriodoTipo] = useState("semana");
  const [desde, setDesde] = useState(() => calcularSemana()[0]);
  const [hasta, setHasta] = useState(() => calcularSemana()[1]);

  const [salarios, setSalarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [generandoPdfId, setGenerandoPdfId] = useState(null);
  const [generandoReporte, setGenerandoReporte] = useState(false);

  const [expandidoId, setExpandidoId] = useState(null);
  const [detallePorId, setDetallePorId] = useState({});

  const [editandoId, setEditandoId] = useState(null);
  const [valorPagoForm, setValorPagoForm] = useState("");

  const [editandoTurnoId, setEditandoTurnoId] = useState(null);
  const [formTurno, setFormTurno] = useState({ hora_entrada: "", hora_salida: "" });

  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarSalarios();
  }, [desde, hasta]);

  function cambiarPeriodo(tipo) {
    setPeriodoTipo(tipo);
    const periodo = PERIODOS.find((p) => p.valor === tipo);
    if (periodo.calcular) {
      const [d, h] = periodo.calcular();
      setDesde(d);
      setHasta(h);
    }
    setExpandidoId(null);
  }

  async function cargarSalarios() {
    setCargando(true);
    setError(null);
    try {
      const data = await calcularSalarios(desde, hasta);
      setSalarios(data);
    } catch (err) {
      setError("No se pudieron calcular los salarios");
    } finally {
      setCargando(false);
    }
  }

  async function toggleDetalle(trabajadoraId) {
    if (expandidoId === trabajadoraId) {
      setExpandidoId(null);
      return;
    }
    setExpandidoId(trabajadoraId);
    setEditandoTurnoId(null);

    if (!detallePorId[trabajadoraId]) {
      await recargarDetalle(trabajadoraId);
    }
  }

  async function recargarDetalle(trabajadoraId) {
    try {
      const historial = await listarHorarios({ trabajadora_id: trabajadoraId });
      const enRango = historial.filter(
        (h) => h.trabajadora_id === trabajadoraId && h.fecha >= desde && h.fecha <= hasta
      );
      setDetallePorId((prev) => ({ ...prev, [trabajadoraId]: enRango }));
    } catch (err) {
      setError("No se pudo cargar el detalle de horario");
    }
  }

  function iniciarEdicion(trabajadora) {
    setEditandoId(trabajadora.trabajadora_id);
    setValorPagoForm(
      trabajadora.tipo_pago === "mensual"
        ? trabajadora.salario_mensual ?? ""
        : trabajadora.valor_hora ?? ""
    );
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
      cargarSalarios();
    } catch (err) {
      setError("No se pudo actualizar el valor de pago");
    } finally {
      setGuardando(false);
    }
  }

  function iniciarEdicionTurno(turno) {
    setEditandoTurnoId(turno.id);
    setFormTurno({
      hora_entrada: isoAHoraInput(turno.hora_entrada),
      hora_salida: isoAHoraInput(turno.hora_salida),
    });
    setError(null);
  }

  function cancelarEdicionTurno() {
    setEditandoTurnoId(null);
    setFormTurno({ hora_entrada: "", hora_salida: "" });
  }

  async function guardarTurno(turnoId, trabajadoraId) {
    setGuardando(true);
    setError(null);

    const payload = {};
    if (formTurno.hora_entrada) payload.hora_entrada = formTurno.hora_entrada;
    if (formTurno.hora_salida) payload.hora_salida = formTurno.hora_salida;

    try {
      await actualizarHorario(turnoId, payload);
      await recargarDetalle(trabajadoraId);
      setEditandoTurnoId(null);
      cargarSalarios();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo actualizar el turno");
    } finally {
      setGuardando(false);
    }
  }

  async function descargarPdf(trabajadoraId, trabajadoraNombre) {
    setGenerandoPdfId(trabajadoraId);
    setError(null);
    try {
      const blob = await generarPdfTrabajadora(trabajadoraId, desde, hasta);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `salario_${trabajadoraNombre.replace(/\s+/g, "_")}_${desde}_${hasta}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
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
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `reporte_nomina_${desde}_${hasta}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError("No se pudo generar el reporte");
    } finally {
      setGenerandoReporte(false);
    }
  }

  const totalAPagar = salarios.reduce((sum, s) => sum + (s.salario_calculado || 0), 0);

  return (
    <div className="sal-container">
      <header className="sal-header">
        <div>
          <h1>Salarios</h1>
          <p>Cálculo de pago según horas trabajadas o sueldo fijo</p>
        </div>
        {!cargando && salarios.length > 0 && (
          <button
            className="sal-btn-reporte"
            onClick={descargarReporteGeneral}
            disabled={generandoReporte}
          >
            <Download size={15} />
            {generandoReporte ? "Generando..." : "Reporte PDF"}
          </button>
        )}
      </header>

      <div className="sal-periodos">
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
            <label>Desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <label>Hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>
      )}

      {error && <div className="sal-mensaje-error">{error}</div>}

      {!cargando && salarios.length > 0 && (
        <div className="sal-total-general">
          <Wallet size={16} />
          <span>Total a pagar en el período</span>
          <span className="sal-total-general-valor">{formatearMoneda(totalAPagar)}</span>
        </div>
      )}

      {cargando ? (
        <p className="sal-cargando">Calculando...</p>
      ) : (
        <div className="sal-lista">
          {salarios.map((s) => {
            const esMensual = s.tipo_pago === "mensual";
            return (
              <div key={s.trabajadora_id} className="sal-tarjeta">
                <button
                  className="sal-tarjeta-header"
                  onClick={() => toggleDetalle(s.trabajadora_id)}
                >
                  <div className="sal-tarjeta-info">
                    <span className="sal-nombre">{s.trabajadora_nombre}</span>
                    <span className="sal-horas">
                      {esMensual ? <Wallet size={12} /> : <Clock size={12} />}
                      {esMensual ? "Sueldo fijo" : `${s.total_horas} h`}
                    </span>
                  </div>
                  <div className="sal-tarjeta-derecha">
                    <span className={`sal-monto ${s.salario_calculado == null ? "sin-configurar" : ""}`}>
                      {s.salario_calculado != null ? formatearMoneda(s.salario_calculado) : "Sin configurar"}
                    </span>
                    {expandidoId === s.trabajadora_id ? (
                      <ChevronUp size={16} />
                    ) : (
                      <ChevronDown size={16} />
                    )}
                  </div>
                </button>

                {expandidoId === s.trabajadora_id && (
                  <div className="sal-detalle">
                    <div className="sal-valor-hora-row">
                      {editandoId === s.trabajadora_id ? (
                        <>
                          <input
                            type="number"
                            min="0"
                            className="sal-valor-hora-input"
                            value={valorPagoForm}
                            onChange={(e) => setValorPagoForm(e.target.value)}
                            placeholder={esMensual ? "Salario mensual" : "Valor por hora"}
                            autoFocus
                          />
                          <button
                            className="sal-btn-guardar-mini"
                            onClick={() => guardarValorPago(s.trabajadora_id, s.tipo_pago)}
                            disabled={guardando}
                          >
                            Guardar
                          </button>
                          <button className="sal-btn-cancelar-mini" onClick={cancelarEdicion}>
                            Cancelar
                          </button>
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

                    {esMensual && (
                      <p className="sal-nota-prorrateo">
                        Prorrateado a {s.total_horas > 0 ? "las horas del período" : "los días del período"}
                        {" "}(sueldo completo / 30 × días del rango).
                      </p>
                    )}

                    <div className="sal-detalle-header-row">
                      <p className="sal-detalle-titulo">Detalle por día</p>
                      <button
                        className="sal-btn-pdf-individual"
                        onClick={() => descargarPdf(s.trabajadora_id, s.trabajadora_nombre)}
                        disabled={generandoPdfId === s.trabajadora_id}
                      >
                        <Download size={13} />
                        {generandoPdfId === s.trabajadora_id ? "Generando..." : "PDF"}
                      </button>
                    </div>

                    {(detallePorId[s.trabajadora_id] || []).length === 0 ? (
                      <p className="sal-sin-turnos">No hay turnos registrados en este período</p>
                    ) : (
                      <div className="sal-dias-lista">
                        {(detallePorId[s.trabajadora_id] || []).map((turno) =>
                          editandoTurnoId === turno.id ? (
                            <div key={turno.id} className="sal-dia-fila-edit">
                              <span className="sal-dia-fecha">{formatearFechaCorta(turno.fecha)}</span>
                              <div className="sal-dia-edit-inputs">
                                <input
                                  type="time"
                                  value={formTurno.hora_entrada}
                                  onChange={(e) =>
                                    setFormTurno((f) => ({ ...f, hora_entrada: e.target.value }))
                                  }
                                />
                                <span>-</span>
                                <input
                                  type="time"
                                  value={formTurno.hora_salida}
                                  onChange={(e) =>
                                    setFormTurno((f) => ({ ...f, hora_salida: e.target.value }))
                                  }
                                />
                              </div>
                              <div className="sal-dia-edit-botones">
                                <button
                                  className="sal-dia-edit-cancelar"
                                  onClick={cancelarEdicionTurno}
                                  disabled={guardando}
                                >
                                  <X size={13} />
                                </button>
                                <button
                                  className="sal-dia-edit-guardar"
                                  onClick={() => guardarTurno(turno.id, s.trabajadora_id)}
                                  disabled={guardando}
                                >
                                  <Check size={13} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div key={turno.id} className="sal-dia-fila">
                              <span className="sal-dia-fecha">{formatearFechaCorta(turno.fecha)}</span>
                              <span className="sal-dia-rango">
                                {formatearHora(turno.hora_entrada)} - {formatearHora(turno.hora_salida)}
                              </span>
                              <span className="sal-dia-horas">
                                {turno.horas_trabajadas != null ? `${turno.horas_trabajadas}h` : "en curso"}
                              </span>
                              <button
                                className="sal-dia-editar-btn"
                                onClick={() => iniciarEdicionTurno(turno)}
                              >
                                <Pencil size={12} />
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {salarios.length === 0 && (
            <p className="sal-sin-datos">No hay trabajadoras activas registradas</p>
          )}
        </div>
      )}
    </div>
  );
}