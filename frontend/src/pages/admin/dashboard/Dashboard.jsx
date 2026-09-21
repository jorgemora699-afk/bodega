import { useEffect, useState } from "react";
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Award,
  Package,
  ShoppingCart,
} from "lucide-react";
import {
  resumenVentas,
  obtenerBalance,
  productosMasVendidos,
} from "../../../api/admin";
import { listarBajoStock } from "../../../api/inventario";
import "./Dashboard.css";

function formatearMoneda(valor) {
  return `$${Number(valor).toLocaleString("es-CO")}`;
}

export default function Dashboard() {
  const [ventasHoy, setVentasHoy] = useState(null);
  const [balanceMes, setBalanceMes] = useState(null);
  const [bajoStock, setBajoStock] = useState([]);
  const [topProductos, setTopProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargando(true);
    setError(null);

    try {
      const [ventas, balance, stock, top] = await Promise.all([
        resumenVentas("dia"),
        obtenerBalance("mes"),
        listarBajoStock(),
        productosMasVendidos("semana", 3),
      ]);

      setVentasHoy(ventas);
      setBalanceMes(balance);
      setBajoStock(stock);
      setTopProductos(top);
    } catch (err) {
      setError("No se pudieron cargar los datos del panel");
    } finally {
      setCargando(false);
    }
  }

  const balanceNegativo = (balanceMes?.balance_neto ?? 0) < 0;

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

          <p>
            Consulta el estado de tus ventas, balance e inventario.
          </p>
        </div>

        <div className="dash-periodo">
          <span>Periodo</span>
          <strong>Hoy</strong>
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

                <span className="dash-tarjeta-contexto">
                  Hoy
                </span>
              </div>

              <span className="dash-tarjeta-label">
                Ventas de hoy
              </span>

              <span className="dash-tarjeta-valor">
                {formatearMoneda(ventasHoy?.total_ventas ?? 0)}
              </span>

              <span className="dash-tarjeta-sub">
                <ShoppingCart size={13} />
                {ventasHoy?.cantidad_ventas ?? 0} venta(s) registradas
              </span>
            </div>

            <div className="dash-tarjeta">
              <div className="dash-tarjeta-top">
                <div className="dash-tarjeta-icono azul">
                  <TrendingUp size={18} />
                </div>

                <span className="dash-tarjeta-contexto">
                  Este mes
                </span>
              </div>

              <span className="dash-tarjeta-label">
                Ingresos del mes
              </span>

              <span className="dash-tarjeta-valor">
                {formatearMoneda(balanceMes?.total_ingresos ?? 0)}
              </span>

              <span className="dash-tarjeta-sub">
                Ingresos acumulados
              </span>
            </div>

            <div className="dash-tarjeta">
              <div className="dash-tarjeta-top">
                <div
                  className={`dash-tarjeta-icono ${
                    balanceNegativo ? "rojo" : "ambar"
                  }`}
                >
                  <TrendingUp size={18} />
                </div>

                <span className="dash-tarjeta-contexto">
                  Este mes
                </span>
              </div>

              <span className="dash-tarjeta-label">
                Balance del mes
              </span>

              <span
                className={`dash-tarjeta-valor ${
                  balanceNegativo ? "negativo" : "positivo"
                }`}
              >
                {formatearMoneda(balanceMes?.balance_neto ?? 0)}
              </span>

              <span className="dash-tarjeta-sub">
                Egresos{" "}
                {formatearMoneda(balanceMes?.total_egresos ?? 0)}
              </span>
            </div>

            <div className="dash-tarjeta">
              <div className="dash-tarjeta-top">
                <div
                  className={`dash-tarjeta-icono ${
                    bajoStock.length > 0 ? "rojo" : "verde"
                  }`}
                >
                  <Package size={18} />
                </div>

                <span className="dash-tarjeta-contexto">
                  Inventario
                </span>
              </div>

              <span className="dash-tarjeta-label">
                Alertas de stock
              </span>

              <span className="dash-tarjeta-valor">
                {bajoStock.length}
              </span>

              <span
                className={`dash-tarjeta-sub ${
                  bajoStock.length > 0
                    ? "dash-sub-alerta"
                    : "dash-sub-ok"
                }`}
              >
                {bajoStock.length > 0
                  ? "Productos por acabarse"
                  : "Todo está en buen nivel"}
              </span>
            </div>
          </section>

          {/* ==================== CONTENIDO ==================== */}

          <div className="dash-columnas">
            {/* ==================== STOCK ==================== */}

            <section className="dash-seccion">
              <div className="dash-seccion-header">
                <div>
                  <h2>
                    <AlertTriangle size={16} />
                    Productos por acabarse
                  </h2>

                  <p>
                    Productos que requieren atención
                  </p>
                </div>

                {bajoStock.length > 0 && (
                  <span className="dash-contador-alerta">
                    {bajoStock.length}
                  </span>
                )}
              </div>

              {bajoStock.length === 0 ? (
                <div className="dash-sin-alertas">
                  <div className="dash-sin-alertas-icono">
                    <CheckCircle2 size={17} />
                  </div>

                  <div>
                    <strong>Todo está en orden</strong>
                    <span>
                      No hay productos con stock bajo.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="dash-lista-stock">
                  {bajoStock.map((p) => {
                    const stock = Number(p.stock_actual) || 0;

                    const nivel =
                      stock <= 2 ? "critico" : "bajo";

                    return (
                      <div
                        key={p.id}
                        className="dash-stock-fila"
                      >
                        <div className="dash-stock-info">
                          <span className="dash-stock-nombre">
                            {p.nombre}
                          </span>

                          <div className="dash-stock-barra">
                            <span
                              className={`dash-stock-progreso ${nivel}`}
                              style={{
                                width: `${Math.min(
                                  Math.max(stock * 10, 8),
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>

                        <span
                          className={`dash-badge-bajo ${nivel}`}
                        >
                          {stock === 1
                            ? "1 unidad"
                            : `${stock} unidades`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ==================== TOP PRODUCTOS ==================== */}

            <section className="dash-seccion">
              <div className="dash-seccion-header">
                <div>
                  <h2>
                    <Award size={16} />
                    Más vendidos
                  </h2>

                  <p>
                    Productos destacados de esta semana
                  </p>
                </div>

                <span className="dash-periodo-mini">
                  Esta semana
                </span>
              </div>

              {topProductos.length === 0 ? (
                <div className="dash-sin-datos">
                  <Award size={18} />
                  <span>
                    No hay ventas esta semana todavía
                  </span>
                </div>
              ) : (
                <div className="dash-lista-top">
                  {topProductos.map((p, index) => {
                    const cantidad =
                      Number(p.cantidad_vendida) || 0;

                    const porcentaje =
                      (cantidad / maxVentasProducto) * 100;

                    return (
                      <div
                        key={p.producto_id}
                        className="dash-top-fila"
                      >
                        <span className="dash-top-puesto">
                          {String(index + 1).padStart(2, "0")}
                        </span>

                        <div className="dash-top-contenido">
                          <div className="dash-top-detalle">
                            <span className="dash-top-nombre">
                              {p.producto_nombre}
                            </span>

                            <span className="dash-top-cantidad">
                              {cantidad} un.
                            </span>
                          </div>

                          <div className="dash-top-barra">
                            <span
                              style={{
                                width: `${porcentaje}%`,
                              }}
                            />
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