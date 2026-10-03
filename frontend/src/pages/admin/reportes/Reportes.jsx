import { useEffect, useState } from "react";
import {
  TrendingUp,
  Users,
  Receipt,
  Award,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  PieChart,
  Pie,
} from "recharts";
import {
  resumenVentas,
  productosMasVendidos,
  ventasPorTrabajadora,
  ventasPorDia,
  tendenciaMensual,
} from "../../../api/admin";
import "./Reportes.css";
import { Calendar } from "lucide-react";
import { listarTrabajadoras } from "../../../api/trabajadoras";
import { metodosPago } from "../../../api/admin";
import { Wallet, TrendingDown } from "lucide-react";

const PERIODOS = [
  { valor: "dia", label: "Hoy" },
  { valor: "semana", label: "Esta semana" },
  { valor: "mes", label: "Este mes" },
];

const PALETA = [
  "var(--color-primary)",
  "var(--color-brand)",
  "#5b8def",
  "#3fae7a",
  "#c86dd7",
  "#e5734f",
  "#8a8f98",
];

const EJE_TICK = { fontSize: 11, fill: "var(--color-text-secondary)" };
const RANKING_INICIAL = 5;

/* =========================
   HELPERS
   ========================= */

function formatearMoneda(valor) {
  return `$${Number(valor).toLocaleString("es-CO")}`;
}

function formatearCompacto(valor) {
  const n = Number(valor) || 0;

  if (n >= 1000000) {
    const m = n / 1000000;
    return `$${m.toFixed(m >= 10 ? 0 : 1).replace(".", ",")}M`;
  }

  if (n >= 1000) {
    return `$${Math.round(n / 1000)}K`;
  }

  return `$${Math.round(n)}`;
}

function formatearFechaCorta(isoString) {
  const [, mes, dia] = isoString.split("-");
  return `${dia}/${mes}`;
}

function formatearDiaLargo(isoString) {
  const [anio, mes, dia] = isoString.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia);

  const diaSemana = fecha
    .toLocaleDateString("es-CO", { weekday: "short" })
    .replace(".", "");

  return `${diaSemana.charAt(0).toUpperCase()}${diaSemana.slice(1)} ${formatearFechaCorta(isoString)}`;
}

/* =========================
   COMPONENTES PEQUEÑOS
   ========================= */

function Skeleton({ style, className = "" }) {
  return <div className={`rep-skeleton ${className}`} style={style} />;
}

function SeccionSkeleton({ alto = 200 }) {
  return (
    <section className="rep-seccion">
      <Skeleton className="rep-sk-titulo" />
      <Skeleton style={{ height: alto }} />
    </section>
  );
}

function TooltipGrafica({ active, payload, label, titulo }) {
  if (!active || !payload?.length) return null;

  const item = payload[0];
  const datos = item.payload || {};
  const encabezado = titulo ? titulo(label) : item.name;

  return (
    <div className="rep-tooltip">
      <span className="rep-tooltip-titulo">{encabezado}</span>
      <strong>{formatearMoneda(item.value)}</strong>
      {datos.cantidad_pedidos != null && (
        <span className="rep-tooltip-sub">
          {datos.cantidad_pedidos} pedido(s)
        </span>
      )}
    </div>
  );
}

function Sparkline({ datos, color, id }) {
  if (!datos || datos.length < 2) return null;

  return (
    <div className="rep-spark">
      <ResponsiveContainer width="100%" height={36}>
        <AreaChart
          data={datos}
          margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${id})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Metrica({ label, valor, serie, id, color, variacion }) {
  return (
    <div className="rep-metrica">
      <span className="rep-metrica-label">{label}</span>
      <span className="rep-metrica-valor">{valor}</span>
      {variacion !== undefined && <Variacion valor={variacion} />}
      <Sparkline datos={serie} color={color} id={id} />
    </div>
  );
}

function Variacion({ valor }) {
  if (valor === null || valor === undefined) return null;
  const positiva = valor >= 0;
  return (
    <span className={`rep-variacion ${positiva ? "sube" : "baja"}`}>
      {positiva ? "↑" : "↓"} {Math.abs(valor).toFixed(1)}% vs. anterior
    </span>
  );
}

/* =========================
   PANTALLA
   ========================= */

export default function Reportes() {
  const [periodo, setPeriodo] = useState("semana");
  const [intento, setIntento] = useState(0);

  const [resumen, setResumen] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [porTrabajadora, setPorTrabajadora] = useState([]);
  const [porDia, setPorDia] = useState([]);

  const [tendencia, setTendencia] = useState([]);
  const [cargandoTendencia, setCargandoTendencia] = useState(true);
  const [errorTendencia, setErrorTendencia] = useState(false);
  const [intentoTendencia, setIntentoTendencia] = useState(0);
  const [trabajadoras, setTrabajadoras] = useState([]);
  const [trabajadoraFiltro, setTrabajadoraFiltro] = useState("");
  const [porMetodo, setPorMetodo] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [modoMesPersonalizado, setModoMesPersonalizado] = useState(false);
  const [mesElegido, setMesElegido] = useState(() => new Date().getMonth() + 1);
  const [anioElegido, setAnioElegido] = useState(() => new Date().getFullYear());

  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [verTodos, setVerTodos] = useState(false);

  useEffect(() => {
    listarTrabajadoras().then(setTrabajadoras).catch(() => setTrabajadoras([]));
  }, []);

  /* Datos principales (con protección contra respuestas viejas) */
  useEffect(() => {
    let activo = true;

    async function cargar() {
      setCargando(true);
      setError(null);

      const paramsExtra = {
        ...(modoMesPersonalizado ? { anio: anioElegido, mes: mesElegido } : {}),
        ...(trabajadoraFiltro ? { trabajadora_id: Number(trabajadoraFiltro) } : {}),
      };

      try {
        const [resumenData, rankingData, trabajadoraData, diaData, metodoData] =
          await Promise.all([
            resumenVentas(periodo, paramsExtra),
            productosMasVendidos(periodo, 20, paramsExtra),
            ventasPorTrabajadora(periodo, modoMesPersonalizado ? { anio: anioElegido, mes: mesElegido } : {}),
            ventasPorDia(periodo, paramsExtra),
            metodosPago(periodo, paramsExtra),
          ]);

        if (!activo) return;

        setResumen(resumenData);
        setRanking(rankingData);
        setPorTrabajadora(trabajadoraData);
        setPorDia(diaData);
        setPorMetodo(metodoData);
      } catch (err) {
        if (activo) setError("No se pudieron cargar los reportes");
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargar();

    return () => {
      activo = false;
    };
  }, [periodo, intento, modoMesPersonalizado, mesElegido, anioElegido, trabajadoraFiltro]);

  /* Tendencia mensual (carga y error propios) */
  useEffect(() => {
    let activo = true;

    setCargandoTendencia(true);
    setErrorTendencia(false);

    tendenciaMensual(6)
      .then((data) => {
        if (activo) setTendencia(data);
      })
      .catch(() => {
        if (activo) setErrorTendencia(true);
      })
      .finally(() => {
        if (activo) setCargandoTendencia(false);
      });

    return () => {
      activo = false;
    };
  }, [intentoTendencia]);

  function cambiarPeriodo(valor) {
    if (valor === periodo) return;
    setDiaSeleccionado(null);
    setPeriodo(valor);
  }

  function alClickDia(state) {
    let fecha =
      state?.activePayload?.[0]?.payload?.fecha ?? state?.activeLabel;

    if (!porDia.some((d) => d.fecha === fecha)) {
      fecha = porDia[Number(state?.activeIndex)]?.fecha;
    }

    if (!fecha) return;

    setDiaSeleccionado((actual) => (actual === fecha ? null : fecha));
  }

  /* =========================
     DERIVADOS
     ========================= */

  const primeraCarga = cargando && !resumen;
  const sinDatosPorError = Boolean(error) && !resumen;

  const ticketPromedio =
    resumen && resumen.cantidad_pedidos > 0
      ? resumen.total_ventas / resumen.cantidad_pedidos
      : 0;

  /* Sparklines (solo si hay al menos 2 días) */
  const serieTotal = porDia.map((d) => ({ v: Number(d.total) }));

  const hayConteo =
    porDia.length > 0 && porDia.every((d) => d.cantidad_ventas != null);

  const serieVentas = hayConteo
    ? porDia.map((d) => ({ v: Number(d.cantidad_ventas) }))
    : [];

  const serieTicket = hayConteo
    ? porDia.map((d) => ({
        v: d.cantidad_ventas > 0 ? d.total / d.cantidad_ventas : 0,
      }))
    : [];

  /* Detalle del día seleccionado */
  const totalPeriodo = porDia.reduce((sum, d) => sum + Number(d.total), 0);
  const promedioDiario = porDia.length > 0 ? totalPeriodo / porDia.length : 0;
  const diaDetalle = porDia.find((d) => d.fecha === diaSeleccionado);

  const pctDelPeriodo =
    diaDetalle && totalPeriodo > 0
      ? (Number(diaDetalle.total) / totalPeriodo) * 100
      : 0;

  const difPromedio =
    diaDetalle && promedioDiario > 0
      ? (Number(diaDetalle.total) / promedioDiario - 1) * 100
      : 0;

  /* Ranking */
  const maxRanking =
    ranking.length > 0
      ? Math.max(...ranking.map((p) => p.cantidad_vendida))
      : 0;

  const rankingVisible = verTodos
    ? ranking
    : ranking.slice(0, RANKING_INICIAL);

  /* Dona por trabajadora */
  const totalTrabajadoras = porTrabajadora.reduce(
    (sum, t) => sum + Number(t.total_vendido),
    0
  );

  const datosDona = porTrabajadora.map((t) => ({
    id: t.trabajadora_id,
    name: t.trabajadora_nombre,
    value: Number(t.total_vendido),
    cantidad_pedidos: t.cantidad_pedidos,
  }));

  return (
    <div className="rep-container">
      <header className="rep-header">
        <h1>Reportes</h1>
        <p>Análisis detallado de ventas</p>
      </header>

      <div className="rep-periodos">
        {PERIODOS.map((p) => (
          <button
            key={p.valor}
            className={`rep-periodo-btn ${
              !modoMesPersonalizado && periodo === p.valor ? "activo" : ""
            }`}
            onClick={() => {
              setModoMesPersonalizado(false);
              cambiarPeriodo(p.valor);
            }}
          >
            {p.label}
          </button>
        ))}

        <button
          type="button"
          className={`rep-periodo-btn ${modoMesPersonalizado ? "activo" : ""}`}
          onClick={() => {
            setModoMesPersonalizado(true);
            setDiaSeleccionado(null);
          }}
        >
          <Calendar size={13} />
          Elegir mes
        </button>
      </div>

      <div className="rep-filtro-trabajadora">
        <label>Trabajadora</label>
        <select
          value={trabajadoraFiltro}
          onChange={(e) => setTrabajadoraFiltro(e.target.value)}
        >
          <option value="">Todas</option>
          {trabajadoras.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
      </div>

      {modoMesPersonalizado && (
        <div className="rep-mes-selector">
          <select
            value={mesElegido}
            onChange={(e) => setMesElegido(Number(e.target.value))}
          >
            {[
              "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
              "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
            ].map((nombre, i) => (
              <option key={i + 1} value={i + 1}>
                {nombre}
              </option>
            ))}
          </select>

          <select
            value={anioElegido}
            onChange={(e) => setAnioElegido(Number(e.target.value))}
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="rep-mensaje-error">
          <span>{error}</span>

          <button
            type="button"
            className="rep-reintentar"
            onClick={() => setIntento((n) => n + 1)}
          >
            <RefreshCw size={13} />
            Reintentar
          </button>
        </div>
      )}

      {/* =========================
          PRIMERA CARGA (SKELETONS)
          ========================= */}

      {primeraCarga && (
        <>
          <section className="rep-metricas">
            <Skeleton className="rep-sk-metrica" />
            <Skeleton className="rep-sk-metrica" />
            <Skeleton className="rep-sk-metrica" />
          </section>

          <SeccionSkeleton alto={220} />
          <SeccionSkeleton alto={180} />
          <SeccionSkeleton alto={180} />
        </>
      )}

      {/* =========================
          CONTENIDO
          ========================= */}

      {!primeraCarga && !sinDatosPorError && (
        <div className={`rep-contenido ${cargando ? "recargando" : ""}`}>

          {/* MÉTRICAS */}

          {resumen && (
            <section className="rep-metricas">
              <Metrica
                label="Total vendido"
                valor={formatearMoneda(resumen.total_ventas)}
                serie={serieTotal}
                id="spark-total"
                color="var(--color-brand)"
                variacion={resumen.total_ventas_variacion_pct}
              />

              <Metrica
                label="Pedidos"
                valor={resumen.cantidad_pedidos}
                serie={serieVentas}
                id="spark-ventas"
                color="var(--color-primary)"
                variacion={resumen.cantidad_pedidos_variacion_pct}
              />

              <Metrica
                label="Ticket promedio"
                valor={formatearMoneda(ticketPromedio)}
                serie={serieTicket}
                id="spark-ticket"
                color="#3fae7a"
              />
            </section>
          )}

          {/* VENTAS POR DÍA */}

          <section className="rep-seccion">
            <h2>
              <TrendingUp size={15} />
              Ventas por día
            </h2>

            {porDia.length === 0 && (
              <p className="rep-sin-datos">No hay ventas en este período</p>
            )}

            {porDia.length > 0 && (
              <>
                <div className="rep-grafica rep-grafica-click">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={porDia}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      onClick={alClickDia}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="var(--color-border)"
                      />

                      <XAxis
                        dataKey="fecha"
                        tickFormatter={formatearFechaCorta}
                        tick={EJE_TICK}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                        minTickGap={14}
                      />

                      <YAxis
                        tickFormatter={formatearCompacto}
                        tick={EJE_TICK}
                        axisLine={false}
                        tickLine={false}
                        width={46}
                      />

                      <Tooltip
                        cursor={{ fill: "rgba(0, 0, 0, 0.04)" }}
                        content={<TooltipGrafica titulo={formatearDiaLargo} />}
                      />

                      <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={40}>
                        {porDia.map((d) => (
                          <Cell
                            key={d.fecha}
                            fill={
                              d.fecha === diaSeleccionado
                                ? "var(--color-primary)"
                                : "var(--color-brand)"
                            }
                            fillOpacity={
                              diaSeleccionado && d.fecha !== diaSeleccionado
                                ? 0.35
                                : 1
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {!diaDetalle && porDia.length > 1 && (
                  <p className="rep-hint">
                    Toca una barra para ver el detalle de ese día
                  </p>
                )}

                {diaDetalle && (
                  <div className="rep-dia-detalle">
                    <div className="rep-dia-detalle-info">
                      <strong>{formatearDiaLargo(diaDetalle.fecha)}</strong>

                      <span>
                        {formatearMoneda(diaDetalle.total)} ·{" "}
                        {pctDelPeriodo.toFixed(0)}% del período
                      </span>

                      {porDia.length > 1 && (
                        <span
                          className={`rep-dia-comparacion ${
                            difPromedio >= 0 ? "sube" : "baja"
                          }`}
                        >
                          {difPromedio >= 0 ? "▲" : "▼"}{" "}
                          {Math.abs(difPromedio).toFixed(0)}%{" "}
                          {difPromedio >= 0 ? "sobre" : "bajo"} el promedio
                          diario
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      className="rep-dia-cerrar"
                      aria-label="Quitar selección de día"
                      onClick={() => setDiaSeleccionado(null)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          {/* RANKING DE PRODUCTOS */}

          <section className="rep-seccion">
            <h2>
              <Award size={15} />
              Ranking de productos
            </h2>

            {ranking.length === 0 && (
              <p className="rep-sin-datos">No hay ventas en este período</p>
            )}

            <div className="rep-lista-productos">
              {rankingVisible.map((p, index) => (
                <div key={p.producto_id} className="rep-producto-fila">
                  <div className="rep-producto-info">
                    <span
                      className={`rep-producto-puesto ${
                        index < 3 ? "top" : ""
                      }`}
                    >
                      #{index + 1}
                    </span>

                    <span className="rep-producto-nombre">
                      {p.producto_nombre}
                    </span>
                  </div>

                  <div className="rep-barra-fondo">
                    <div
                      className="rep-barra-relleno"
                      style={{
                        width:
                          maxRanking > 0
                            ? `${(p.cantidad_vendida / maxRanking) * 100}%`
                            : "0%",
                      }}
                    />
                  </div>

                  <div className="rep-producto-cifras">
                    <span>{p.cantidad_vendida} unidades</span>

                    <span className="rep-producto-total">
                      {formatearMoneda(p.total_generado)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {ranking.length > RANKING_INICIAL && (
              <button
                type="button"
                className="rep-ver-mas"
                onClick={() => setVerTodos((v) => !v)}
              >
                {verTodos ? (
                  <>
                    Ver menos
                    <ChevronUp size={15} />
                  </>
                ) : (
                  <>
                    Ver todos ({ranking.length})
                    <ChevronDown size={15} />
                  </>
                )}
              </button>
            )}
          </section>

          {/* VENTAS POR TRABAJADORA */}
         {!trabajadoraFiltro && (
          <section className="rep-seccion">
            <h2>
              <Users size={15} />
              Ventas por trabajadora
            </h2>

            {porTrabajadora.length === 0 && (
              <p className="rep-sin-datos">No hay ventas en este período</p>
            )}

            {porTrabajadora.length > 0 && (
              <div className="rep-dona-layout">
                <div className="rep-dona">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={datosDona}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={56}
                        outerRadius={82}
                        paddingAngle={datosDona.length > 1 ? 2 : 0}
                        stroke="none"
                      >
                        {datosDona.map((d, i) => (
                          <Cell
                            key={d.id}
                            fill={PALETA[i % PALETA.length]}
                          />
                        ))}
                      </Pie>

                      <Tooltip content={<TooltipGrafica />} />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="rep-dona-centro">
                    <span>Total</span>
                    <strong>{formatearCompacto(totalTrabajadoras)}</strong>
                  </div>
                </div>

                <ul className="rep-leyenda">
                  {datosDona.map((d, i) => (
                    <li key={d.id} className="rep-leyenda-item">
                      <span
                        className="rep-leyenda-punto"
                        style={{ background: PALETA[i % PALETA.length] }}
                      />

                      <span className="rep-leyenda-nombre">
                        {d.name}
                        <small>{d.cantidad_pedidos} pedido(s)</small>
                      </span>

                      <span className="rep-leyenda-cifras">
                        <strong>{formatearMoneda(d.value)}</strong>
                        <small>
                          {totalTrabajadoras > 0
                            ? ((d.value / totalTrabajadoras) * 100).toFixed(0)
                            : 0}
                          %
                        </small>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
         )}
         <section className="rep-seccion">
          <h2>
            <Wallet size={15} />
            Métodos de pago
          </h2>

          {porMetodo.length === 0 ? (
            <p className="rep-sin-datos">No hay ventas en este período</p>
          ) : (
            <>
              {(() => {
                const principal = [...porMetodo].sort((a, b) => b.total - a.total)[0];
                return (
                  <p className="rep-metodo-destacado">
                    Método principal: <strong>{principal.metodo_pago}</strong> ({principal.porcentaje}%)
                  </p>
                );
              })()}

              <div className="rep-dona-layout">
                <div className="rep-dona">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={porMetodo}
                        dataKey="total"
                        nameKey="metodo_pago"
                        innerRadius={56}
                        outerRadius={82}
                        paddingAngle={porMetodo.length > 1 ? 2 : 0}
                        stroke="none"
                      >
                        {porMetodo.map((m, i) => (
                          <Cell key={m.metodo_pago} fill={PALETA[i % PALETA.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name, props) => [formatearMoneda(value), props.payload.metodo_pago]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <ul className="rep-leyenda">
                  {porMetodo.map((m, i) => (
                    <li key={m.metodo_pago} className="rep-leyenda-item">
                      <span className="rep-leyenda-punto" style={{ background: PALETA[i % PALETA.length] }} />
                      <span className="rep-leyenda-nombre">
                        {m.metodo_pago}
                        <small>{m.cantidad_pedidos} pedido(s) · ticket prom. {formatearMoneda(m.ticket_promedio)}</small>
                      </span>
                      <span className="rep-leyenda-cifras">
                        <strong>{formatearMoneda(m.total)}</strong>
                        <small>{m.porcentaje}%</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
         </section>
        </div>
      )}


      {/* =========================
          TENDENCIA MENSUAL
          ========================= */}

      {!primeraCarga && !sinDatosPorError && (
        <section className="rep-seccion">
          <h2>
            <Receipt size={15} />
            Tendencia — últimos 6 meses
          </h2>

          {cargandoTendencia && <Skeleton style={{ height: 200 }} />}

          {!cargandoTendencia && errorTendencia && (
            <div className="rep-mensaje-error rep-mensaje-inline">
              <span>No se pudo cargar la tendencia</span>

              <button
                type="button"
                className="rep-reintentar"
                onClick={() => setIntentoTendencia((n) => n + 1)}
              >
                <RefreshCw size={13} />
                Reintentar
              </button>
            </div>
          )}

          {!cargandoTendencia && !errorTendencia && tendencia.length === 0 && (
            <p className="rep-sin-datos">Aún no hay datos para mostrar</p>
          )}

          {!cargandoTendencia && !errorTendencia && tendencia.length > 0 && (
            <div className="rep-grafica">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart
                  data={tendencia}
                  margin={{ top: 10, right: 14, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="grad-tendencia"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="var(--color-sidebar-bg)"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--color-sidebar-bg)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--color-border)"
                  />

                  <XAxis
                    dataKey="etiqueta"
                    tick={EJE_TICK}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    tickFormatter={formatearCompacto}
                    tick={EJE_TICK}
                    axisLine={false}
                    tickLine={false}
                    width={46}
                  />

                  <Tooltip
                    content={<TooltipGrafica titulo={(l) => l} />}
                  />

                  <Area
                    type="monotone"
                    dataKey="total_ventas"
                    stroke="var(--color-sidebar-bg)"
                    strokeWidth={2.5}
                    fill="url(#grad-tendencia)"
                    activeDot={{ r: 6 }}
                    dot={({ cx, cy, index }) => {
                      if (cx == null || cy == null) return null;

                      const ultimo = index === tendencia.length - 1;

                      return (
                        <circle
                          key={`punto-${index}`}
                          cx={cx}
                          cy={cy}
                          r={ultimo ? 5.5 : 3.5}
                          fill={
                            ultimo
                              ? "var(--color-brand)"
                              : "var(--color-sidebar-bg)"
                          }
                          stroke="white"
                          strokeWidth={2}
                        />
                      );
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      )}
    </div>
  );
}