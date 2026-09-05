import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle2, Award } from "lucide-react";
import { resumenVentas, obtenerBalance, productosMasVendidos } from "../../../api/admin";
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

  return (
    <div className="dash-container">
      <header className="dash-header">
        <h1>Panel del negocio</h1>
        <p>Resumen de hoy y del mes en curso</p>
      </header>

      {error && <div className="dash-mensaje-error">{error}</div>}

      {cargando ? (
        <p className="dash-cargando">Cargando...</p>
      ) : (
        <>
          <section className="dash-tarjetas">
            <div className="dash-tarjeta">
              <div className="dash-tarjeta-icono verde">
                <DollarSign size={18} />
              </div>
              <span className="dash-tarjeta-label">Ventas de hoy</span>
              <span className="dash-tarjeta-valor">
                {formatearMoneda(ventasHoy?.total_ventas ?? 0)}
              </span>
              <span className="dash-tarjeta-sub">
                {ventasHoy?.cantidad_ventas ?? 0} venta(s)
              </span>
            </div>

            <div className="dash-tarjeta">
              <div className={`dash-tarjeta-icono ${balanceNegativo ? "rojo" : "ambar"}`}>
                <TrendingUp size={18} />
              </div>
              <span className="dash-tarjeta-label">Balance del mes</span>
              <span className={`dash-tarjeta-valor ${balanceNegativo ? "negativo" : ""}`}>
                {formatearMoneda(balanceMes?.balance_neto ?? 0)}
              </span>
              <span className="dash-tarjeta-sub">
                Ingresos {formatearMoneda(balanceMes?.total_ingresos ?? 0)} · Egresos{" "}
                {formatearMoneda(balanceMes?.total_egresos ?? 0)}
              </span>
            </div>
          </section>

          <div className="dash-columnas">
            <section className="dash-seccion">
              <h2>
                <AlertTriangle size={15} />
                Productos por acabarse
              </h2>

              {bajoStock.length === 0 ? (
                <div className="dash-sin-alertas">
                  <CheckCircle2 size={16} />
                  <span>Todo el stock está en buen nivel</span>
                </div>
              ) : (
                <div className="dash-lista-stock">
                  {bajoStock.map((p) => (
                    <div key={p.id} className="dash-stock-fila">
                      <span>{p.nombre}</span>
                      <span className="dash-badge-bajo">Quedan {p.stock_actual}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="dash-seccion">
              <h2>
                <Award size={15} />
                Más vendidos esta semana
              </h2>

              {topProductos.length === 0 ? (
                <p className="dash-sin-datos">No hay ventas esta semana todavía</p>
              ) : (
                <div className="dash-lista-top">
                  {topProductos.map((p, index) => (
                    <div key={p.producto_id} className="dash-top-fila">
                      <span className="dash-top-puesto">#{index + 1}</span>
                      <span className="dash-top-nombre">{p.producto_nombre}</span>
                      <span className="dash-top-cantidad">{p.cantidad_vendida} un.</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}