
import { useState } from "react";
import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  Package,
  Clock,
  ChefHat,
  LogOut,
  Wheat,
  Receipt,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
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
];

export default function TrabajadoraLayout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const [confirmandoSalida, setConfirmandoSalida] = useState(false);

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

