import { useEffect, useState } from "react";
import { UserRound, Plus, Pencil, Trash2, X, Search, DollarSign, AlertTriangle } from "lucide-react";
import {
  listarTrabajadoras,
  crearTrabajadora,
  actualizarTrabajadora,
  eliminarTrabajadora,
} from "../../../api/trabajadoras";
import "./Trabajadoras.css";

function formVacio() {
  return { nombre: "", valor_hora: "" };
}

function iniciales(nombre) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

export default function Trabajadoras() {
  const [trabajadoras, setTrabajadoras] = useState([]);
  const [busqueda, setBusqueda] = useState("");

  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(formVacio());
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(null);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setError(null);
    try {
      setTrabajadoras(await listarTrabajadoras());
    } catch (err) {
      setError("No se pudieron cargar las trabajadoras");
    }
  }

  function iniciarCreacion() {
    setCreando(true);
    setEditandoId(null);
    setForm(formVacio());
    setMensaje(null);
    setError(null);
  }

  function iniciarEdicion(trabajadora) {
    setEditandoId(trabajadora.id);
    setCreando(false);
    setMensaje(null);
    setError(null);
    setForm({
      nombre: trabajadora.nombre,
      valor_hora: trabajadora.valor_hora ?? "",
    });
  }

  function cancelar() {
    setCreando(false);
    setEditandoId(null);
    setForm(formVacio());
  }

  async function guardar() {
    if (!form.nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      const payload = {
        nombre: form.nombre,
        valor_hora: form.valor_hora ? Number(form.valor_hora) : null,
      };

      if (editandoId) {
        await actualizarTrabajadora(editandoId, payload);
        setMensaje("Trabajadora actualizada");
      } else {
        await crearTrabajadora(payload);
        setMensaje("Trabajadora creada");
      }
      cancelar();
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar la trabajadora");
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminar(trabajadoraId) {
    setGuardando(true);
    setError(null);
    try {
      await eliminarTrabajadora(trabajadoraId);
      setMensaje("Trabajadora desactivada");
      setConfirmandoEliminar(null);
      cargarDatos();
    } catch (err) {
      setError("No se pudo desactivar la trabajadora");
    } finally {
      setGuardando(false);
    }
  }

  const formularioAbierto = creando || editandoId !== null;

  const trabajadorasFiltradas = trabajadoras.filter((t) =>
    t.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const sinValorHora = trabajadoras.filter((t) => t.valor_hora == null).length;

  return (
    <div className="trabad-container">
      <header className="trabad-header">
        <div>
          <h1>Trabajadoras</h1>
          <p>Equipo y valor por hora para el cálculo de salario</p>
        </div>
        {!formularioAbierto && (
          <button className="trabad-btn-nuevo" onClick={iniciarCreacion}>
            <Plus size={16} />
            Nueva
          </button>
        )}
      </header>

      {mensaje && <div className="trabad-mensaje-exito">{mensaje}</div>}
      {error && <div className="trabad-mensaje-error">{error}</div>}

      {!formularioAbierto && sinValorHora > 0 && (
        <div className="trabad-alerta-global">
          <AlertTriangle size={15} />
          {sinValorHora === 1
            ? "1 trabajadora no tiene valor por hora configurado"
            : `${sinValorHora} trabajadoras no tienen valor por hora configurado`}
        </div>
      )}

      {formularioAbierto && (
        <div className="trabad-form">
          <label>Nombre</label>
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            placeholder="Ej: María Pérez"
          />

          <label>Valor por hora (opcional)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.valor_hora}
            onChange={(e) => setForm((f) => ({ ...f, valor_hora: e.target.value }))}
            placeholder="Necesario para calcular el salario"
          />

          <div className="trabad-botones">
            <button className="trabad-btn-secundario" onClick={cancelar} disabled={guardando}>
              <X size={15} />
              Cancelar
            </button>
            <button className="trabad-btn-primario" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {!formularioAbierto && (
        <>
          {trabajadoras.length > 0 && (
            <div className="trabad-buscador">
              <Search size={16} />
              <input
                type="text"
                placeholder="Buscar trabajadora..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          )}

          <div className="trabad-lista">
            {trabajadorasFiltradas.map((t) => (
              <div key={t.id} className="trabad-tarjeta">
                <div className="trabad-fila-principal">
                  <div className="trabad-nombre-icono">
                    <div className="trabad-avatar">{iniciales(t.nombre)}</div>
                    <span className="trabad-nombre">{t.nombre}</span>
                  </div>

                  {t.valor_hora != null ? (
                    <span className="trabad-valor-hora">
                      <DollarSign size={13} />
                      {Number(t.valor_hora).toLocaleString("es-CO")}/h
                    </span>
                  ) : (
                    <span className="trabad-sin-valor">
                      <AlertTriangle size={12} />
                      Sin configurar
                    </span>
                  )}
                </div>

                {confirmandoEliminar === t.id ? (
                  <div className="trabad-confirmar">
                    <span>¿Desactivar esta trabajadora?</span>
                    <div className="trabad-botones">
                      <button
                        className="trabad-btn-secundario"
                        onClick={() => setConfirmandoEliminar(null)}
                        disabled={guardando}
                      >
                        No
                      </button>
                      <button
                        className="trabad-btn-peligro"
                        onClick={() => confirmarEliminar(t.id)}
                        disabled={guardando}
                      >
                        Sí, desactivar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="trabad-acciones">
                    <button className="trabad-btn-secundario" onClick={() => iniciarEdicion(t)}>
                      <Pencil size={13} />
                      Editar
                    </button>
                    <button
                      className="trabad-btn-peligro-outline"
                      onClick={() => setConfirmandoEliminar(t.id)}
                    >
                      <Trash2 size={13} />
                      Desactivar
                    </button>
                  </div>
                )}
              </div>
            ))}

            {trabajadoras.length === 0 && (
              <p className="trabad-sin-datos">Todavía no hay trabajadoras registradas</p>
            )}
            {trabajadoras.length > 0 && trabajadorasFiltradas.length === 0 && (
              <p className="trabad-sin-datos">Ninguna trabajadora coincide con "{busqueda}"</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}