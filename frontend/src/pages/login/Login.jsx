import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, User, Lock, Store, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import "./Login.css";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
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
      } else {
        navigate("/venta");
      }
    } catch (err) {
      setError("Usuario o contraseña incorrectos");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="login-container">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-logo">
          <Store size={26} />
        </div>

        <h1>Bodega línea amarilla</h1>
        <p>Ingresa para continuar</p>

        <label>Usuario</label>
        <div className="login-input-wrapper">
          <User size={17} className="login-input-icon" />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Tu usuario"
            required
          />
        </div>

        <label>Contraseña</label>
        <div className="login-input-wrapper">
          <Lock size={17} className="login-input-icon" />
          <input
            type={mostrarPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña"
            required
          />
          <button
            type="button"
            className="login-toggle-password"
            onClick={() => setMostrarPassword((v) => !v)}
            tabIndex={-1}
          >
            {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {error && (
          <p className="login-error">
            <AlertCircle size={14} />
            {error}
          </p>
        )}

        <button type="submit" disabled={cargando}>
          {cargando ? "Ingresando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}