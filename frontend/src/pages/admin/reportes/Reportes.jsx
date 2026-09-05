import { useEffect, useState } from "react";
import { TrendingUp, Users, Receipt, Award } from "lucide-react";
import {
  resumenVentas,
  productosMasVendidos,
  ventasPorTrabajadora,
  ventasPorDia,
  tendenciaMensual,
} from "../../../api/admin";
import "./Reportes.css";

const PERIODOS = [
  { valor: "dia", label: "Hoy" },
  { valor: "semana", label: "Esta semana" },
  { valor: "mes", label: "Este mes" },
];

function formatearMoneda(valor) {
  return `$${Number(valor).toLocaleString("es-CO")}`;
}

function formatearFechaCorta(isoString) {
  const [, mes, dia] = isoString.split("-");
  return `${dia}/${mes}`;
}

export default function Reportes() {
  const [periodo, setPeriodo] = useState("semana");

  const [resumen, setResumen] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [porTrabajadora, setPorTrabajadora] = useState([]);
  const [porDia, setPorDia] = useState([]);
  const [tendencia, setTendencia] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarDatos(periodo);
  }, [periodo]);

  useEffect(() => {
    tendenciaMensual(6).then(setTendencia).catch(() => {});
  }, []);

  async function cargarDatos(periodoActual) {
    setCargando(true);
    setError(null);
    try {
      const [resumenData, rankingData, trabajadoraData, diaData] = await Promise.all([
        resumenVentas(periodoActual),
        productosMasVendidos(periodoActual, 20),
        ventasPorTrabajadora(periodoActual),
        ventasPorDia(periodoActual),
      ]);
      setResumen(resumenData);
      setRanking(rankingData);
      setPorTrabajadora(trabajadoraData);
      setPorDia(diaData);
    } catch (err) {
      setError("No se pudieron cargar los reportes");
    } finally {
      setCargando(false);
    }
  }

  const ticketPromedio =
    resumen && resumen.cantidad_ventas > 0
      ? resumen.total_ventas / resumen.cantidad_ventas
      : 0;

  const maxRanking = ranking.length > 0 ? Math.max(...ranking.map((p) => p.cantidad_vendida)) : 0;
  const maxTrabajadora = porTrabajadora.length > 0 ? Math.max(...porTrabajadora.map((t) => t.total_vendido)) : 0;
  const maxDia = porDia.length > 0 ? Math.max(...porDia.map((d) => d.total)) : 0;
  const maxTendencia = tendencia.length > 0 ? Math.max(...tendencia.map((m) => m.total_ventas)) : 0;

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
            className={`rep-periodo-btn ${periodo === p.valor ? "activo" : ""}`}
            onClick={() => setPeriodo(p.valor)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && <div className="rep-mensaje-error">{error}</div>}

      {!cargando && resumen && (
        <section className="rep-metricas">
          <div className="rep-metrica">
            <span className="rep-metrica-label">Total vendido</span>
            <span className="rep-metrica-valor">{formatearMoneda(resumen.total_ventas)}</span>
          </div>
          <div className="rep-metrica">
            <span className="rep-metrica-label">Ventas</span>
            <span className="rep-metrica-valor">{resumen.cantidad_ventas}</span>
          </div>
          <div className="rep-metrica">
            <span className="rep-metrica-label">Ticket promedio</span>
            <span className="rep-metrica-valor">{formatearMoneda(ticketPromedio)}</span>
          </div>
        </section>
      )}

      {!cargando && porDia.length > 0 && (
        <section className="rep-seccion">
          <h2>
            <TrendingUp size={15} />
            Ventas por día
          </h2>
          <div className="rep-barras-dia">
            {porDia.map((d) => (
              <div key={d.fecha} className="rep-barra-dia-col">
                <div className="rep-barra-dia-track">
                  <div
                    className="rep-barra-dia-fill"
                    style={{ height: maxDia > 0 ? `${(d.total / maxDia) * 100}%` : "0%" }}
                    title={formatearMoneda(d.total)}
                  />
                </div>
                <span className="rep-barra-dia-label">{formatearFechaCorta(d.fecha)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rep-seccion">
        <h2>
          <Award size={15} />
          Ranking de productos
        </h2>

        {!cargando && ranking.length === 0 && (
          <p className="rep-sin-datos">No hay ventas en este período</p>
        )}

        <div className="rep-lista-productos">
          {ranking.map((p, index) => (
            <div key={p.producto_id} className="rep-producto-fila">
              <div className="rep-producto-info">
                <span className="rep-producto-puesto">#{index + 1}</span>
                <span className="rep-producto-nombre">{p.producto_nombre}</span>
              </div>
              <div className="rep-barra-fondo">
                <div
                  className="rep-barra-relleno"
                  style={{ width: maxRanking > 0 ? `${(p.cantidad_vendida / maxRanking) * 100}%` : "0%" }}
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

      <section className="rep-seccion">
        <h2>
          <Users size={15} />
          Ventas por trabajadora
        </h2>

        {!cargando && porTrabajadora.length === 0 && (
          <p className="rep-sin-datos">No hay ventas en este período</p>
        )}

        <div className="rep-lista-productos">
          {porTrabajadora.map((t) => (
            <div key={t.trabajadora_id} className="rep-producto-fila">
              <div className="rep-producto-info">
                <span className="rep-producto-nombre">{t.trabajadora_nombre}</span>
              </div>
              <div className="rep-barra-fondo">
                <div
                  className="rep-barra-relleno ambar"
                  style={{ width: maxTrabajadora > 0 ? `${(t.total_vendido / maxTrabajadora) * 100}%` : "0%" }}
                />
              </div>
              <div className="rep-producto-cifras">
                <span>{t.cantidad_ventas} venta(s)</span>
                <span className="rep-producto-total">{formatearMoneda(t.total_vendido)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rep-seccion">
        <h2>
          <Receipt size={15} />
          Tendencia — últimos 6 meses
        </h2>
        <div className="rep-barras-dia rep-barras-tendencia">
          {tendencia.map((m) => (
            <div key={m.etiqueta} className="rep-barra-dia-col">
              <div className="rep-barra-dia-track">
                <div
                  className="rep-barra-dia-fill navy"
                  style={{ height: maxTendencia > 0 ? `${(m.total_ventas / maxTendencia) * 100}%` : "0%" }}
                  title={formatearMoneda(m.total_ventas)}
                />
              </div>
              <span className="rep-barra-dia-label">{m.etiqueta}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}