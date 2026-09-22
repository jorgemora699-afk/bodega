import { useEffect, useState } from "react";
import { KeyRound, ArrowLeft, AlertTriangle } from "lucide-react";
import { listarTrabajadoras, verificarCodigoTrabajadora } from "../api/trabajadoras";
import "./VerificacionTrabajadora.css";

function iniciales(nombre) {
  return nombre.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
}

export default function VerificacionTrabajadora({ onVerificado }) {
  const [trabajadoras, setTrabajadoras] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [seleccionada, setSeleccionada] = useState(null);
  const [codigo, setCodigo] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    listarTrabajadoras()
      .then(setTrabajadoras)
      .catch(() => setError("No se pudo cargar la lista de trabajadoras"))
      .finally(() => setCargando(false));
  }, []);

  function elegir(trabajadora) {
    setError(null);
    setCodigo("");
    if (!trabajadora.tiene_codigo) {
      setError("Esta trabajadora no tiene código. Pide al jefe que se lo asigne.");
      return;
    }
    setSeleccionada(trabajadora);
  }

  function volver() {
    setSeleccionada(null);
    setCodigo("");
    setError(null);
  }

  async function confirmar() {
    if (!codigo || codigo.trim().length < 4) {
      setError("Ingresa tu código");
      return;
    }
    setVerificando(true);
    setError(null);
    try {
      await verificarCodigoTrabajadora(seleccionada.id, codigo.trim());
      onVerificado(seleccionada);
    } catch (err) {
      setError(err.response?.data?.error || "Código incorrecto");
    } finally {
      setVerificando(false);
    }
  }

  if (cargando) return <p className="vtrab-cargando">Cargando trabajadoras...</p>;

  if (!seleccionada) {
    return (
      <div className="vtrab-container">
        <p className="vtrab-titulo">¿Quién eres?</p>
        {error && (
          <div className="vtrab-error">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}
        <div className="vtrab-lista">
          {trabajadoras.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`vtrab-item ${!t.tiene_codigo ? "sin-codigo" : ""}`}
              onClick={() => elegir(t)}
            >
              <span className="vtrab-avatar">{iniciales(t.nombre)}</span>
              <span className="vtrab-nombre">{t.nombre}</span>
              {!t.tiene_codigo && <span className="vtrab-badge-sin">Sin código</span>}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="vtrab-container">
      <button type="button" className="vtrab-volver" onClick={volver}>
        <ArrowLeft size={14} />
        Cambiar
      </button>

      <p className="vtrab-titulo">
        <KeyRound size={15} />
        Código de {seleccionada.nombre}
      </p>

      {error && (
        <div className="vtrab-error">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      <input
        type="password"
        inputMode="numeric"
        maxLength={8}
        autoFocus
        placeholder="••••"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => e.key === "Enter" && confirmar()}
        className="vtrab-input-codigo"
      />

      <button type="button" className="vtrab-btn-confirmar" onClick={confirmar} disabled={verificando}>
        {verificando ? "Verificando..." : "Continuar"}
      </button>
    </div>
  );
}