import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search, DollarSign, AlertTriangle, Clock, Wallet, KeyRound  } from "lucide-react";
import {
  listarTrabajadoras,
  crearTrabajadora,
  actualizarTrabajadora,
  eliminarTrabajadora,
  establecerCodigoTrabajadora,
  eliminarCodigoTrabajadora,
} from "../../../api/trabajadoras";
import Sheet from "../../../components/Sheet";
import "./Trabajadoras.css";

function formVacio() {
  return {
    nombre: "",
    tipo_pago: "hora",
    valor_hora: "",
    salario_mensual: "",
    incluye_nomina: true,
  };
}

function iniciales(nombre) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function formatearMoneda(valor) {
  return `$${Number(valor).toLocaleString("es-CO")}`;
}

export default function Trabajadoras() {
  const [trabajadoras, setTrabajadoras] = useState([]);
  const [busqueda, setBusqueda] = useState("");

  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(formVacio());
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(null);
  const [trabajadoraActual, setTrabajadoraActual] = useState(null);
  const [codigoInput, setCodigoInput] = useState("");
  const [guardandoCodigo, setGuardandoCodigo] = useState(false);
  const [mensajeCodigo, setMensajeCodigo] = useState(null);
  const [errorCodigo, setErrorCodigo] = useState(null);

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
    setEditandoId(null);
    setTrabajadoraActual(null);
    setForm(formVacio());
    setMensaje(null);
    setError(null);
    setSheetAbierto(true);
  }

  function iniciarEdicion(trabajadora) {
    setEditandoId(trabajadora.id);
    setTrabajadoraActual(trabajadora);
    setMensaje(null);
    setError(null);
    setCodigoInput("");
    setMensajeCodigo(null);
    setErrorCodigo(null);
    setForm({
      nombre: trabajadora.nombre,
      tipo_pago: trabajadora.tipo_pago || "hora",
      valor_hora: trabajadora.valor_hora ?? "",
      salario_mensual: trabajadora.salario_mensual ?? "",
      incluye_nomina: trabajadora.incluye_nomina,
    });
    setSheetAbierto(true);
  }

  function cerrarSheet(abierto) {
    setSheetAbierto(abierto);
    if (!abierto) {
      setEditandoId(null);
      setTrabajadoraActual(null);
      setForm(formVacio());
      setCodigoInput("");
      setMensajeCodigo(null);
      setErrorCodigo(null);
    }
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
        tipo_pago: form.tipo_pago,
        valor_hora: form.tipo_pago === "hora" && form.valor_hora ? Number(form.valor_hora) : null,
        salario_mensual:
          form.tipo_pago === "mensual" && form.salario_mensual ? Number(form.salario_mensual) : null,
        incluye_nomina: form.incluye_nomina,
      };

      if (editandoId) {
        await actualizarTrabajadora(editandoId, payload);
        setMensaje("Trabajadora actualizada");
      } else {
        await crearTrabajadora(payload);
        setMensaje("Trabajadora creada");
      }
      cerrarSheet(false);
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

  async function guardarCodigo() {
    if (!codigoInput || codigoInput.trim().length < 4) {
      setErrorCodigo("El código debe tener al menos 4 dígitos");
      return;
    }
    setGuardandoCodigo(true);
    setErrorCodigo(null);
    try {
      await establecerCodigoTrabajadora(editandoId, codigoInput.trim());
      setMensajeCodigo("Código guardado");
      setCodigoInput("");
      setTrabajadoraActual((t) => ({ ...t, tiene_codigo: true }));
      cargarDatos();
    } catch (err) {
      setErrorCodigo(err.response?.data?.error || "No se pudo guardar el código");
    } finally {
      setGuardandoCodigo(false);
    }
  }

  async function quitarCodigo() {
    setGuardandoCodigo(true);
    setErrorCodigo(null);
    try {
      await eliminarCodigoTrabajadora(editandoId);
      setMensajeCodigo("Código eliminado");
      setTrabajadoraActual((t) => ({ ...t, tiene_codigo: false }));
      cargarDatos();
    } catch (err) {
      setErrorCodigo("No se pudo eliminar el código");
    } finally {
      setGuardandoCodigo(false);
    }
  }

  const trabajadorasFiltradas = trabajadoras.filter((t) =>
    t.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const sinConfigurar = trabajadoras.filter((t) => {
    if (t.tipo_pago === "mensual") return t.salario_mensual == null;
    return t.valor_hora == null;
  }).length;

  return (
    <div className="trabad-container">
      <header className="trabad-header">
        <div>
          <h1>Trabajadoras</h1>
          <p>Equipo y pago para el cálculo de salario</p>
        </div>
        <button className="trabad-btn-nuevo" onClick={iniciarCreacion}>
          <Plus size={16} />
          Nueva
        </button>
      </header>

      {mensaje && <div className="trabad-mensaje-exito">{mensaje}</div>}
      {error && !sheetAbierto && <div className="trabad-mensaje-error">{error}</div>}

      {sinConfigurar > 0 && (
        <div className="trabad-alerta-global">
          <AlertTriangle size={15} />
          {sinConfigurar === 1
            ? "1 trabajadora no tiene su pago configurado"
            : `${sinConfigurar} trabajadoras no tienen su pago configurado`}
        </div>
      )}

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
        {trabajadorasFiltradas.map((t) => {
          const esMensual = t.tipo_pago === "mensual";
          const configurado = esMensual ? t.salario_mensual != null : t.valor_hora != null;

          return (
            <div key={t.id} className="trabad-tarjeta">
              <div className="trabad-fila-principal">
                <div className="trabad-nombre-icono">
                  <div className="trabad-avatar">{iniciales(t.nombre)}</div>
                  <div className="trabad-nombre-info">
                    <span className="trabad-nombre">{t.nombre}</span>
                    <span className="trabad-tipo-badge">
                      {esMensual ? <Wallet size={11} /> : <Clock size={11} />}
                      {esMensual ? "Sueldo fijo" : "Por hora"}
                    </span>
                    {t.tiene_codigo && (
                      <span className="trabad-tipo-badge trabad-badge-codigo">
                        <KeyRound size={11} />
                        Código activo
                      </span>
                    )}
                  </div>
                </div>

                {configurado ? (
                  <span className="trabad-valor-hora">
                    {esMensual ? (
                      <>{formatearMoneda(t.salario_mensual)}/mes</>
                    ) : (
                      <>
                        <DollarSign size={13} />
                        {Number(t.valor_hora).toLocaleString("es-CO")}/h
                      </>
                    )}
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
          );
        })}

        {trabajadoras.length === 0 && (
          <p className="trabad-sin-datos">Todavía no hay trabajadoras registradas</p>
        )}
        {trabajadoras.length > 0 && trabajadorasFiltradas.length === 0 && (
          <p className="trabad-sin-datos">Ninguna trabajadora coincide con "{busqueda}"</p>
        )}
      </div>

      <Sheet
        open={sheetAbierto}
        onOpenChange={cerrarSheet}
        title={editandoId ? "Editar trabajadora" : "Nueva trabajadora"}
      >
        <div className="trabad-form">
          {error && <div className="trabad-mensaje-error">{error}</div>}

          <label>Nombre</label>
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            placeholder="Ej: María Pérez"
          />

          <label>Tipo de pago</label>
          <div className="trabad-tipo-pago">
            <button
              type="button"
              className={`trabad-tipo-btn ${form.tipo_pago === "hora" ? "activo" : ""}`}
              onClick={() => setForm((f) => ({ ...f, tipo_pago: "hora" }))}
            >
              <Clock size={15} />
              Por hora
            </button>
            <button
              type="button"
              className={`trabad-tipo-btn ${form.tipo_pago === "mensual" ? "activo" : ""}`}
              onClick={() => setForm((f) => ({ ...f, tipo_pago: "mensual" }))}
            >
              <Wallet size={15} />
              Sueldo fijo mensual
            </button>
          </div>

          {form.tipo_pago === "hora" ? (
            <>
              <label>Valor por hora</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.valor_hora}
                onChange={(e) => setForm((f) => ({ ...f, valor_hora: e.target.value }))}
                placeholder="Ej: 13000"
              />
            </>
          ) : (
            <>
              <label>Salario mensual</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.salario_mensual}
                onChange={(e) => setForm((f) => ({ ...f, salario_mensual: e.target.value }))}
                placeholder="Ej: 2000000"
              />
              <p className="trabad-nota-prorrateo">
                Para periodos más cortos que un mes (esta semana, quincena) se calcula
                proporcional a los días del rango.
              </p>
            </>
          )}

          <label className="trabad-check-label">
            <input
              type="checkbox"
              checked={form.incluye_nomina}
              onChange={(e) => setForm((f) => ({ ...f, incluye_nomina: e.target.checked }))}
            />
            Incluir en horarios y nómina
          </label>

          <button
            className="trabad-btn-primario trabad-btn-guardar-sheet"
            onClick={guardar}
            disabled={guardando}
          >
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </Sheet>
    </div>
  );
}