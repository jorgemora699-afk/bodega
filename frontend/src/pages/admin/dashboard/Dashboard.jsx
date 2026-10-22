import { useEffect, useState } from "react";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Award,
  Package,
  BarChart3,
  Wallet,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { dashboardResumen, productosMasVendidos, ventasPorDia, metodosPago } from "../../../api/admin";
import { listarBajoStock } from "../../../api/inventario";
import "./Dashboard.css";
import { listarBajoStockInsumo } from "../../../api/insumos";
import { useNavigate } from "react-router-dom";
import { listarOrdenesPendientes } from "../../../api/ordenes";

const PERIODOS = [
  { valor: "dia", label: "Hoy" },
  { valor: "semana", label: "Esta semana" },
  { valor: "mes", label: "Este mes" },
  { valor: "personalizado", label: "Personalizado" },
];

const COLORES_METODO = {
  efectivo: "#f5c400",
  transferencia: "#222222",
  datafono: "#9c7a3c",
};
const COLOR_METODO_DEFAULT = "#bdbdbd";

function formatearMoneda(valor) {
  return `$${Number(valor).toLocaleString("es-CO")}`;
}

function formatearFechaCorta(isoString) {
  const [, mes, dia] = isoString.split("-");
  return `${dia}/${mes}`;
}

/* Los paquetes (fijos o mixtos) no tienen stock propio: dependen de los
   movimientos de las unidades, así que no cuentan como "por acabarse". */
function esPaquete(producto) {
  return Boolean(producto.es_paquete || producto.requiere_seleccion);
}

function Variacion({ valor }) {
  if (valor === null || valor === undefined) {
    return <span className="dash-variacion sin-datos">Sin periodo anterior</span>;
  }
  const positiva = valor >= 0;
  return (
    <span className={`dash-variacion ${positiva ? "positivo" : "negativo"}`}>
      {positiva ? "↑" : "↓"} {Math.abs(valor).toLocaleString("es-CO")}%
    </span>
  );
}

function TooltipVentas({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dash-tooltip">
      <strong>{formatearFechaCorta(label)}</strong>
      <span>{formatearMoneda(payload[0].value)}</span>
    </div>
  );
}

export default function Dashboard() {
  const [periodo, setPeriodo] = useState("dia");
  const [resumen, setResumen] = useState(null);
  const [bajoStock, setBajoStock] = useState([]);
  const [topProductos, setTopProductos] = useState([]);
  const [porDia, setPorDia] = useState([]);
  const [porMetodo, setPorMetodo] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [bajoStockInsumos, setBajoStockInsumos] = useState([]);
  const [cuentasPorCobrar, setCuentasPorCobrar] = useState([]);
  const navigate = useNavigate();
  const [verTodosProductos, setVerTodosProductos] = useState(false);
  const [verTodosInsumos, setVerTodosInsumos] = useState(false);
  const modoMesPersonalizado = periodo === "personalizado";
  const [mesElegido, setMesElegido] = useState(() => new Date().getMonth() + 1);
  const [anioElegido, setAnioElegido] = useState(() => new Date().getFullYear());

  const LIMITE_LISTA = 3;

  useEffect(() => {
    cargarDatos(periodo);
    setVerTodosProductos(false);
    setVerTodosInsumos(false);
  }, [periodo, mesElegido, anioElegido]);

  async function cargarDatos(periodoActual) {
    setCargando(true);
    setError(null);

    const paramsExtra = modoMesPersonalizado ? { anio: anioElegido, mes: mesElegido } : {};
    const periodoParaDia = modoMesPersonalizado
      ? "mes"
      : periodoActual === "dia"
      ? "semana"
      : periodoActual;

    try {
      const [resumenData, stock, stockInsumos, top, dia, metodo, pendientes] = await Promise.all([
        dashboardResumen(periodoActual, paramsExtra),
        listarBajoStock(),
        listarBajoStockInsumo(),
        productosMasVendidos(periodoActual, 3, paramsExtra),
        ventasPorDia(periodoParaDia, paramsExtra),
        metodosPago(periodoActual, paramsExtra),
        listarOrdenesPendientes(),
      ]);

      setResumen(resumenData);
      setBajoStock(stock.filter((p) => !esPaquete(p)));
      setBajoStockInsumos(stockInsumos);
      setTopProductos(top);
      setPorDia(dia);
      setPorMetodo(metodo);
      setCuentasPorCobrar(pendientes);
    } catch (err) {
      setError("No se pudieron cargar los datos del panel");
    } finally {
      setCargando(false);
    }
  }

  const balanceNegativo = (resumen?.balance_neto ?? 0) < 0;
  const NOMBRES_MES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  const periodoLabel = modoMesPersonalizado
    ? `${NOMBRES_MES[mesElegido - 1]} ${anioElegido}`
    : PERIODOS.find((p) => p.valor === periodo)?.label ?? "Hoy";

  const maxVentasProducto =
    topProductos.length > 0
      ? Math.max(...topProductos.map((p) => Number(p.cantidad_vendida) || 0))
      : 1;

  const totalPorCobrar = cuentasPorCobrar.reduce((sum, o) => sum + Number(o.total), 0);

  return (
    <div className="dash-container">
      <header className="dash-header">
        <div>
          <span className="dash-eyebrow">Resumen general</span>
          <h1>Panel del negocio</h1>
          <p>Consulta el estado de tus ventas, balance e inventario.</p>
        </div>

        <div className="dash-periodo">
          <span>Periodo</span>

          <select
            className="dash-periodo-select"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
          >
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.label}
              </option>
            ))}
          </select>

          {modoMesPersonalizado && (
            <div className="dash-mes-selector">
              <select value={mesElegido} onChange={(e) => setMesElegido(Number(e.target.value))}>
                {NOMBRES_MES.map((nombre, i) => (
                  <option key={i + 1} value={i + 1}>
                    {nombre}
                  </option>
                ))}
              </select>

              <select value={anioElegido} onChange={(e) => setAnioElegido(Number(e.target.value))}>
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      {error && (
        <div className="dash-mensaje-error">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {cargando ? (
        <div className="dash-cargando">
          <div className="dash-spinner" />
          <span>Cargando información...</span>
        </div>
      ) : (
        <>
          {/* ==================== KPIs ==================== */}

          <section className="dash-tarjetas">
            <div className="dash-tarjeta dash-tarjeta-clicable" onClick={() => navigate("/admin/ventas")}>
              <div className="dash-tarjeta-top">
                <div className="dash-tarjeta-icono verde">
                  <DollarSign size={18} />
                </div>
                <span className="dash-tarjeta-contexto">{periodoLabel}</span>
              </div>
              <span className="dash-tarjeta-label">Ventas</span>
              <span className="dash-tarjeta-valor">{formatearMoneda(resumen?.ventas_total ?? 0)}</span>
              <span className="dash-tarjeta-sub">
                <Variacion valor={resumen?.ventas_variacion_pct} />
              </span>
            </div>

            <div className="dash-tarjeta dash-tarjeta-clicable" onClick={() => navigate("/admin/ventas")}>
              <div className="dash-tarjeta-top">
                <div className="dash-tarjeta-icono azul">
                  <ShoppingCart size={18} />
                </div>
                <span className="dash-tarjeta-contexto">{periodoLabel}</span>
              </div>
              <span className="dash-tarjeta-label">Pedidos</span>
              <span className="dash-tarjeta-valor">{resumen?.pedidos_total ?? 0}</span>
              <span className="dash-tarjeta-sub">
                <Variacion valor={resumen?.pedidos_variacion_pct} />
              </span>
            </div>

            <div className="dash-tarjeta">
              <div className="dash-tarjeta-top">
                <div className={`dash-tarjeta-icono ${balanceNegativo ? "rojo" : "ambar"}`}>
                  <TrendingUp size={18} />
                </div>
                <span className="dash-tarjeta-contexto">{periodoLabel}</span>
              </div>
              <span className="dash-tarjeta-label">Balance</span>
              <span className={`dash-tarjeta-valor ${balanceNegativo ? "negativo" : "positivo"}`}>
                {formatearMoneda(resumen?.balance_neto ?? 0)}
              </span>
              <span className="dash-tarjeta-sub">
                Egresos {formatearMoneda(resumen?.total_egresos ?? 0)}
              </span>
            </div>

            <div className="dash-tarjeta dash-tarjeta-clicable" onClick={() => navigate("/admin/inventario")}>
              <div className="dash-tarjeta-top">
                <div className={`dash-tarjeta-icono ${bajoStock.length > 0 ? "rojo" : "verde"}`}>
                  <Package size={18} />
                </div>
                <span className="dash-tarjeta-contexto">Inventario</span>
              </div>
              <span className="dash-tarjeta-label">Stock</span>
              <span className="dash-tarjeta-valor">{bajoStock.length}</span>
              <span className={`dash-tarjeta-sub ${bajoStock.length > 0 ? "dash-sub-alerta" : "dash-sub-ok"}`}>
                {bajoStock.length > 0 ? "Productos por acabarse" : "Todo está en buen nivel"}
              </span>
            </div>

            <div
              className="dash-tarjeta dash-tarjeta-clicable"
              onClick={() => navigate("/admin/cuentas-cobrar")}
            >
              <div className="dash-tarjeta-top">
                <div className={`dash-tarjeta-icono ${cuentasPorCobrar.length > 0 ? "rojo" : "verde"}`}>
                  <Wallet size={18} />
                </div>
                <span className="dash-tarjeta-contexto">Créditos</span>
              </div>
              <span className="dash-tarjeta-label">Por cobrar</span>
              <span className="dash-tarjeta-valor">{formatearMoneda(totalPorCobrar)}</span>
              <span className={`dash-tarjeta-sub ${cuentasPorCobrar.length > 0 ? "dash-sub-alerta" : "dash-sub-ok"}`}>
                {cuentasPorCobrar.length > 0
                  ? `${cuentasPorCobrar.length} pendiente${cuentasPorCobrar.length !== 1 ? "s" : ""}`
                  : "Sin cuentas pendientes"}
              </span>
            </div>
          </section>

          {/* ==================== GRÁFICAS ==================== */}

          <div className="dash-columnas dash-columnas-graficas">
            <section className="dash-seccion">
              <div className="dash-seccion-header">
                <div>
                  <h2>
                    <BarChart3 size={16} />
                    Ventas por día
                  </h2>
                  <p>
                    {periodo === "dia" ? "Esta semana" : periodoLabel}
                  </p>
                </div>
              </div>

              {porDia.length === 0 ? (
                <div className="dash-sin-datos">
                  <BarChart3 size={18} />
                  <span>No hay ventas registradas en este rango</span>
                </div>
              ) : (
                <div className="dash-grafica-contenedor">
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={porDia} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="ventasGradiente" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f5c400" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#f5c400" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                      <XAxis
                        dataKey="fecha"
                        tickFormatter={formatearFechaCorta}
                        tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <Tooltip content={<TooltipVentas />} />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#dcae00"
                        strokeWidth={2}
                        fill="url(#ventasGradiente)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="dash-seccion">
              <div className="dash-seccion-header">
                <div>
                  <h2>
                    <Wallet size={16} />
                    Métodos de pago
                  </h2>
                  <p>{periodoLabel}</p>
                </div>
              </div>

              {porMetodo.length === 0 ? (
                <div className="dash-sin-datos">
                  <Wallet size={18} />
                  <span>No hay ventas en este periodo</span>
                </div>
              ) : (
                <div className="dash-donut-layout">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie
                        data={porMetodo}
                        dataKey="total"
                        nameKey="metodo_pago"
                        innerRadius={42}
                        outerRadius={62}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {porMetodo.map((entrada, index) => (
                          <Cell
                            key={entrada.metodo_pago}
                            fill={COLORES_METODO[entrada.metodo_pago] || COLOR_METODO_DEFAULT}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatearMoneda(value)} />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="dash-donut-leyenda">
                    {porMetodo.map((m) => (
                      <div key={m.metodo_pago} className="dash-donut-leyenda-item">
                        <span
                          className="dash-donut-punto"
                          style={{ background: COLORES_METODO[m.metodo_pago] || COLOR_METODO_DEFAULT }}
                        />
                        <span className="dash-donut-leyenda-nombre">{m.metodo_pago}</span>
                        <span className="dash-donut-leyenda-pct">{m.porcentaje}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* ==================== CONTENIDO ==================== */}

          <div className="dash-columnas">
            <section className="dash-seccion">
              <div className="dash-seccion-header">
                <div>
                  <h2>
                    <AlertTriangle size={16} />
                    Productos por acabarse
                  </h2>
                  <p>Productos que requieren atención</p>
                </div>
                {bajoStock.length > 0 && <span className="dash-contador-alerta">{bajoStock.length}</span>}
              </div>

              {bajoStock.length === 0 ? (
                <div className="dash-sin-alertas">
                  <div className="dash-sin-alertas-icono">
                    <CheckCircle2 size={17} />
                  </div>
                  <div>
                    <strong>Todo está en orden</strong>
                    <span>No hay productos con stock bajo.</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="dash-lista-stock">
                    {(verTodosProductos ? bajoStock : bajoStock.slice(0, LIMITE_LISTA)).map((p) => {
                      const stock = Number(p.stock_actual) || 0;
                      const nivel = stock <= 2 ? "critico" : "bajo";
                      return (
                        <div key={p.id} className="dash-stock-fila">
                          <div className="dash-stock-info">
                            <span className="dash-stock-nombre">{p.nombre}</span>
                            <div className="dash-stock-barra">
                              <span
                                className={`dash-stock-progreso ${nivel}`}
                                style={{ width: `${Math.min(Math.max(stock * 10, 8), 100)}%` }}
                              />
                            </div>
                          </div>
                          <span className={`dash-badge-bajo ${nivel}`}>
                            {stock === 1 ? "1 unidad" : `${stock} unidades`}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {bajoStock.length > LIMITE_LISTA && (
                    <button
                      type="button"
                      className="dash-btn-ampliar"
                      onClick={() => setVerTodosProductos((v) => !v)}
                    >
                      {verTodosProductos ? "Ver menos" : `Ver todos (${bajoStock.length})`}
                    </button>
                  )}
                </>
              )}
            </section>

            <section className="dash-seccion">
              <div className="dash-seccion-header">
                <div>
                  <h2>
                    <Award size={16} />
                    Más vendidos
                  </h2>
                  <p>Productos destacados del periodo</p>
                </div>
                <span className="dash-periodo-mini">{periodoLabel}</span>
              </div>

              {topProductos.length === 0 ? (
                <div className="dash-sin-datos">
                  <Award size={18} />
                  <span>No hay ventas en este periodo todavía</span>
                </div>
              ) : (
                <div className="dash-lista-top">
                  {topProductos.map((p, index) => {
                    const cantidad = Number(p.cantidad_vendida) || 0;
                    const porcentaje = (cantidad / maxVentasProducto) * 100;
                    return (
                      <div key={p.producto_id} className="dash-top-fila">
                        <span className="dash-top-puesto">{String(index + 1).padStart(2, "0")}</span>
                        <div className="dash-top-contenido">
                          <div className="dash-top-detalle">
                            <span className="dash-top-nombre">{p.producto_nombre}</span>
                            <span className="dash-top-cantidad">{cantidad} un.</span>
                          </div>
                          <div className="dash-top-barra">
                            <span style={{ width: `${porcentaje}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
          {/* ==================== INSUMOS POR ACABARSE ==================== */}

          <div className="dash-columnas dash-fila-ancha">
            <section className="dash-seccion dash-seccion-ancha">
              <div className="dash-seccion-header">
                <div>
                  <h2>
                    <AlertTriangle size={16} />
                    Insumos por acabarse
                  </h2>
                  <p>Materia prima que requiere atención</p>
                </div>
                {bajoStockInsumos.length > 0 && (
                  <span className="dash-contador-alerta">{bajoStockInsumos.length}</span>
                )}
              </div>

              {bajoStockInsumos.length === 0 ? (
                <div className="dash-sin-alertas">
                  <div className="dash-sin-alertas-icono">
                    <CheckCircle2 size={17} />
                  </div>
                  <div>
                    <strong>Todo está en orden</strong>
                    <span>No hay insumos con stock bajo.</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="dash-lista-stock">
                    {(verTodosInsumos ? bajoStockInsumos : bajoStockInsumos.slice(0, LIMITE_LISTA)).map((i) => {
                      const stock = Number(i.stock_actual) || 0;
                      const minimo = Number(i.stock_minimo) || 1;
                      const nivel = stock <= minimo / 2 ? "critico" : "bajo";
                      const porcentaje = Math.min(Math.max((stock / minimo) * 100, 8), 100);

                      return (
                        <div key={i.id} className="dash-stock-fila">
                          <div className="dash-stock-info">
                            <span className="dash-stock-nombre">{i.nombre}</span>
                            <div className="dash-stock-barra">
                              <span
                                className={`dash-stock-progreso ${nivel}`}
                                style={{ width: `${porcentaje}%` }}
                              />
                            </div>
                          </div>
                          <span className={`dash-badge-bajo ${nivel}`}>
                            {stock} {i.unidad_medida}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {bajoStockInsumos.length > LIMITE_LISTA && (
                    <button
                      type="button"
                      className="dash-btn-ampliar"
                      onClick={() => setVerTodosInsumos((v) => !v)}
                    >
                      {verTodosInsumos ? "Ver menos" : `Ver todos (${bajoStockInsumos.length})`}
                    </button>
                  )}
                </>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}