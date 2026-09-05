import { useEffect, useState } from "react";
import { resumenVentas, productosMasVendidos } from "../../../api/admin";
import "./Reportes.css";

const PERIODOS = [
  { valor: "dia", label: "Hoy" },
  { valor: "semana", label: "Esta semana" },
  { valor: "mes", label: "Este mes" },
];

function formatearMoneda(valor) {
  return `$${Number(valor).toLocaleString("es-CO")}`;
}

export default function Reportes() {
  const [periodo, setPeriodo] = useState("dia");
  const [resumen, setResumen] = useState(null);
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarDatos(periodo);
  }, [periodo]);

  async function cargarDatos(periodoActual) {
    setCargando(true);
    setError(null);
    try {
      const [resumenData, productosData] = await Promise.all([
        resumenVentas(periodoActual),
        productosMasVendidos(periodoActual, 10),
      ]);
      setResumen(resumenData);
      setProductos(productosData);
    } catch (err) {
      setError("No se pudieron cargar los reportes");
    } finally {
      setCargando(false);
    }
  }

  const maxCantidad = productos.length > 0
    ? Math.max(...productos.map((p) => p.cantidad_vendida))
    : 0;

  return (
    <div className="rep-container">
      <h1>Reportes</h1>

      <div className="rep-periodos">
        {PERIODOS.map((p) => (
          <button
            key={p.valor}
            className={`rep-periodo-btn ${periodo === p.valor ? "activo" : ""}`}
            onClick={() => setPeriodo(p.valor)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && <div className="rep-mensaje-error">{error}</div>}

      {!cargando && resumen && (
        <section className="rep-resumen">
          <div className="rep-resumen-fila">
            <span>Total vendido</span>
            <span className="rep-resumen-valor">{formatearMoneda(resumen.total_ventas)}</span>
          </div>
          <div className="rep-resumen-fila">
            <span>Cantidad de ventas</span>
            <span className="rep-resumen-valor">{resumen.cantidad_ventas}</span>
          </div>
        </section>
      )}

      <section className="rep-seccion">
        <h2>Productos más vendidos</h2>

        {!cargando && productos.length === 0 && (
          <p className="rep-sin-datos">No hay ventas en este periodo</p>
        )}

        <div className="rep-lista-productos">
          {productos.map((p, index) => (
            <div key={p.producto_id} className="rep-producto-fila">
              <div className="rep-producto-info">
                <span className="rep-producto-puesto">#{index + 1}</span>
                <span className="rep-producto-nombre">{p.producto_nombre}</span>
              </div>
              <div className="rep-barra-fondo">
                <div
                  className="rep-barra-relleno"
                  style={{
                    width: maxCantidad > 0 ? `${(p.cantidad_vendida / maxCantidad) * 100}%` : "0%",
                  }}
                />
              </div>
              <div className="rep-producto-cifras">
                <span>{p.cantidad_vendida} unidades</span>
                <span className="rep-producto-total">{formatearMoneda(p.total_generado)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}