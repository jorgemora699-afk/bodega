import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import { ShoppingCart, Package, Clock, ChefHat, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import "./TrabajadoraLayout.css";

const TABS = [
  { to: "/venta", label: "Venta", Icon: ShoppingCart },
  { to: "/inventario", label: "Inventario", Icon: Package },
  { to: "/horario", label: "Horario", Icon: Clock },
  { to: "/recetas", label: "Recetas", Icon: ChefHat },
];

export default function TrabajadoraLayout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.rol !== "trabajadora") return <Navigate to="/admin" replace />;

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="trab-shell">
      <header className="trab-topbar">
        <span className="trab-topbar-title">Bodega línea amarilla</span>
        <button className="trab-topbar-salir" onClick={handleLogout}>
          <LogOut size={16} />
          Salir
        </button>
      </header>

      <main className="trab-content">
        <Outlet />
      </main>

      <nav className="trab-tabbar">
        {TABS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `trab-tab ${isActive ? "activo" : ""}`}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}