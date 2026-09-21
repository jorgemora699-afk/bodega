import { useState } from "react";
import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  BarChart3,
  Wallet,
  ArrowLeftRight,
  Truck,
  Package,
  Users,
  ChefHat,
  LogOut,
  Menu,
  X,
  Boxes,
  Wheat,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import "./AdminLayout.css";

const LINKS = [
  {
    to: "/admin",
    label: "Dashboard",
    Icon: LayoutDashboard,
    exact: true,
  },
  {
    to: "/admin/ventas",
    label: "Ventas",
    Icon: Receipt,
  },
  {
    to: "/admin/reportes",
    label: "Reportes",
    Icon: BarChart3,
  },
  {
    to: "/admin/salarios",
    label: "Salarios",
    Icon: Wallet,
  },
  {
    to: "/admin/ingresos-egresos",
    label: "Ingresos / Egresos",
    Icon: ArrowLeftRight,
  },
  {
    to: "/admin/proveedores",
    label: "Proveedores",
    Icon: Truck,
  },
  {
    to: "/admin/productos",
    label: "Productos",
    Icon: Package,
  },
  {
    to: "/admin/inventario",
    label: "Inventario",
    Icon: Boxes,
  },
  {
    to: "/admin/insumos",
    label: "Insumos",
    Icon: Wheat,
  },
  {
    to: "/admin/trabajadoras",
    label: "Trabajadoras",
    Icon: Users,
  },
  {
    to: "/admin/recetas",
    label: "Recetas",
    Icon: ChefHat,
  },
];

export default function AdminLayout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const [menuAbierto, setMenuAbierto] = useState(false);
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (usuario.rol !== "jefe") {
    return <Navigate to="/venta" replace />;
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function cerrarMenu() {
    setMenuAbierto(false);
  }

  return (
    <div className="admin-shell">

      {/* SIDEBAR */}
      <aside className={`admin-sidebar ${menuAbierto ? "sidebar-abierto" : ""}`}>

        {/* HEADER DEL SIDEBAR */}
        <div className="admin-sidebar-header">

          <div className="admin-brand">
            <img
              src="/logo.png"
              alt="Punto Amarillo"
              className="admin-logo"
            />
          </div>

          <button
            className="admin-menu-toggle"
            onClick={() => setMenuAbierto((v) => !v)}
            aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
          >
            {menuAbierto ? <X size={22} /> : <Menu size={22} />}
          </button>

        </div>

        {/* SEPARADOR */}
        <div className="admin-sidebar-divider" />

        {/* NAVEGACIÓN */}
        <nav className="admin-nav">

          <div className="admin-nav-section">
            <span className="admin-nav-title">
              ADMINISTRACIÓN
            </span>

            {LINKS.map(({ to, label, Icon, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                onClick={cerrarMenu}
                className={({ isActive }) =>
                  `admin-nav-link ${isActive ? "activo" : ""}`
                }
              >
                <span className="admin-nav-icon">
                  <Icon size={18} strokeWidth={2} />
                </span>

                <span className="admin-nav-label">
                  {label}
                </span>
              </NavLink>
            ))}
          </div>

        </nav>

        {/* PARTE INFERIOR */}
        <div className="admin-sidebar-bottom">

          <div className="admin-user">
            <div className="admin-user-avatar">
              {usuario.nombre?.charAt(0)?.toUpperCase() || "J"}
            </div>

            <div className="admin-user-info">
              <strong>
                {usuario.nombre || "Administrador"}
              </strong>

              <span>
                Administrador
              </span>
            </div>
          </div>

          {confirmandoSalida ? (

            <div className="admin-logout-confirm">

              <span>
                ¿Cerrar sesión?
              </span>

              <div className="admin-logout-confirm-botones">

                <button
                  type="button"
                  onClick={() => setConfirmandoSalida(false)}
                >
                  No
                </button>

                <button
                  type="button"
                  className="admin-logout-confirm-si"
                  onClick={handleLogout}
                >
                  Sí
                </button>

              </div>

            </div>

          ) : (

            <button
              type="button"
              className="admin-logout"
              onClick={() => setConfirmandoSalida(true)}
            >
              <LogOut size={17} />

              <span>
                Cerrar sesión
              </span>
            </button>

          )}

        </div>

      </aside>

      {/* CONTENIDO */}
      <main
        className="admin-content"
        onClick={() => menuAbierto && setMenuAbierto(false)}
      >
        <Outlet />
      </main>

    </div>
  );
}
