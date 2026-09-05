import { useEffect, useState } from "react";
import {
  listarIngresosEgresos,
  crearIngresoEgreso,
  actualizarIngresoEgreso,
  eliminarIngresoEgreso,
} from "../../../api/ingresosEgresos";
import { listarProveedores } from "../../../api/proveedores";
import "./IngresosEgresos.css";

function formVacio() {
  return { tipo: "egreso", monto: "", descripcion: "", proveedor_id: "" };
}

function formatearFecha(isoString) {
  return new Date(isoString).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatearMoneda(valor) {
  return `$${Number(valor).toLocaleString("es-CO")}`;
}

export default function IngresosEgresos() {
  const [registros, setRegistros] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState("");

  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(formVacio());
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(null);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarProveedores();
  }, []);

  useEffect(() => {
    cargarRegistros();
  }, [filtroTipo]);

  async function cargarProveedores() {
    try {
      setProveedores(await listarProveedores());
    } catch (err) {
      // no bloquea la pantalla si falla, el campo de proveedor solo queda vacío
    }
  }

  async function cargarRegistros() {
    setError(null);
    try {
      const params = filtroTipo ? { tipo: filtroTipo } : {};
      setRegistros(await listarIngresosEgresos(params));
    } catch (err) {
      setError("No se pudieron cargar los registros");
    }
  }

  function iniciarCreacion() {
    setCreando(true);
    setEditandoId(null);
    setForm(formVacio());
    setMensaje(null);
    setError(null);
  }

  function iniciarEdicion(registro) {
    setEditandoId(registro.id);
    setCreando(false);
    setMensaje(null);
    setError(null);
    setForm({
      tipo: registro.tipo,
      monto: registro.monto,
      descripcion: registro.descripcion,
      proveedor_id: registro.proveedor_id || "",
    });
  }

  function cancelar() {
    setCreando(false);
    setEditandoId(null);
    setForm(formVacio());
  }

  async function guardar() {
    if (!form.monto || !form.descripcion.trim()) {
      setError("Monto y descripción son obligatorios");
      return;
    }

    setGuardando(true);
    setError(null);

    const payload = {
      tipo: form.tipo,
      monto: Number(form.monto),
      descripcion: form.descripcion.trim(),
      proveedor_id: form.proveedor_id ? Number(form.proveedor_id) : null,
    };

    try {
      if (editandoId) {
        await actualizarIngresoEgreso(editandoId, payload);
        setMensaje("Registro actualizado");
      } else {
        await crearIngresoEgreso(payload);
        setMensaje(form.tipo === "ingreso" ? "Ingreso registrado" : "Egreso registrado");
      }
      cancelar();
      cargarRegistros();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar el registro");
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminar(registroId) {
    setGuardando(true);
    setError(null);
    try {
      await eliminarIngresoEgreso(registroId);
      setMensaje("Registro eliminado");
      setConfirmandoEliminar(null);
      cargarRegistros();
    } catch (err) {
      setError("No se pudo eliminar el registro");
    } finally {
      setGuardando(false);
    }
  }

  const formularioAbierto = creando || editandoId !== null;

  const totalIngresos = registros
    .filter((r) => r.tipo === "ingreso")
    .reduce((sum, r) => sum + Number(r.monto), 0);
  const totalEgresos = registros
    .filter((r) => r.tipo === "egreso")
    .reduce((sum, r) => sum + Number(r.monto), 0);

  return (
    <div className="ie-container">
      <div className="ie-header">
        <h1>Ingresos / Egresos</h1>
        {!formularioAbierto && (
          <button className="ie-btn-nuevo" onClick={iniciarCreacion}>
            + Nuevo
          </button>
        )}
      </div>

      {mensaje && <div className="ie-mensaje-exito">{mensaje}</div>}
      {error && <div className="ie-mensaje-error">{error}</div>}

      {formularioAbierto && (
        <div className="ie-form">
          <label>Tipo</label>
          <div className="ie-tipos">
            <button
              className={`ie-tipo-btn ${form.tipo === "ingreso" ? "activo-ingreso" : ""}`}
              onClick={() => setForm((f) => ({ ...f, tipo: "ingreso" }))}
            >
              Ingreso
            </button>
            <button
              className={`ie-tipo-btn ${form.tipo === "egreso" ? "activo-egreso" : ""}`}
              onClick={() => setForm((f) => ({ ...f, tipo: "egreso" }))}
            >
              Egreso
            </button>
          </div>

          <label>Monto</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.monto}
            onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
          />

          <label>Descripción</label>
          <input
            type="text"
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
            placeholder="Ej: Compra de 1kg de pollo"
          />

          {form.tipo === "egreso" && (
            <>
              <label>Proveedor (opcional)</label>
              <select
                value={form.proveedor_id}
                onChange={(e) => setForm((f) => ({ ...f, proveedor_id: e.target.value }))}
              >
                <option value="">Sin proveedor</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} — {p.celular}
                  </option>
                ))}
              </select>
            </>
          )}

          <div className="ie-botones">
            <button className="ie-btn-secundario" onClick={cancelar} disabled={guardando}>
              Cancelar
            </button>
            <button className="ie-btn-primario" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {!formularioAbierto && (
        <>
          <div className="ie-filtros">
            {[
              { valor: "", label: "Todos" },
              { valor: "ingreso", label: "Ingresos" },
              { valor: "egreso", label: "Egresos" },
            ].map((f) => (
              <button
                key={f.valor}
                className={`ie-filtro-btn ${filtroTipo === f.valor ? "activo" : ""}`}
                onClick={() => setFiltroTipo(f.valor)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="ie-resumen">
            <div className="ie-resumen-item">
              <span>Ingresos</span>
              <span className="ie-resumen-valor positivo">{formatearMoneda(totalIngresos)}</span>
            </div>
            <div className="ie-resumen-item">
              <span>Egresos</span>
              <span className="ie-resumen-valor negativo">{formatearMoneda(totalEgresos)}</span>
            </div>
          </div>

          <div className="ie-lista">
            {registros.map((r) => (
              <div key={r.id} className="ie-tarjeta">
                <div className="ie-fila-principal">
                  <div>
                    <span className={`ie-badge-tipo ${r.tipo}`}>
                      {r.tipo === "ingreso" ? "Ingreso" : "Egreso"}
                    </span>
                    <span className="ie-descripcion">{r.descripcion}</span>
                  </div>
                  <span className={`ie-monto ${r.tipo === "ingreso" ? "positivo" : "negativo"}`}>
                    {r.tipo === "ingreso" ? "+" : "-"}
                    {formatearMoneda(r.monto)}
                  </span>
                </div>

                <div className="ie-detalle">
                  <span>{formatearFecha(r.fecha)}</span>
                  {r.proveedor_nombre && (
                    <>
                      <span>·</span>
                      <span>{r.proveedor_nombre}</span>
                    </>
                  )}
                </div>

                {confirmandoEliminar === r.id ? (
                  <div className="ie-confirmar">
                    <span>¿Eliminar este registro?</span>
                    <div className="ie-botones">
                      <button
                        className="ie-btn-secundario"
                        onClick={() => setConfirmandoEliminar(null)}
                        disabled={guardando}
                      >
                        No
                      </button>
                      <button
                        className="ie-btn-peligro"
                        onClick={() => confirmarEliminar(r.id)}
                        disabled={guardando}
                      >
                        Sí, eliminar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ie-acciones">
                    <button className="ie-btn-secundario" onClick={() => iniciarEdicion(r)}>
                      Editar
                    </button>
                    <button
                      className="ie-btn-peligro-outline"
                      onClick={() => setConfirmandoEliminar(r.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            ))}

            {registros.length === 0 && (
              <p className="ie-sin-datos">No hay registros para este filtro</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}