import { useEffect, useState } from "react";
import { StickyNote, Check, User, Clock3, Trash2, Send } from "lucide-react";
import { listarNotas, crearNota, resolverNota, eliminarNota } from "../../../api/notas";
import { listarTrabajadoras } from "../../../api/trabajadoras";
import "./Notas.css";

const CLAVE_TRABAJADORA = "pa_venta_trabajadora"; // misma clave que usa RegistrarVenta

function formatearFecha(isoString) {
  return new Date(isoString).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function leerTrabajadoraGuardada() {
  try {
    return localStorage.getItem(CLAVE_TRABAJADORA) || "";
  } catch {
    return "";
  }
}

export default function Notas() {
  const [trabajadoras, setTrabajadoras] = useState([]);
  const [quienSoy, setQuienSoy] = useState(leerTrabajadoraGuardada);

  const [notas, setNotas] = useState([]);
  const [pestaña, setPestaña] = useState("pendientes"); // "pendientes" | "resueltas"

  const [textoNueva, setTextoNueva] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resolviendoId, setResolviendoId] = useState(null);
  const [eliminandoId, setEliminandoId] = useState(null);

  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (!mensaje) return undefined;
    const t = setTimeout(() => setMensaje(null), 3000);
    return () => clearTimeout(t);
  }, [mensaje]);

  async function cargarDatos() {
    setCargando(true);
    setError(null);
    try {
      const [trabajadorasData, notasData] = await Promise.all([
        listarTrabajadoras(),
        listarNotas(),
      ]);
      setTrabajadoras(trabajadorasData);
      setNotas(notasData);
    } catch (err) {
      setError("No se pudieron cargar las notas");
    } finally {
      setCargando(false);
    }
  }

  function elegirQuienSoy(id) {
    setQuienSoy(id);
    try {
      if (id) {
        localStorage.setItem(CLAVE_TRABAJADORA, id);
      } else {
        localStorage.removeItem(CLAVE_TRABAJADORA);
      }
    } catch {
      /* se ignora */
    }
  }

  async function handleCrearNota() {
    if (!quienSoy) {
      setError("Selecciona quién eres antes de dejar una nota");
      return;
    }
    if (!textoNueva.trim()) {
      setError("Escribe el mensaje de la nota");
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      await crearNota({
        trabajadora_creadora_id: Number(quienSoy),
        texto: textoNueva.trim(),
      });
      setTextoNueva("");
      setMensaje("Nota dejada correctamente");
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar la nota");
    } finally {
      setEnviando(false);
    }
  }

  async function handleResolver(notaId) {
    if (!quienSoy) {
      setError("Selecciona quién eres antes de marcar una nota como realizada");
      return;
    }

    setResolviendoId(notaId);
    setError(null);
    try {
      await resolverNota(notaId, Number(quienSoy));
      setMensaje("Nota marcada como realizada");
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo marcar la nota");
    } finally {
      setResolviendoId(null);
    }
  }

  async function handleEliminar(notaId) {
    setEliminandoId(notaId);
    setError(null);
    try {
      await eliminarNota(notaId);
      setMensaje("Nota eliminada");
      cargarDatos();
    } catch (err) {
      setError("No se pudo eliminar la nota");
    } finally {
      setEliminandoId(null);
    }
  }

  const pendientes = notas.filter((n) => !n.resuelta);
  const resueltas = notas.filter((n) => n.resuelta);
  const listaVisible = pestaña === "pendientes" ? pendientes : resueltas;

  return (
    <div className="notas-container">
      <header className="notas-header">
        <h1>Notas</h1>
        <p>Deja aviso de movimientos pendientes para quien tenga permiso de hacerlos</p>
      </header>

      <label className="notas-label">¿Quién eres?</label>
      <select value={quienSoy} onChange={(e) => elegirQuienSoy(e.target.value)}>
        <option value="">Selecciona...</option>
        {trabajadoras.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
      </select>

      {mensaje && (
        <div className="notas-mensaje-exito">
          <Check size={14} /> {mensaje}
        </div>
      )}
      {error && <div className="notas-mensaje-error">{error}</div>}

      <div className="notas-nueva">
        <textarea
          rows={3}
          maxLength={500}
          value={textoNueva}
          onChange={(e) => setTextoNueva(e.target.value)}
          placeholder='Ej: "El jefe se llevó 2 empanadas de pollo, no se cobraron. Falta descontar del inventario."'
        />
        <button
          type="button"
          className="notas-btn-enviar"
          onClick={handleCrearNota}
          disabled={enviando}
        >
          <Send size={14} />
          {enviando ? "Guardando..." : "Dejar nota"}
        </button>
      </div>

      <div className="notas-tabs">
        <button
          type="button"
          className={`notas-tab-btn ${pestaña === "pendientes" ? "activo" : ""}`}
          onClick={() => setPestaña("pendientes")}
        >
          Pendientes
          {pendientes.length > 0 && <span className="notas-contador">{pendientes.length}</span>}
        </button>
        <button
          type="button"
          className={`notas-tab-btn ${pestaña === "resueltas" ? "activo" : ""}`}
          onClick={() => setPestaña("resueltas")}
        >
          Realizadas
        </button>
      </div>

      <div className="notas-lista">
        {cargando && <p className="notas-sin-datos">Cargando...</p>}

        {!cargando && listaVisible.length === 0 && (
          <div className="notas-vacio">
            <StickyNote size={26} />
            <p>
              {pestaña === "pendientes"
                ? "No hay notas pendientes"
                : "Todavía no hay notas realizadas"}
            </p>
          </div>
        )}

        {!cargando &&
          listaVisible.map((n) => (
            <div key={n.id} className={`notas-tarjeta ${n.resuelta ? "resuelta" : ""}`}>
              <p className="notas-texto">{n.texto}</p>

              <div className="notas-detalle">
                <User size={12} />
                <span>{n.trabajadora_creadora_nombre}</span>
                <span>·</span>
                <Clock3 size={12} />
                <span>{formatearFecha(n.creada_en)}</span>
              </div>

              {n.resuelta ? (
                <div className="notas-resuelta-info">
                  <Check size={13} />
                  Realizada por {n.trabajadora_resuelve_nombre} · {formatearFecha(n.resuelta_en)}
                </div>
              ) : (
                <div className="notas-acciones">
                  <button
                    type="button"
                    className="notas-btn-resolver"
                    onClick={() => handleResolver(n.id)}
                    disabled={resolviendoId === n.id}
                  >
                    <Check size={13} />
                    {resolviendoId === n.id ? "Marcando..." : "Marcar como realizada"}
                  </button>
                  <button
                    type="button"
                    className="notas-btn-eliminar"
                    onClick={() => handleEliminar(n.id)}
                    disabled={eliminandoId === n.id}
                    aria-label="Eliminar nota"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}