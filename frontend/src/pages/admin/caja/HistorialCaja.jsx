import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Calendar,
  Landmark,
  Pencil,
  Trash2,
  Plus,
  PencilLine,
} from "lucide-react";
import {
  listarTurnosCaja,
  obtenerTurnoCaja,
  editarTurnoCaja,
  agregarMovimientoATurno,
  editarMovimientoCaja,
  eliminarMovimientoCaja,
} from "../../../api/caja";
import { listarTrabajadoras } from "../../../api/trabajadoras";
import Sheet from "../../../components/Sheet";
import CampoMoneda from "../../../components/CampoMoneda";
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

function fechaHora(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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

const MOV_VACIO = { turnoId: null, id: null, tipo: "egreso", monto: "", motivo: "" };

export default function HistorialCaja() {
  const [desde, setDesde] = useState(() => haceDias(7));
  const [hasta, setHasta] = useState(() => isoLocal(new Date()));
  const [trabajadoraId, setTrabajadoraId] = useState("");

  const [trabajadoras, setTrabajadoras] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  const [abiertoId, setAbiertoId] = useState(null);
  const [detalles, setDetalles] = useState({});
  const [cargandoDetalleId, setCargandoDetalleId] = useState(null);

  /* Edición del turno */
  const [turnoEditando, setTurnoEditando] = useState(null);
  const [formTurno, setFormTurno] = useState({
    monto_apertura: "",
    efectivo_contado: "",
    trabajadora_id: "",
    notas: "",
  });

  /* Movimiento (nuevo o editado) */
  const [movForm, setMovForm] = useState(null);
  const [confirmandoMovId, setConfirmandoMovId] = useState(null);

  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState(null);

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

  /* Vuelve a pedir el turno y actualiza la tarjeta y su detalle */
  async function refrescarTurno(id) {
    const data = await obtenerTurnoCaja(id);
    setDetalles((prev) => ({ ...prev, [id]: data }));
    setTurnos((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
  }

  /* ---------- Editar turno ---------- */

  function abrirEdicionTurno(turno) {
    setErrorForm(null);
    setMensaje(null);
    setFormTurno({
      monto_apertura: turno.monto_apertura,
      efectivo_contado: turno.efectivo_contado ?? "",
      trabajadora_id: turno.trabajadora_id,
      notas: turno.notas || "",
    });
    setTurnoEditando(turno);
  }

  function cerrarEdicionTurno(abierto) {
    if (!abierto) setTurnoEditando(null);
  }

  async function guardarTurno() {
    if (formTurno.monto_apertura === "" || formTurno.monto_apertura == null) {
      setErrorForm("Ingresa el monto de apertura");
      return;
    }
    const cerrado = turnoEditando.estado === "cerrado";
    if (cerrado && (formTurno.efectivo_contado === "" || formTurno.efectivo_contado == null)) {
      setErrorForm("Ingresa el efectivo contado");
      return;
    }

    setGuardando(true);
    setErrorForm(null);

    const payload = {
      monto_apertura: Number(formTurno.monto_apertura),
      trabajadora_id: Number(formTurno.trabajadora_id),
      notas: formTurno.notas,
    };
    if (cerrado) payload.efectivo_contado = Number(formTurno.efectivo_contado);

    try {
      await editarTurnoCaja(turnoEditando.id, payload);
      await refrescarTurno(turnoEditando.id);
      setMensaje("Turno actualizado. El cambio quedó en el historial.");
      setTurnoEditando(null);
    } catch (err) {
      setErrorForm(err.response?.data?.error || "No se pudo guardar el turno");
    } finally {
      setGuardando(false);
    }
  }

  /* ---------- Movimientos ---------- */

  function abrirMovimientoNuevo(turno) {
    setErrorForm(null);
    setMensaje(null);
    setMovForm({ ...MOV_VACIO, turnoId: turno.id });
  }

  function abrirMovimientoEdicion(turno, m) {
    setErrorForm(null);
    setMensaje(null);
    setMovForm({
      turnoId: turno.id,
      id: m.id,
      tipo: m.tipo,
      monto: m.monto,
      motivo: m.motivo,
    });
  }

  function cerrarMovimiento(abierto) {
    if (!abierto) setMovForm(null);
  }

  function avisoTrasMovimiento(turnoId, texto) {
    const turno = turnos.find((t) => t.id === turnoId);
    setMensaje(
      turno?.estado === "cerrado"
        ? `${texto} El efectivo esperado cambió: revisa el efectivo contado.`
        : texto
    );
  }

  async function guardarMovimiento() {
    if (!movForm.monto || Number(movForm.monto) <= 0) {
      setErrorForm("Ingresa un monto mayor a cero");
      return;
    }
    if (!movForm.motivo.trim()) {
      setErrorForm("Escribe el motivo");
      return;
    }

    setGuardando(true);
    setErrorForm(null);

    const payload = {
      tipo: movForm.tipo,
      monto: Number(movForm.monto),
      motivo: movForm.motivo.trim(),
    };

    try {
      if (movForm.id) {
        await editarMovimientoCaja(movForm.id, payload);
      } else {
        await agregarMovimientoATurno(movForm.turnoId, payload);
      }
      await refrescarTurno(movForm.turnoId);
      avisoTrasMovimiento(
        movForm.turnoId,
        movForm.id ? "Movimiento actualizado." : "Movimiento agregado."
      );
      setMovForm(null);
    } catch (err) {
      setErrorForm(err.response?.data?.error || "No se pudo guardar el movimiento");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarMovimiento(turnoId, movimientoId) {
    setGuardando(true);
    setError(null);
    try {
      await eliminarMovimientoCaja(movimientoId);
      await refrescarTurno(turnoId);
      setConfirmandoMovId(null);
      avisoTrasMovimiento(turnoId, "Movimiento eliminado.");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo eliminar el movimiento");
    } finally {
      setGuardando(false);
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

      {mensaje && <div className="hc-mensaje-exito">{mensaje}</div>}
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
            const historial = turno.historial_ediciones || [];

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
                        {turno.editado && <span className="hc-badge-editado">Editado</span>}
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
                        <div className="hc-editar-barra">
                          <button
                            type="button"
                            className="hc-btn-editar"
                            onClick={() => abrirEdicionTurno(turno)}
                          >
                            <Pencil size={13} />
                            Editar turno
                          </button>
                        </div>

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

                        {!cerrado && turno.notas && (
                          <div className="hc-bloque">
                            <h3>Notas</h3>
                            <p className="hc-notas">“{turno.notas}”</p>
                          </div>
                        )}

                        <div className="hc-bloque">
                          <div className="hc-bloque-cabecera">
                            <h3>Movimientos de caja ({detalle.movimientos.length})</h3>
                            <button
                              type="button"
                              className="hc-btn-mini"
                              onClick={() => abrirMovimientoNuevo(turno)}
                            >
                              <Plus size={12} />
                              Agregar
                            </button>
                          </div>

                          {detalle.movimientos.length === 0 ? (
                            <p className="hc-detalle-vacio">Sin movimientos</p>
                          ) : (
                            detalle.movimientos.map((m) => (
                              <div key={m.id} className="hc-mov">
                                <div className="hc-fila">
                                  <span>
                                    {m.motivo} <small>· {hora(m.creado_en)}</small>
                                  </span>
                                  <strong className={m.tipo === "egreso" ? "menos" : "mas"}>
                                    {m.tipo === "egreso" ? "−" : "+"} {moneda(m.monto)}
                                  </strong>
                                </div>

                                {confirmandoMovId === m.id ? (
                                  <div className="hc-mov-confirmar">
                                    <span>¿Eliminar este movimiento?</span>
                                    <button
                                      type="button"
                                      className="hc-btn-mini"
                                      onClick={() => setConfirmandoMovId(null)}
                                      disabled={guardando}
                                    >
                                      No
                                    </button>
                                    <button
                                      type="button"
                                      className="hc-btn-mini peligro"
                                      onClick={() => eliminarMovimiento(turno.id, m.id)}
                                      disabled={guardando}
                                    >
                                      Sí, eliminar
                                    </button>
                                  </div>
                                ) : (
                                  <div className="hc-mov-acciones">
                                    <button
                                      type="button"
                                      className="hc-icono-btn"
                                      onClick={() => abrirMovimientoEdicion(turno, m)}
                                      aria-label="Editar movimiento"
                                    >
                                      <Pencil size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      className="hc-icono-btn peligro"
                                      onClick={() => setConfirmandoMovId(m.id)}
                                      aria-label="Eliminar movimiento"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                )}
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

                        {historial.length > 0 && (
                          <div className="hc-bloque hc-historial">
                            <h3>
                              <PencilLine size={12} /> Historial de cambios ({historial.length})
                            </h3>
                            {[...historial].reverse().map((h, i) => (
                              <div key={i} className="hc-historial-item">
                                <small>{fechaHora(h.fecha)} · Administrador</small>
                                <ul>
                                  {h.cambios.map((c, j) => (
                                    <li key={j}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ---------- Editar turno ---------- */}

      <Sheet
        open={Boolean(turnoEditando)}
        onOpenChange={cerrarEdicionTurno}
        title={
          turnoEditando
            ? `Editar turno ${turnoEditando.numero_dia} · ${fechaCorta(turnoEditando.fecha)}`
            : "Editar turno"
        }
      >
        {turnoEditando && (
          <div className="hc-form">
            {errorForm && <div className="hc-mensaje-error">{errorForm}</div>}

            <label>Monto de apertura</label>
            <CampoMoneda
              value={formTurno.monto_apertura}
              onChange={(v) => setFormTurno((f) => ({ ...f, monto_apertura: v }))}
            />

            {turnoEditando.estado === "cerrado" && (
              <>
                <label>Efectivo contado</label>
                <CampoMoneda
                  value={formTurno.efectivo_contado}
                  onChange={(v) => setFormTurno((f) => ({ ...f, efectivo_contado: v }))}
                />
                <p className="hc-form-ayuda">
                  El esperado y la diferencia se recalculan al guardar.
                </p>
              </>
            )}

            <label>Responsable del turno</label>
            <select
              value={formTurno.trabajadora_id}
              onChange={(e) => setFormTurno((f) => ({ ...f, trabajadora_id: e.target.value }))}
            >
              {trabajadoras.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>

            <label>Notas</label>
            <textarea
              rows={3}
              value={formTurno.notas}
              onChange={(e) => setFormTurno((f) => ({ ...f, notas: e.target.value }))}
              placeholder="Opcional"
            />

            <p className="hc-form-ayuda">
              Cada cambio queda registrado en el historial del turno.
            </p>

            <button className="hc-btn-guardar" onClick={guardarTurno} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        )}
      </Sheet>

      {/* ---------- Movimiento ---------- */}

      <Sheet
        open={Boolean(movForm)}
        onOpenChange={cerrarMovimiento}
        title={movForm?.id ? "Editar movimiento" : "Agregar movimiento"}
      >
        {movForm && (
          <div className="hc-form">
            {errorForm && <div className="hc-mensaje-error">{errorForm}</div>}

            <label>Tipo</label>
            <div className="hc-tipos">
              <button
                type="button"
                className={`hc-tipo-btn ${movForm.tipo === "ingreso" ? "activo-ingreso" : ""}`}
                onClick={() => setMovForm((f) => ({ ...f, tipo: "ingreso" }))}
              >
                Ingreso
              </button>
              <button
                type="button"
                className={`hc-tipo-btn ${movForm.tipo === "egreso" ? "activo-egreso" : ""}`}
                onClick={() => setMovForm((f) => ({ ...f, tipo: "egreso" }))}
              >
                Egreso
              </button>
            </div>

            <label>Monto</label>
            <CampoMoneda
              value={movForm.monto}
              onChange={(v) => setMovForm((f) => ({ ...f, monto: v }))}
            />

            <label>Motivo</label>
            <input
              type="text"
              maxLength={200}
              value={movForm.motivo}
              onChange={(e) => setMovForm((f) => ({ ...f, motivo: e.target.value }))}
              placeholder="Ej: Compra de hielo"
            />

            <button className="hc-btn-guardar" onClick={guardarMovimiento} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}