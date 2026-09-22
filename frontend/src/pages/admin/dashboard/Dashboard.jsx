import { useEffect, useState } from "react";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Award,
  Package,
} from "lucide-react";
import { dashboardResumen, productosMasVendidos } from "../../../api/admin";
import { listarBajoStock } from "../../../api/inventario";
import "./Dashboard.css";

const PERIODOS = [
  { valor: "dia", label: "Hoy" },
  { valor: "semana", label: "Esta semana" },
  { valor: "mes", label: "Este mes" },
];

function formatearMoneda(valor) {
  return `$${Number(valor).toLocaleString("es-CO")}`;
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

export default function Dashboard() {
  const [periodo, setPeriodo] = useState("dia");
  const [resumen, setResumen] = useState(null);
  const [bajoStock, setBajoStock] = useState([]);
  const [topProductos, setTopProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarDatos(periodo);
  }, [periodo]);

  async function cargarDatos(periodoActual) {
    setCargando(true);
    setError(null);

    try {
      const [resumenData, stock, top] = await Promise.all([
        dashboardResumen(periodoActual),
        listarBajoStock(),
        productosMasVendidos(periodoActual, 3),
      ]);

      setResumen(resumenData);
      setBajoStock(stock);
      setTopProductos(top);
    } catch (err) {
      setError("No se pudieron cargar los datos del panel");
    } finally {
      setCargando(false);
    }
  }

  const balanceNegativo = (resumen?.balance_neto ?? 0) < 0;
  const periodoLabel = PERIODOS.find((p) => p.valor === periodo)?.label ?? "Hoy";

  const maxVentasProducto =
    topProductos.length > 0
      ? Math.max(...topProductos.map((p) => Number(p.cantidad_vendida) || 0))
      : 1;

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
            <div className="dash-tarjeta">
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

            <div className="dash-tarjeta">
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

            <div className="dash-tarjeta">
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
          </section>

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
                <div className="dash-lista-stock">
                  {bajoStock.map((p) => {
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
        </>
      )}
    </div>
  );
}