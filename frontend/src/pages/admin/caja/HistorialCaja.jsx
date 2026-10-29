import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Calendar, Landmark } from "lucide-react";
import { listarTurnosCaja, obtenerTurnoCaja } from "../../../api/caja";
import { listarTrabajadoras } from "../../../api/trabajadoras";
import "./HistorialCaja.css";

function isoLocal(fecha) {
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function haceDias(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoLocal(d);
}

function moneda(valor) {
  return `$${Number(valor || 0).toLocaleString("es-CO")}`;
}

function fechaCorta(fechaISO) {
  return new Date(fechaISO + "T00:00:00").toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function hora(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

function claseDiferencia(diferencia) {
  if (diferencia == null) return "";
  if (diferencia === 0) return "ok";
  return diferencia < 0 ? "falta" : "sobra";
}

function textoDiferencia(diferencia) {
  if (diferencia == null) return "—";
  if (diferencia === 0) return "Cuadra";
  return diferencia < 0
    ? `Falta ${moneda(Math.abs(diferencia))}`
    : `Sobra ${moneda(diferencia)}`;
}

const ETIQUETA_METODO = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  credito: "Cuenta por cobrar",
};

export default function HistorialCaja() {
  const [desde, setDesde] = useState(() => haceDias(7));
  const [hasta, setHasta] = useState(() => isoLocal(new Date()));
  const [trabajadoraId, setTrabajadoraId] = useState("");

  const [trabajadoras, setTrabajadoras] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [abiertoId, setAbiertoId] = useState(null);
  const [detalles, setDetalles] = useState({});
  const [cargandoDetalleId, setCargandoDetalleId] = useState(null);

  useEffect(() => {
    listarTrabajadoras()
      .then(setTrabajadoras)
      .catch(() => {
        /* el filtro por trabajadora simplemente queda vacío */
      });
  }, []);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);

    listarTurnosCaja({
      desde,
      hasta,
      ...(trabajadoraId ? { trabajadora_id: trabajadoraId } : {}),
    })
      .then((data) => {
        if (!activo) return;
        setTurnos(data);
        setDetalles({});
        setAbiertoId(null);
      })
      .catch(() => {
        if (activo) setError("No se pudo cargar el historial de caja");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [desde, hasta, trabajadoraId]);

  async function alternarDetalle(turno) {
    if (abiertoId === turno.id) {
      setAbiertoId(null);
      return;
    }

    setAbiertoId(turno.id);
    if (detalles[turno.id]) return;

    setCargandoDetalleId(turno.id);
    try {
      const data = await obtenerTurnoCaja(turno.id);
      setDetalles((prev) => ({ ...prev, [turno.id]: data }));
    } catch (err) {
      setError("No se pudo cargar el detalle del turno");
    } finally {
      setCargandoDetalleId(null);
    }
  }

  const resumen = useMemo(() => {
    const cerrados = turnos.filter((t) => t.estado === "cerrado");
    const faltantes = cerrados
      .filter((t) => t.diferencia < 0)
      .reduce((s, t) => s + Math.abs(t.diferencia), 0);
    const sobrantes = cerrados
      .filter((t) => t.diferencia > 0)
      .reduce((s, t) => s + t.diferencia, 0);

    return {
      total: turnos.length,
      cerrados: cerrados.length,
      faltantes,
      sobrantes,
    };
  }, [turnos]);

  return (
    <div className="hc-container">
      <header className="hc-header">
        <h1>Caja</h1>
        <p>Historial de turnos: apertura, cierre y diferencias</p>
      </header>

      <div className="hc-filtros">
        <label className="hc-filtro">
          <Calendar size={14} />
          <span>Desde</span>
          <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
        </label>

        <label className="hc-filtro">
          <Calendar size={14} />
          <span>Hasta</span>
          <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
        </label>

        <select
          className="hc-select"
          value={trabajadoraId}
          onChange={(e) => setTrabajadoraId(e.target.value)}
          aria-label="Filtrar por trabajadora"
        >
          <option value="">Todas las trabajadoras</option>
          {trabajadoras.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="hc-mensaje-error">{error}</div>}

      <div className="hc-resumen">
        <div className="hc-resumen-item">
          <span>Turnos</span>
          <strong>{resumen.total}</strong>
        </div>
        <div className="hc-resumen-item falta">
          <span>Faltantes</span>
          <strong>{moneda(resumen.faltantes)}</strong>
        </div>
        <div className="hc-resumen-item sobra">
          <span>Sobrantes</span>
          <strong>{moneda(resumen.sobrantes)}</strong>
        </div>
      </div>

      {cargando && <div className="hc-skeleton" />}

      {!cargando && turnos.length === 0 && (
        <p className="hc-vacio">No hay turnos en el rango seleccionado</p>
      )}

      {!cargando && (
        <div className="hc-lista">
          {turnos.map((turno) => {
            const abierto = abiertoId === turno.id;
            const detalle = detalles[turno.id];
            const cerrado = turno.estado === "cerrado";
            const r = turno.resumen;

            return (
              <div key={turno.id} className={`hc-tarjeta ${abierto ? "abierta" : ""}`}>
                <button
                  type="button"
                  className="hc-tarjeta-cabecera"
                  onClick={() => alternarDetalle(turno)}
                  aria-expanded={abierto}
                >
                  <div className="hc-tarjeta-titulo">
                    <Landmark size={15} />
                    <div>
                      <strong>
                        Turno {turno.numero_dia} · {fechaCorta(turno.fecha)}
                      </strong>
                      <small>
                        {turno.trabajadora_nombre} · {hora(turno.abierto_en)}
                        {cerrado ? ` a ${hora(turno.cerrado_en)}` : ""}
                      </small>
                    </div>
                  </div>

                  <div className="hc-tarjeta-lado">
                    {cerrado ? (
                      <span className={`hc-diferencia ${claseDiferencia(turno.diferencia)}`}>
                        {textoDiferencia(turno.diferencia)}
                      </span>
                    ) : (
                      <span className="hc-badge-abierto">Abierto</span>
                    )}
                    {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                <div className="hc-cifras">
                  <div>
                    <span>Apertura</span>
                    <strong>{moneda(turno.monto_apertura)}</strong>
                  </div>
                  <div>
                    <span>Esperado</span>
                    <strong>
                      {moneda(cerrado ? turno.efectivo_esperado : r?.efectivo_esperado)}
                    </strong>
                  </div>
                  <div>
                    <span>Contado</span>
                    <strong>{cerrado ? moneda(turno.efectivo_contado) : "—"}</strong>
                  </div>
                </div>

                {abierto && (
                  <div className="hc-detalle">
                    {cargandoDetalleId === turno.id && !detalle && (
                      <p className="hc-detalle-cargando">Cargando...</p>
                    )}

                    {detalle && (
                      <>
                        {r && (
                            <div className="hc-bloque">
                                <h3>Efectivo en caja</h3>
                                <div className="hc-fila">
                                <span>Apertura</span>
                                <strong>{moneda(r.monto_apertura)}</strong>
                                </div>
                                <div className="hc-fila">
                                <span>Ventas en efectivo</span>
                                <strong className="mas">+ {moneda(r.ventas_efectivo)}</strong>
                                </div>
                                {r.ingresos > 0 && (
                                <div className="hc-fila">
                                    <span>Ingresos de caja</span>
                                    <strong className="mas">+ {moneda(r.ingresos)}</strong>
                                </div>
                                )}
                                {r.egresos > 0 && (
                                <div className="hc-fila">
                                    <span>Egresos de caja</span>
                                    <strong className="menos">− {moneda(r.egresos)}</strong>
                                </div>
                                )}
                                <div className="hc-fila total">
                                <span>Efectivo esperado</span>
                                <strong>{moneda(r.efectivo_esperado)}</strong>
                                </div>

                                {(r.ventas_transferencia > 0 || r.ventas_credito > 0) && (
                                <>
                                    <h3 className="hc-subtitulo">Ventas que no entran a la caja</h3>
                                    {r.ventas_transferencia > 0 && (
                                    <div className="hc-fila suave">
                                        <span>Transferencia</span>
                                        <strong>{moneda(r.ventas_transferencia)}</strong>
                                    </div>
                                    )}
                                    {r.ventas_credito > 0 && (
                                    <div className="hc-fila suave">
                                        <span>Cuenta por cobrar</span>
                                        <strong>{moneda(r.ventas_credito)}</strong>
                                    </div>
                                    )}
                                </>
                                )}
                            </div>
                        )}

                        {cerrado && (
                          <div className="hc-bloque">
                            <h3>Cierre</h3>
                            <div className="hc-fila">
                              <span>Cerrado por</span>
                              <strong>{turno.cerrado_por}</strong>
                            </div>
                            {turno.notas && <p className="hc-notas">“{turno.notas}”</p>}
                          </div>
                        )}

                        <div className="hc-bloque">
                          <h3>Movimientos de caja ({detalle.movimientos.length})</h3>
                          {detalle.movimientos.length === 0 ? (
                            <p className="hc-detalle-vacio">Sin movimientos</p>
                          ) : (
                            detalle.movimientos.map((m) => (
                              <div key={m.id} className="hc-fila">
                                <span>
                                  {m.motivo} <small>· {hora(m.creado_en)}</small>
                                </span>
                                <strong className={m.tipo === "egreso" ? "menos" : "mas"}>
                                  {m.tipo === "egreso" ? "−" : "+"} {moneda(m.monto)}
                                </strong>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="hc-bloque">
                          <h3>Pedidos del turno ({detalle.ordenes.length})</h3>
                          {detalle.ordenes.length === 0 ? (
                            <p className="hc-detalle-vacio">Sin pedidos</p>
                          ) : (
                            detalle.ordenes.map((o) => (
                              <div key={o.id} className="hc-fila">
                                <span>
                                  Pedido #{o.id}{" "}
                                  <small>
                                    · {hora(o.fecha)} · {ETIQUETA_METODO[o.metodo_pago] || o.metodo_pago}
                                  </small>
                                </span>
                                <strong>{moneda(o.total)}</strong>
                              </div>
                            ))
                          )}
                        </div>
                      </>
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