import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  User,
  Lock,
  AlertCircle,
  ShoppingCart,
  Package,
  Clock,
  ChefHat,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import "./Login.css";

const FEATURES = [
  { Icon: ShoppingCart, label: "Ventas" },
  { Icon: Package, label: "Inventario" },
  { Icon: Clock, label: "Horarios" },
  { Icon: ChefHat, label: "Recetas" },
];

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mayusActivas, setMayusActivas] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setCargando(true);

    try {
      const rol = await login(username, password);

      if (rol === "jefe") {
        navigate("/admin");
      } else if (rol === "arte_frio") {
        navigate("/pedido");
      } else {
        navigate("/venta");
      }
    } catch (err) {
      setError("Usuario o contraseña incorrectos");
    } finally {
      setCargando(false);
    }
  }

  function detectarMayus(e) {
    if (e.getModifierState) {
      setMayusActivas(e.getModifierState("CapsLock"));
    }
  }

  return (
    <div className="login-container">
      {/* =========================
          PANEL DE MARCA
      ========================= */}
      <aside className="login-brand">
        <img
          src="/logo.png"
          alt="Punto Amarillo"
          className="login-brand-logo"
        />

        <div className="login-brand-copy">
          <h2>
            Tu negocio,
            <br />
            <span>en un solo lugar.</span>
          </h2>
          <p>Ventas, inventario, insumos, horarios y recetas.</p>

          <ul className="login-features">
            {FEATURES.map(({ Icon, label }) => (
              <li key={label}>
                <Icon size={15} />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <span className="login-brand-shape login-brand-shape-1" />
        <span className="login-brand-shape login-brand-shape-2" />
      </aside>

      {/* =========================
          FORMULARIO
      ========================= */}
      <main className="login-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-header">
            <h1>Bienvenido</h1>
            <p>Ingresa tus datos para continuar</p>
          </div>

          <div className="login-field">
            <label htmlFor="login-username">Usuario</label>
            <div className="login-input-wrapper">
              <User size={17} className="login-input-icon" />
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Tu usuario"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                required
              />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Contraseña</label>
            <div className="login-input-wrapper">
              <Lock size={17} className="login-input-icon" />
              <input
                id="login-password"
                type={mostrarPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyUp={detectarMayus}
                onKeyDown={detectarMayus}
                onBlur={() => setMayusActivas(false)}
                placeholder="Tu contraseña"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="login-toggle-password"
                onClick={() => setMostrarPassword((v) => !v)}
                aria-label={
                  mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                tabIndex={-1}
              >
                {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {mayusActivas && (
              <p className="login-hint">
                <AlertCircle size={13} />
                Bloq Mayús está activado
              </p>
            )}
          </div>

          <div aria-live="polite">
            {error && (
              <p className="login-error" role="alert">
                <AlertCircle size={15} />
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="login-submit"
            disabled={cargando}
          >
            {cargando ? (
              <>
                <span className="login-spinner" />
                Ingresando...
              </>
            ) : (
              <>
                Entrar
                <ArrowRight size={17} />
              </>
            )}
          </button>

          <p className="login-footer">Punto Amarillo · Acceso privado</p>
        </form>
      </main>
    </div>
  );
}