import { useState } from "react";
import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import { ShoppingCart, Package, Clock, ChefHat, LogOut, Wheat } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import "./TrabajadoraLayout.css";

const TABS = [
  { to: "/venta", label: "Venta", Icon: ShoppingCart },
  { to: "/inventario", label: "Inventario", Icon: Package },
  { to: "/insumos", label: "Insumos", Icon: Wheat },
  { to: "/horario", label: "Horario", Icon: Clock },
  { to: "/recetas", label: "Recetas", Icon: ChefHat },
];

export default function TrabajadoraLayout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);

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

        {confirmandoSalida ? (
          <div className="trab-logout-confirm">
            <span>¿Salir?</span>
            <button
              className="trab-logout-confirm-no"
              onClick={() => setConfirmandoSalida(false)}
            >
              No
            </button>
            <button className="trab-logout-confirm-si" onClick={handleLogout}>
              Sí
            </button>
          </div>
        ) : (
          <button
            className="trab-topbar-salir"
            onClick={() => setConfirmandoSalida(true)}
          >
            <LogOut size={16} />
            Salir
          </button>
        )}
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