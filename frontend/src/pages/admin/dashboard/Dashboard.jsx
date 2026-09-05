import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { resumenVentas, obtenerBalance } from "../../../api/admin";
import { listarBajoStock } from "../../../api/inventario";
import "./Dashboard.css";

function formatearMoneda(valor) {
  return `$${Number(valor).toLocaleString("es-CO")}`;
}

export default function Dashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [ventasHoy, setVentasHoy] = useState(null);
  const [balanceMes, setBalanceMes] = useState(null);
  const [bajoStock, setBajoStock] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargando(true);
    setError(null);
    try {
      const [ventas, balance, stock] = await Promise.all([
        resumenVentas("dia"),
        obtenerBalance("mes"),
        listarBajoStock(),
      ]);
      setVentasHoy(ventas);
      setBalanceMes(balance);
      setBajoStock(stock);
    } catch (err) {
      setError("No se pudieron cargar los datos del panel");
    } finally {
      setCargando(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const accesos = [
    { label: "Ventas", ruta: "/admin/ventas" },
    { label: "Reportes", ruta: "/admin/reportes" },
    { label: "Salarios", ruta: "/admin/salarios" },
    { label: "Ingresos / Egresos", ruta: "/admin/ingresos-egresos" },
    { label: "Proveedores", ruta: "/admin/proveedores" },
    { label: "Productos", ruta: "/admin/productos" },
    { label: "Trabajadoras", ruta: "/admin/trabajadoras" },
    { label: "Recetas", ruta: "/admin/recetas" },
  ];

    return (
    <div className="dash-container">
      <h1 className="dash-titulo">Panel del negocio</h1>

      {error && <div className="dash-mensaje-error">{error}</div>}

      {!cargando && (
        <>
          <section className="dash-tarjetas">
            <div className="dash-tarjeta">
              <span className="dash-tarjeta-label">Ventas de hoy</span>
              <span className="dash-tarjeta-valor">
                {formatearMoneda(ventasHoy?.total_ventas ?? 0)}
              </span>
              <span className="dash-tarjeta-sub">
                {ventasHoy?.cantidad_ventas ?? 0} venta(s)
              </span>
            </div>

            <div className="dash-tarjeta">
              <span className="dash-tarjeta-label">Balance del mes</span>
              <span
                className={`dash-tarjeta-valor ${
                  (balanceMes?.balance_neto ?? 0) < 0 ? "negativo" : ""
                }`}
              >
                {formatearMoneda(balanceMes?.balance_neto ?? 0)}
              </span>
              <span className="dash-tarjeta-sub">
                Ingresos {formatearMoneda(balanceMes?.total_ingresos ?? 0)} · Egresos{" "}
                {formatearMoneda(balanceMes?.total_egresos ?? 0)}
              </span>
            </div>
          </section>

          <section className="dash-seccion">
            <h2>Productos por acabarse</h2>
            {bajoStock.length === 0 ? (
              <p className="dash-sin-alertas">Todo el stock está en buen nivel</p>
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
        </>
      )}
    </div>
  );
}