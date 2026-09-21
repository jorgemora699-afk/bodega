import { useState } from "react";
import { User, Lock, Check } from "lucide-react";
import { cambiarCredenciales } from "../../../api/auth";
import { useAuth } from "../../../context/AuthContext";
import "./MiCuenta.css";

export default function MiCuenta() {
  const { usuario, actualizarUsername } = useAuth();

  const [nuevoUsername, setNuevoUsername] = useState(usuario?.username || "");
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [passwordActual, setPasswordActual] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  async function guardar() {
    setError(null);
    setMensaje(null);

    if (!passwordActual) {
      setError("Debes confirmar tu contraseña actual");
      return;
    }
    if (nuevaPassword && nuevaPassword !== confirmarPassword) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }

    setGuardando(true);
    try {
      const payload = { password_actual: passwordActual };
      if (nuevoUsername && nuevoUsername !== usuario.username) {
        payload.nuevo_username = nuevoUsername;
      }
      if (nuevaPassword) {
        payload.nueva_password = nuevaPassword;
      }

      const actualizado = await cambiarCredenciales(payload);
      actualizarUsername(actualizado.username);

      setMensaje("Credenciales actualizadas correctamente");
      setPasswordActual("");
      setNuevaPassword("");
      setConfirmarPassword("");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudieron actualizar las credenciales");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="cuenta-container">
      <header className="cuenta-header">
        <h1>Mi cuenta</h1>
        <p>Cambia tu usuario o contraseña</p>
      </header>

      {mensaje && (
        <div className="cuenta-mensaje-exito">
          <Check size={16} /> {mensaje}
        </div>
      )}
      {error && <div className="cuenta-mensaje-error">{error}</div>}

      <div className="cuenta-form">
        <label>
          <User size={14} /> Usuario
        </label>
        <input
          type="text"
          value={nuevoUsername}
          onChange={(e) => setNuevoUsername(e.target.value)}
        />

        <label>
          <Lock size={14} /> Nueva contraseña (opcional)
        </label>
        <input
          type="password"
          value={nuevaPassword}
          onChange={(e) => setNuevaPassword(e.target.value)}
          placeholder="Deja en blanco para no cambiarla"
        />

        {nuevaPassword && (
          <>
            <label>Confirmar nueva contraseña</label>
            <input
              type="password"
              value={confirmarPassword}
              onChange={(e) => setConfirmarPassword(e.target.value)}
            />
          </>
        )}

        <div className="cuenta-separador" />

        <label>
          <Lock size={14} /> Contraseña actual (para confirmar)
        </label>
        <input
          type="password"
          value={passwordActual}
          onChange={(e) => setPasswordActual(e.target.value)}
        />

        <button className="cuenta-btn-guardar" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}