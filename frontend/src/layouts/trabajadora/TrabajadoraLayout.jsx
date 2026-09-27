import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  ShoppingCart,
  Package,
  Clock,
  ChefHat,
  LogOut,
  Wheat,
  Receipt,
  StickyNote,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { listarNotas } from "../../api/notas";
import "./TrabajadoraLayout.css";

const TABS = [
  {
    to: "/venta",
    label: "Venta",
    Icon: ShoppingCart,
  },
  { to: "/ventas-hoy", 
    label: "Ventas", 
    Icon: Receipt 
  },
  {
    to: "/inventario",
    label: "Inventario",
    Icon: Package,
  },
  {
    to: "/insumos",
    label: "Insumos",
    Icon: Wheat,
  },
  {
    to: "/horario",
    label: "Horario",
    Icon: Clock,
  },
  {
    to: "/recetas",
    label: "Recetas",
    Icon: ChefHat,
  },
  {
    to: "/notas",
    label: "Notas",
    Icon: StickyNote,
  },
];

const INTERVALO_REFRESCO_MS = 30000; // 30s — mantiene el contador razonablemente al día sin saturar el backend

export default function TrabajadoraLayout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [confirmandoSalida, setConfirmandoSalida] = useState(false);
  const [notasPendientes, setNotasPendientes] = useState(0);

  useEffect(() => {
    cargarContadorNotas();

    const intervalo = setInterval(cargarContadorNotas, INTERVALO_REFRESCO_MS);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]); // se refresca también al cambiar de pestaña, así al volver de "Notas" el número ya está al día

  async function cargarContadorNotas() {
    try {
      const notas = await listarNotas();
      setNotasPendientes(notas.filter((n) => !n.resuelta).length);
    } catch (err) {
      // si falla, simplemente no se muestra el número — no bloquea el resto del layout
    }
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (usuario.rol !== "trabajadora") {
    return <Navigate to="/admin" replace />;
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="trab-shell">

      {/* =========================
          TOPBAR
      ========================= */}
      <header className="trab-topbar">

        <div className="trab-brand">
          <img
            src="/logo.png"
            alt="Punto Amarillo"
            className="trab-logo"
          />
        </div>

        <div className="trab-user">

          <div className="trab-user-info">
            <strong>
              {usuario.nombre || "Trabajadora"}
            </strong>

            <span>
              Punto Amarillo
            </span>
          </div>

          <div className="trab-user-avatar">
            {usuario.nombre?.charAt(0)?.toUpperCase() || "T"}
          </div>

        </div>

        {/* =========================
            CERRAR SESIÓN
        ========================= */}

        {confirmandoSalida ? (

          <div className="trab-logout-confirm">

            <span>
              ¿Cerrar sesión?
            </span>

            <button
              className="trab-logout-confirm-no"
              onClick={() => setConfirmandoSalida(false)}
            >
              No
            </button>

            <button
              className="trab-logout-confirm-si"
              onClick={handleLogout}
            >
              Sí
            </button>

          </div>

        ) : (

          <button
            className="trab-topbar-salir"
            onClick={() => setConfirmandoSalida(true)}
          >
            <LogOut size={16} />
            <span>Salir</span>
          </button>

        )}

      </header>


      {/* =========================
          CONTENIDO
      ========================= */}

      <main className="trab-content">
        <Outlet />
      </main>


      {/* =========================
          NAVEGACIÓN
      ========================= */}

      <nav className="trab-tabbar">

        {TABS.map(({ to, label, Icon }) => (

          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `trab-tab ${isActive ? "activo" : ""}`
            }
          >

            <span className="trab-tab-icon">
              <Icon size={20} strokeWidth={2} />

              {to === "/notas" && notasPendientes > 0 && (
                <span className="trab-tab-badge">
                  {notasPendientes > 9 ? "9+" : notasPendientes}
                </span>
              )}
            </span>

            <span className="trab-tab-label">
              {label}
            </span>

          </NavLink>

        ))}

      </nav>

    </div>
  );
}