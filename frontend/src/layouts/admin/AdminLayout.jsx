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
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import "./AdminLayout.css";

const LINKS = [
  { to: "/admin", label: "Dashboard", Icon: LayoutDashboard, exact: true },
  { to: "/admin/ventas", label: "Ventas", Icon: Receipt },
  { to: "/admin/reportes", label: "Reportes", Icon: BarChart3 },
  { to: "/admin/salarios", label: "Salarios", Icon: Wallet },
  { to: "/admin/ingresos-egresos", label: "Ingresos / Egresos", Icon: ArrowLeftRight },
  { to: "/admin/proveedores", label: "Proveedores", Icon: Truck },
  { to: "/admin/productos", label: "Productos", Icon: Package },
  { to: "/admin/trabajadoras", label: "Trabajadoras", Icon: Users },
  { to: "/admin/recetas", label: "Recetas", Icon: ChefHat },
];

export default function AdminLayout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);

  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.rol !== "jefe") return <Navigate to="/venta" replace />;

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function irA(to) {
    setMenuAbierto(false);
    navigate(to);
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-top">
          <div className="admin-brand">
            <span className="admin-brand-linea">Bodega</span>
            <span className="admin-brand-nombre">línea amarilla</span>
          </div>

          <button
            className="admin-menu-toggle"
            onClick={() => setMenuAbierto((v) => !v)}
            aria-label="Abrir menú"
          >
            {menuAbierto ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        <nav className={`admin-nav ${menuAbierto ? "admin-nav-abierto" : ""}`}>
          {LINKS.map(({ to, label, Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              onClick={() => setMenuAbierto(false)}
              className={({ isActive }) => `admin-nav-link ${isActive ? "activo" : ""}`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}

          <button className="admin-logout admin-logout-movil" onClick={handleLogout}>
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </nav>

        <button className="admin-logout admin-logout-escritorio" onClick={handleLogout}>
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </aside>

      <main className="admin-content" onClick={() => menuAbierto && setMenuAbierto(false)}>
        <Outlet />
      </main>
    </div>
  );
}