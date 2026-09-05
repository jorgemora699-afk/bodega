import { useEffect, useState } from "react";
import { Wallet, Pencil, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { calcularSalarios } from "../../../api/admin";
import { actualizarTrabajadora } from "../../../api/trabajadoras";
import { listarHorarios } from "../../../api/horarios";
import "./Salarios.css";

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

export default function Salarios() {
  const [periodoTipo, setPeriodoTipo] = useState("semana");
  const [desde, setDesde] = useState(() => calcularSemana()[0]);
  const [hasta, setHasta] = useState(() => calcularSemana()[1]);

  const [salarios, setSalarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [expandidoId, setExpandidoId] = useState(null);
  const [detallePorId, setDetallePorId] = useState({});

  const [editandoId, setEditandoId] = useState(null);
  const [valorHoraForm, setValorHoraForm] = useState("");
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

    if (!detallePorId[trabajadoraId]) {
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
  }

  function iniciarEdicion(trabajadora) {
    setEditandoId(trabajadora.trabajadora_id);
    setValorHoraForm(trabajadora.valor_hora ?? "");
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setValorHoraForm("");
  }

  async function guardarValorHora(trabajadoraId) {
    setGuardando(true);
    setError(null);
    try {
      await actualizarTrabajadora(trabajadoraId, {
        valor_hora: valorHoraForm ? Number(valorHoraForm) : null,
      });
      setEditandoId(null);
      cargarSalarios();
    } catch (err) {
      setError("No se pudo actualizar el valor por hora");
    } finally {
      setGuardando(false);
    }
  }

  const totalAPagar = salarios.reduce((sum, s) => sum + (s.salario_calculado || 0), 0);

  return (
    <div className="sal-container">
      <header className="sal-header">
        <h1>Salarios</h1>
        <p>Cálculo de pago según horas trabajadas</p>
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
          {salarios.map((s) => (
            <div key={s.trabajadora_id} className="sal-tarjeta">
              <button
                className="sal-tarjeta-header"
                onClick={() => toggleDetalle(s.trabajadora_id)}
              >
                <div className="sal-tarjeta-info">
                  <span className="sal-nombre">{s.trabajadora_nombre}</span>
                  <span className="sal-horas">
                    <Clock size={12} /> {s.total_horas} h
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
                          value={valorHoraForm}
                          onChange={(e) => setValorHoraForm(e.target.value)}
                          placeholder="Valor por hora"
                          autoFocus
                        />
                        <button
                          className="sal-btn-guardar-mini"
                          onClick={() => guardarValorHora(s.trabajadora_id)}
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
                          Valor por hora:{" "}
                          <strong>
                            {s.valor_hora != null ? formatearMoneda(s.valor_hora) : "No configurado"}
                          </strong>
                        </span>
                        <button className="sal-btn-editar-mini" onClick={() => iniciarEdicion(s)}>
                          <Pencil size={13} />
                          Editar
                        </button>
                      </>
                    )}
                  </div>

                  <p className="sal-detalle-titulo">Detalle por día</p>
                  {(detallePorId[s.trabajadora_id] || []).length === 0 ? (
                    <p className="sal-sin-turnos">No hay turnos registrados en este período</p>
                  ) : (
                    <div className="sal-dias-lista">
                      {(detallePorId[s.trabajadora_id] || []).map((turno) => (
                        <div key={turno.id} className="sal-dia-fila">
                          <span>{formatearFechaCorta(turno.fecha)}</span>
                          <span className="sal-dia-horas">
                            {turno.horas_trabajadas != null ? `${turno.horas_trabajadas}h` : "en curso"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {salarios.length === 0 && (
            <p className="sal-sin-datos">No hay trabajadoras activas registradas</p>
          )}
        </div>
      )}
    </div>
  );
}