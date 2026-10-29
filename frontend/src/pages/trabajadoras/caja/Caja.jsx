import { useCallback, useEffect, useState } from "react";
import {
  Wallet,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronLeft,
  ArrowLeftRight,
  Receipt,
  ShoppingBag,
} from "lucide-react";
import { listarTrabajadoras } from "../../../api/trabajadoras";
import {
  obtenerCajaActual,
  abrirCaja,
  cerrarCaja,
  crearMovimientoCaja,
  eliminarMovimientoCaja,
} from "../../../api/caja";
import "./Caja.css";

/* Si es true, la trabajadora no ve el efectivo esperado ni la diferencia
   hasta que cierra el turno (cierre "ciego"). El jefe siempre los ve. */
const CIERRE_CIEGO = false;

const REFRESCO_MS = 30000;

/* Misma clave que usa RegistrarVenta para recordar a la última trabajadora */
const CLAVE_TRABAJADORA = "pa_venta_trabajadora";

const BILLETES = [100000, 50000, 20000, 10000, 5000, 2000, 1000];

/* =========================
   HELPERS
   ========================= */

function esJefeActual() {
  try {
    return localStorage.getItem("rol") === "jefe";
  } catch {
    return false;
  }
}

function leerTrabajadoraGuardada() {
  try {
    return localStorage.getItem(CLAVE_TRABAJADORA) || "";
  } catch {
    return "";
  }
}

function guardarTrabajadora(id) {
  try {
    if (id) {
      localStorage.setItem(CLAVE_TRABAJADORA, String(id));
    }
  } catch {
    /* se ignora */
  }
}

function moneda(valor) {
  return `$${Number(valor || 0).toLocaleString("es-CO")}`;
}

function formatearHora(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatearFechaLarga(fechaString) {
  if (!fechaString) return "";
  const [y, m, d] = fechaString.split("-").map(Number);
  return new Date(y, m - 1, d)
    .toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })
    .replace(/^\w/, (c) => c.toUpperCase());
}

function textoDuracion(isoString, ahora) {
  if (!isoString) return "";
  const minutos = Math.max(0, Math.floor((ahora - new Date(isoString)) / 60000));
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h === 0 ? `${m} min` : `${h} h ${m} min`;
}

function montoSugerido(sugerencia) {
  if (sugerencia == null) return "";
  if (typeof sugerencia === "number") return String(Math.round(sugerencia));
  const v = sugerencia.monto ?? sugerencia.monto_apertura ?? sugerencia.efectivo_contado;
  return v != null ? String(Math.round(Number(v))) : "";
}

function claseDiferencia(valor) {
  if (valor == null) return "";
  if (Number(valor) === 0) return "ok";
  return Number(valor) > 0 ? "sobra" : "falta";
}

function textoDiferencia(valor) {
  const n = Number(valor);
  if (n === 0) return "Cuadra exacto";
  return n > 0 ? `Sobran ${moneda(n)}` : `Faltan ${moneda(Math.abs(n))}`;
}

/* Va FUERA de Caja para que el input no pierda el foco en cada tecla */
function CampoMonto({
  id,
  label,
  value,
  onChange,
  placeholder = "0",
  autoFocus = false,
  grande = false,
}) {
  return (
    <div className="caja-campo">
      {label && <label htmlFor={id}>{label}</label>}

      <div className={`caja-monto-input ${grande ? "grande" : ""}`}>
        <span>$</span>

        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={value ? Number(value).toLocaleString("es-CO") : ""}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 9))}
        />
      </div>
    </div>
  );
}

export default function Caja() {
  const esJefe = esJefeActual();

  const [cargando, setCargando] = useState(true);
  const [turno, setTurno] = useState(null);
  const [sugerencia, setSugerencia] = useState(null);
  const [trabajadoras, setTrabajadoras] = useState([]);
  const [ahora, setAhora] = useState(() => new Date());

  const [vista, setVista] = useState("principal"); // principal | cerrando | resultado
  const [turnoCerrado, setTurnoCerrado] = useState(null);

  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  /* Apertura */
  const [trabajadoraId, setTrabajadoraId] = useState(leerTrabajadoraGuardada);
  const [montoApertura, setMontoApertura] = useState("");

  /* Movimientos */
  const [mostrarMovimiento, setMostrarMovimiento] = useState(false);
  const [tipoMovimiento, setTipoMovimiento] = useState("egreso");
  const [montoMovimiento, setMontoMovimiento] = useState("");
  const [motivoMovimiento, setMotivoMovimiento] = useState("");

  /* Cierre */
  const [modoConteo, setModoConteo] = useState("total"); // total | billetes
  const [efectivoContado, setEfectivoContado] = useState("");
  const [cantidades, setCantidades] = useState({});
  const [monedas, setMonedas] = useState("");
  const [notasCierre, setNotasCierre] = useState("");
  const [cierraId, setCierraId] = useState("");

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);

    try {
      const data = await obtenerCajaActual();
      setTurno(data.turno);
      setSugerencia(data.sugerencia_apertura);
    } catch (err) {
      if (!silencioso) setError("No se pudo consultar el estado de la caja");
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();

    listarTrabajadoras()
      .then((data) => {
        const activas = data.filter((t) => t.activa !== false);
        setTrabajadoras(activas);

        /* Si la trabajadora recordada ya no existe, se limpia */
        setTrabajadoraId((prev) =>
          prev && activas.some((t) => String(t.id) === String(prev)) ? prev : ""
        );
      })
      .catch(() => setError("No se pudieron cargar las trabajadoras"));
  }, [cargar]);

  /* Refresca el resumen cada 30 s: las ventas se registran en otra pantalla */
  useEffect(() => {
    if (!turno || vista !== "principal") return undefined;

    const intervalo = setInterval(() => {
      cargar(true);
      setAhora(new Date());
    }, REFRESCO_MS);

    return () => clearInterval(intervalo);
  }, [turno, vista, cargar]);

  /* Los mensajes desaparecen solos */
  useEffect(() => {
    if (!mensaje) return undefined;
    const t = setTimeout(() => setMensaje(null), 3500);
    return () => clearTimeout(t);
  }, [mensaje]);

  useEffect(() => {
    if (!error) return undefined;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);

  function elegirTrabajadora(id) {
    setTrabajadoraId(String(id));
    guardarTrabajadora(id);
  }

  /* ---------- Abrir ---------- */

  async function handleAbrir() {
    if (!trabajadoraId) {
      setError("Selecciona quién abre la caja");
      return;
    }
    if (montoApertura === "") {
      setError("Ingresa con cuánto efectivo se abre la caja");
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      const nuevo = await abrirCaja({
        trabajadora_id: Number(trabajadoraId),
        monto_apertura: Number(montoApertura),
      });

      setTurno(nuevo);
      setAhora(new Date());
      setMontoApertura("");
      setMensaje("Caja abierta. ¡Buen turno!");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo abrir la caja");
    } finally {
      setEnviando(false);
    }
  }

  /* ---------- Movimientos ---------- */

  function abrirFormMovimiento(tipo) {
    setTipoMovimiento(tipo);
    setMontoMovimiento("");
    setMotivoMovimiento("");
    setMostrarMovimiento(true);
    setError(null);
  }

  async function handleGuardarMovimiento() {
    if (montoMovimiento === "" || Number(montoMovimiento) <= 0) {
      setError("Ingresa un monto mayor a cero");
      return;
    }
    if (!motivoMovimiento.trim()) {
      setError("Escribe el motivo del movimiento");
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      await crearMovimientoCaja({
        tipo: tipoMovimiento,
        monto: Number(montoMovimiento),
        motivo: motivoMovimiento.trim(),
      });

      setMostrarMovimiento(false);
      setMensaje(tipoMovimiento === "egreso" ? "Egreso registrado" : "Ingreso registrado");
      await cargar(true);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo registrar el movimiento");
    } finally {
      setEnviando(false);
    }
  }

  async function handleEliminarMovimiento(mov) {
    const ok = window.confirm(`¿Eliminar ${mov.tipo} de ${moneda(mov.monto)} (${mov.motivo})?`);
    if (!ok) return;

    setError(null);

    try {
      await eliminarMovimientoCaja(mov.id);
      setMensaje("Movimiento eliminado");
      await cargar(true);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo eliminar el movimiento");
    }
  }

  /* ---------- Cerrar ---------- */

  function iniciarCierre() {
    setModoConteo("total");
    setEfectivoContado("");
    setCantidades({});
    setMonedas("");
    setNotasCierre("");
    setCierraId(turno?.trabajadora_id ? String(turno.trabajadora_id) : trabajadoraId);
    setError(null);
    cargar(true); // asegura que el esperado esté al día
    setVista("cerrando");
  }

  function cambiarCantidad(denominacion, delta) {
    setCantidades((prev) => ({
      ...prev,
      [denominacion]: Math.max(0, (Number(prev[denominacion]) || 0) + delta),
    }));
  }

  function escribirCantidad(denominacion, texto) {
    const limpio = texto.replace(/\D/g, "").slice(0, 4);
    setCantidades((prev) => ({ ...prev, [denominacion]: limpio === "" ? 0 : Number(limpio) }));
  }

  async function handleCerrar() {
    if (!hayContado) {
      setError("Ingresa el efectivo que contaste en la caja");
      return;
    }
    if (!cierraId) {
      setError("Selecciona quién cierra el turno");
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      const cerrado = await cerrarCaja({
        efectivo_contado: contadoNum,
        trabajadora_id: Number(cierraId),
        notas: notasCierre.trim() || undefined,
      });

      guardarTrabajadora(cierraId);
      setTurnoCerrado(cerrado);
      setTurno(null);
      setVista("resultado");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo cerrar la caja");
    } finally {
      setEnviando(false);
    }
  }

  function terminarResultado() {
    setTurnoCerrado(null);
    setVista("principal");
    cargar();
  }

  /* ---------- Derivados ---------- */

  const resumen = turno?.resumen;
  const esperadoVisible = esJefe || !CIERRE_CIEGO;
  const sugerido = montoSugerido(sugerencia);
  const movimientos = turno?.movimientos || [];

  const totalBilletes =
    BILLETES.reduce((suma, d) => suma + d * (Number(cantidades[d]) || 0), 0) +
    (Number(monedas) || 0);

  const contadoNum = modoConteo === "billetes" ? totalBilletes : Number(efectivoContado) || 0;
  const hayContado = modoConteo === "billetes" ? totalBilletes > 0 : efectivoContado !== "";

  const diferenciaPrevia =
    resumen && hayContado ? contadoNum - Number(resumen.efectivo_esperado) : null;

  function ChipsTrabajadora({ valor, onElegir, etiqueta }) {
    return (
      <div className="caja-trab-chips" role="radiogroup" aria-label={etiqueta}>
        {trabajadoras.map((t) => {
          const activo = String(t.id) === String(valor);

          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={activo}
              className={`caja-trab-chip ${activo ? "activo" : ""}`}
              onClick={() => onElegir(t.id)}
            >
              {t.nombre}
            </button>
          );
        })}
      </div>
    );
  }

  /* =========================
     RENDER
     ========================= */

  if (cargando) {
    return (
      <div className="caja-container">
        <header className="caja-header">
          <h1>Caja</h1>
        </header>
        <div className="caja-skeleton" />
      </div>
    );
  }

  return (
    <div className="caja-container">
      <header className="caja-header">
        <h1>Caja</h1>
        <p>
          {turno
            ? `Turno ${turno.numero_dia} de hoy · ${formatearFechaLarga(turno.fecha)}`
            : formatearFechaLarga(
                `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(
                  ahora.getDate()
                ).padStart(2, "0")}`
              )}
        </p>
      </header>

      {mensaje && (
        <div className="caja-mensaje-exito" role="status">
          <CheckCircle2 size={16} /> {mensaje}
        </div>
      )}

      {error && (
        <div className="caja-mensaje-error" role="alert">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* =========================
          RESULTADO DEL CIERRE
          ========================= */}

      {vista === "resultado" && turnoCerrado && (
        <div className="caja-tarjeta caja-resultado">
          <div className="caja-resultado-icono">
            <CheckCircle2 size={30} />
          </div>

          <h2>Turno {turnoCerrado.numero_dia} cerrado</h2>

          <div className={`caja-diferencia grande ${claseDiferencia(turnoCerrado.diferencia)}`}>
            {textoDiferencia(turnoCerrado.diferencia)}
          </div>

          <div className="caja-fila">
            <span>Efectivo esperado</span>
            <strong>{moneda(turnoCerrado.efectivo_esperado)}</strong>
          </div>

          <div className="caja-fila">
            <span>Efectivo contado</span>
            <strong>{moneda(turnoCerrado.efectivo_contado)}</strong>
          </div>

          {turnoCerrado.resumen && (
            <>
              <div className="caja-separador" />

              <div className="caja-fila caja-fila-suave">
                <span>Ventas en efectivo</span>
                <span>{moneda(turnoCerrado.resumen.ventas_efectivo)}</span>
              </div>

              <div className="caja-fila caja-fila-suave">
                <span>Ventas por transferencia</span>
                <span>{moneda(turnoCerrado.resumen.ventas_transferencia)}</span>
              </div>

              <div className="caja-fila caja-fila-suave">
                <span>Pedidos del turno</span>
                <span>{turnoCerrado.resumen.num_ordenes}</span>
              </div>
            </>
          )}

          <button className="caja-btn-primario" onClick={terminarResultado}>
            Listo
          </button>
        </div>
      )}

      {/* =========================
          SIN TURNO: ABRIR CAJA
          ========================= */}

      {vista === "principal" && !turno && (
        <>
          <div className="caja-hero">
            <div className="caja-hero-icono">
              <Wallet size={26} />
            </div>

            <h2>La caja está cerrada</h2>
            <p>Abre el turno con el efectivo inicial de la caja.</p>
          </div>

          <div className="caja-tarjeta">
            <span className="caja-etiqueta">¿Quién abre?</span>

            <ChipsTrabajadora
              valor={trabajadoraId}
              onElegir={elegirTrabajadora}
              etiqueta="¿Quién abre?"
            />

            <CampoMonto
              id="caja-monto-apertura"
              label="Efectivo con el que se abre"
              value={montoApertura}
              onChange={setMontoApertura}
              grande
            />

            <div className="caja-chips-fila">
              {sugerido !== "" && montoApertura !== sugerido && (
                <button
                  type="button"
                  className="caja-chip"
                  onClick={() => setMontoApertura(sugerido)}
                >
                  Usar sugerido: {moneda(sugerido)}
                </button>
              )}

              {montoApertura !== "0" && (
                <button type="button" className="caja-chip" onClick={() => setMontoApertura("0")}>
                  Sin base
                </button>
              )}
            </div>

            <button className="caja-btn-primario" onClick={handleAbrir} disabled={enviando}>
              {enviando ? "Abriendo..." : "Abrir turno"}
            </button>
          </div>
        </>
      )}

      {/* =========================
          TURNO ABIERTO
          ========================= */}

      {vista === "principal" && turno && (
        <>
          <div className="caja-estado">
            <span className="caja-estado-punto" />

            <span>
              Abierta a las {formatearHora(turno.abierto_en)} por {turno.trabajadora_nombre} · lleva{" "}
              {textoDuracion(turno.abierto_en, ahora)}
            </span>
          </div>

          <div className="caja-esperado">
            {esperadoVisible ? (
              <>
                <span>Debe haber en la caja</span>
                <strong>{moneda(resumen.efectivo_esperado)}</strong>
              </>
            ) : (
              <>
                <span>Turno en curso</span>
                <strong className="caja-esperado-oculto">Cuenta al cerrar</strong>
              </>
            )}
          </div>

          {esperadoVisible && (
            <div className="caja-tarjeta">
              <h2 className="caja-subtitulo">Cómo se compone</h2>

              <div className="caja-fila">
                <span>Apertura</span>
                <strong>{moneda(resumen.monto_apertura)}</strong>
              </div>

              <div className="caja-fila">
                <span>Ventas en efectivo</span>
                <strong className="mas">+{moneda(resumen.ventas_efectivo)}</strong>
              </div>

              {Number(resumen.cobros_efectivo) > 0 && (
                <div className="caja-fila">
                  <span>Cobros de cuentas en efectivo</span>
                  <strong className="mas">+{moneda(resumen.cobros_efectivo)}</strong>
                </div>
              )}

              {Number(resumen.ingresos) > 0 && (
                <div className="caja-fila">
                  <span>Otros ingresos</span>
                  <strong className="mas">+{moneda(resumen.ingresos)}</strong>
                </div>
              )}

              {Number(resumen.egresos) > 0 && (
                <div className="caja-fila">
                  <span>Egresos</span>
                  <strong className="menos">-{moneda(resumen.egresos)}</strong>
                </div>
              )}

              <div className="caja-separador" />

              <div className="caja-fila caja-fila-total">
                <span>Debe haber</span>
                <strong>{moneda(resumen.efectivo_esperado)}</strong>
              </div>
            </div>
          )}

          <div className="caja-tiles">
            <div className="caja-tile">
              <ArrowLeftRight size={16} />
              <strong>
                {moneda(Number(resumen.ventas_transferencia) + Number(resumen.cobros_transferencia))}
              </strong>
              <span>Transferencias</span>
            </div>

            <div className="caja-tile">
              <Receipt size={16} />
              <strong>{moneda(resumen.ventas_credito)}</strong>
              <span>Por cobrar</span>
            </div>

            <div className="caja-tile">
              <ShoppingBag size={16} />
              <strong>{resumen.num_ordenes}</strong>
              <span>Pedidos</span>
            </div>
          </div>

          {/* Movimientos */}

          <div className="caja-tarjeta">
            <h2 className="caja-subtitulo">Ingresos y egresos de caja</h2>

            {!mostrarMovimiento && (
              <div className="caja-botones-fila">
                <button
                  className="caja-btn-secundario egreso"
                  onClick={() => abrirFormMovimiento("egreso")}
                >
                  <Minus size={16} />
                  Egreso
                </button>

                <button
                  className="caja-btn-secundario ingreso"
                  onClick={() => abrirFormMovimiento("ingreso")}
                >
                  <Plus size={16} />
                  Ingreso
                </button>
              </div>
            )}

            {mostrarMovimiento && (
              <div className="caja-form-movimiento">
                <div className="caja-form-movimiento-header">
                  <strong>{tipoMovimiento === "egreso" ? "Nuevo egreso" : "Nuevo ingreso"}</strong>

                  <button
                    type="button"
                    className="caja-icono-btn"
                    aria-label="Cancelar"
                    onClick={() => setMostrarMovimiento(false)}
                  >
                    <X size={16} />
                  </button>
                </div>

                <CampoMonto
                  id="caja-monto-mov"
                  label="Monto"
                  value={montoMovimiento}
                  onChange={setMontoMovimiento}
                  autoFocus
                />

                <div className="caja-campo">
                  <label htmlFor="caja-motivo-mov">Motivo</label>

                  <input
                    id="caja-motivo-mov"
                    type="text"
                    maxLength={150}
                    value={motivoMovimiento}
                    onChange={(e) => setMotivoMovimiento(e.target.value)}
                    placeholder={
                      tipoMovimiento === "egreso" ? "Ej: Compra de hielo" : "Ej: Préstamo para cambio"
                    }
                  />
                </div>

                <button
                  className="caja-btn-primario"
                  onClick={handleGuardarMovimiento}
                  disabled={enviando}
                >
                  {enviando ? "Guardando..." : "Guardar"}
                </button>
              </div>
            )}

            {movimientos.length === 0 ? (
              <p className="caja-vacio">Aún no hay movimientos en este turno</p>
            ) : (
              <div className="caja-lista-mov">
                {movimientos.map((mov) => (
                  <div key={mov.id} className="caja-mov">
                    <div className="caja-mov-info">
                      <span className="caja-mov-motivo">{mov.motivo}</span>
                      <small>{formatearHora(mov.fecha || mov.creado_en)}</small>
                    </div>

                    <span className={`caja-mov-monto ${mov.tipo}`}>
                      {mov.tipo === "egreso" ? "-" : "+"}
                      {moneda(mov.monto)}
                    </span>

                    <button
                      type="button"
                      className="caja-icono-btn"
                      aria-label={`Eliminar ${mov.motivo}`}
                      onClick={() => handleEliminarMovimiento(mov)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button className="caja-btn-cerrar" onClick={iniciarCierre}>
            Cerrar turno
          </button>
        </>
      )}

      {/* =========================
          CERRAR TURNO
          ========================= */}

      {vista === "cerrando" && turno && (
        <>
          <button className="caja-volver" onClick={() => setVista("principal")} disabled={enviando}>
            <ChevronLeft size={16} />
            Volver al turno
          </button>

          <div className="caja-tarjeta">
            <div className="caja-tarjeta-titulo">
              <Wallet size={18} />
              <h2>Cerrar turno {turno.numero_dia}</h2>
            </div>

            <p className="caja-ayuda">
              Cuenta todo el efectivo que hay en la caja, incluida la base con la que se abrió.
            </p>

            <div className="caja-segmentos" role="tablist" aria-label="Forma de contar">
              <button
                type="button"
                role="tab"
                aria-selected={modoConteo === "total"}
                className={modoConteo === "total" ? "activo" : ""}
                onClick={() => setModoConteo("total")}
              >
                Escribir el total
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={modoConteo === "billetes"}
                className={modoConteo === "billetes" ? "activo" : ""}
                onClick={() => setModoConteo("billetes")}
              >
                Contar billetes
              </button>
            </div>

            {modoConteo === "total" ? (
              <CampoMonto
                id="caja-contado"
                label="Efectivo contado"
                value={efectivoContado}
                onChange={setEfectivoContado}
                autoFocus
                grande
              />
            ) : (
              <div className="caja-conteo">
                {BILLETES.map((d) => {
                  const cantidad = Number(cantidades[d]) || 0;

                  return (
                    <div key={d} className="caja-conteo-fila">
                      <span className="caja-conteo-denominacion">{moneda(d)}</span>

                      <div className="caja-stepper">
                        <button
                          type="button"
                          aria-label={`Quitar un billete de ${moneda(d)}`}
                          disabled={cantidad === 0}
                          onClick={() => cambiarCantidad(d, -1)}
                        >
                          <Minus size={15} />
                        </button>

                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          aria-label={`Cantidad de billetes de ${moneda(d)}`}
                          value={cantidad === 0 ? "" : cantidad}
                          placeholder="0"
                          onChange={(e) => escribirCantidad(d, e.target.value)}
                          onFocus={(e) => e.target.select()}
                        />

                        <button
                          type="button"
                          aria-label={`Agregar un billete de ${moneda(d)}`}
                          onClick={() => cambiarCantidad(d, 1)}
                        >
                          <Plus size={15} />
                        </button>
                      </div>

                      <span className="caja-conteo-subtotal">{moneda(d * cantidad)}</span>
                    </div>
                  );
                })}

                <CampoMonto
                  id="caja-monedas"
                  label="Monedas (total en pesos)"
                  value={monedas}
                  onChange={setMonedas}
                />

                <div className="caja-conteo-total">
                  <span>Total contado</span>
                  <strong>{moneda(totalBilletes)}</strong>
                </div>
              </div>
            )}

            {esperadoVisible && diferenciaPrevia != null && (
              <div className={`caja-diferencia ${claseDiferencia(diferenciaPrevia)}`}>
                {textoDiferencia(diferenciaPrevia)}
                <small>Esperado: {moneda(resumen.efectivo_esperado)}</small>
              </div>
            )}

            <span className="caja-etiqueta">¿Quién cierra?</span>

            <ChipsTrabajadora valor={cierraId} onElegir={(id) => setCierraId(String(id))} etiqueta="¿Quién cierra?" />

            <div className="caja-campo">
              <label htmlFor="caja-notas">Notas (opcional)</label>

              <textarea
                id="caja-notas"
                rows={2}
                maxLength={300}
                value={notasCierre}
                onChange={(e) => setNotasCierre(e.target.value)}
                placeholder="Ej: Faltó cambio de $500"
              />
            </div>

            <button className="caja-btn-primario" onClick={handleCerrar} disabled={enviando}>
              {enviando ? "Cerrando..." : "Confirmar cierre"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}