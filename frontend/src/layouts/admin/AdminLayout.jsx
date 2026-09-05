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

  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.rol !== "jefe") return <Navigate to="/venta" replace />;

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-linea">Bodega</span>
          <span className="admin-brand-nombre">línea amarilla</span>
        </div>

        <nav className="admin-nav">
          {LINKS.map(({ to, label, Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) => `admin-nav-link ${isActive ? "activo" : ""}`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <button className="admin-logout" onClick={handleLogout}>
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </aside>

      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}