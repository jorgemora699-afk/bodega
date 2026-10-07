import { useEffect, useRef, useState } from "react";
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
  ClipboardList,
  Volume2,
  VolumeX,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { listarNotas } from "../../api/notas";
import { contarSolicitudesPendientes } from "../../api/solicitudesPedido";
// RUTA CORREGIDA: Subir dos niveles ../../
import { reproducirNotificacion, desbloquearVoz } from "../../api/notificacionSonido"; 
import "./TrabajadoraLayout.css";

const TABS = [
  { to: "/venta", label: "Venta", Icon: ShoppingCart },
  { to: "/ventas-hoy", label: "Ventas", Icon: Receipt },
  { to: "/inventario", label: "Inventario", Icon: Package },
  { to: "/insumos", label: "Insumos", Icon: Wheat },
  { to: "/horario", label: "Horario", Icon: Clock },
  { to: "/recetas", label: "Recetas", Icon: ChefHat },
  { to: "/solicitudes-pedido", label: "Pedidos", Icon: ClipboardList },
  { to: "/notas", label: "Notas", Icon: StickyNote },
];

const INTERVALO_REFRESCO_MS = 5000;

export default function TrabajadoraLayout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [confirmandoSalida, setConfirmandoSalida] = useState(false);
  const [notasPendientes, setNotasPendientes] = useState(0);
  const [pedidosPendientes, setPedidosPendientes] = useState(0);
  const [sonidoActivo, setSonidoActivo] = useState(false);

  const pedidosPendientesPrevRef = useRef(null);

  useEffect(() => {
    cargarContadorNotas();
    cargarContadorPedidos();

    const intervalo = setInterval(() => {
      cargarContadorNotas();
      cargarContadorPedidos();
    }, INTERVALO_REFRESCO_MS);

    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  async function cargarContadorNotas() {
    try {
      const notas = await listarNotas();
      setNotasPendientes(notas.filter((n) => !n.resuelta).length);
    } catch (err) {
      // Ignorar error para no bloquear el renderizado
    }
  }

  async function cargarContadorPedidos() {
    try {
      const { pendientes } = await contarSolicitudesPendientes();

      const anterior = pedidosPendientesPrevRef.current;
      if (anterior !== null && pendientes > anterior) {
        reproducirNotificacion();
      }
      pedidosPendientesPrevRef.current = pendientes;

      setPedidosPendientes(pendientes);
    } catch (err) {
      // Ignorar error para no bloquear el renderizado
    }
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (usuario.rol !== "trabajadora") {
    const destino = usuario.rol === "jefe" ? "/admin" : usuario.rol === "arte_frio" ? "/pedido" : "/login";
    return <Navigate to={destino} replace />;
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

        {/* BOTÓN ACTIVAR SONIDO EN EL HEADER */}
        <button
          onClick={() => {
            desbloquearVoz();
            setSonidoActivo(true);
          }}
          className={`notif-btn-sonido ${sonidoActivo ? "activo" : ""}`}
          title={sonidoActivo ? "Sonido activado" : "Activar sonido"}
          aria-label={sonidoActivo ? "Sonido activado" : "Activar sonido"}
        >
          {sonidoActivo ? (
            <Volume2 size={18} />
          ) : (
            <VolumeX size={18} />
          )}
        </button>

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

            <span>¿Cerrar sesión?</span>

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

              {to === "/solicitudes-pedido" && pedidosPendientes > 0 && (
                <span className="trab-tab-badge">
                  {pedidosPendientes > 9 ? "9+" : pedidosPendientes}
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