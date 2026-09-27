import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  listarIngresosEgresos,
  crearIngresoEgreso,
  actualizarIngresoEgreso,
  eliminarIngresoEgreso,
} from "../../../api/ingresosEgresos";
import { listarProveedores } from "../../../api/proveedores";
import Sheet from "../../../components/Sheet";
import "./IngresosEgresos.css";
import CampoMoneda from "../../../components/CampoMoneda";

function formVacio() {
  return { tipo: "egreso", monto: "", descripcion: "", metodo_pago: "", proveedor_id: "" };
}
const METODOS_PAGO = ["Efectivo", "Transferencia"];

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

  const [sheetAbierto, setSheetAbierto] = useState(false);
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
    setEditandoId(null);
    setForm(formVacio());
    setMensaje(null);
    setError(null);
    setSheetAbierto(true);
  }

  function iniciarEdicion(registro) {
    setEditandoId(registro.id);
    setMensaje(null);
    setError(null);
    setForm({
      tipo: registro.tipo,
      monto: registro.monto,
      descripcion: registro.descripcion,
      metodo_pago: registro.metodo_pago || "",
      proveedor_id: registro.proveedor_id || "",
    });
    setSheetAbierto(true);
  }

  function cerrarSheet(abierto) {
    setSheetAbierto(abierto);
    if (!abierto) {
      setEditandoId(null);
      setForm(formVacio());
    }
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
      metodo_pago: form.metodo_pago || null,
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
      cerrarSheet(false);
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
        <button className="ie-btn-nuevo" onClick={iniciarCreacion}>
          <Plus size={16} />
          Nuevo
        </button>
      </div>

      {mensaje && <div className="ie-mensaje-exito">{mensaje}</div>}
      {error && !sheetAbierto && <div className="ie-mensaje-error">{error}</div>}

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
              {r.metodo_pago && (
                <>
                  <span>·</span>
                  <span className="ie-capitalize">{r.metodo_pago}</span>
                </>
              )}
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
                  <Pencil size={13} />
                  Editar
                </button>
                <button
                  className="ie-btn-peligro-outline"
                  onClick={() => setConfirmandoEliminar(r.id)}
                >
                  <Trash2 size={13} />
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

      <Sheet
        open={sheetAbierto}
        onOpenChange={cerrarSheet}
        title={editandoId ? "Editar registro" : "Nuevo registro"}
      >
        <div className="ie-form">
          {error && <div className="ie-mensaje-error">{error}</div>}

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
          <CampoMoneda
            value={form.monto}
            onChange={(valor) => setForm((f) => ({ ...f, monto: valor }))}
          />

          <label>Descripción</label>
          <input
            type="text"
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
            placeholder="Ej: Compra de 1kg de pollo"
          />

          <label>Método de pago (opcional)</label>
          <div className="ie-tipos">
            {METODOS_PAGO.map((metodo) => (
              <button
                key={metodo}
                type="button"
                className={`ie-tipo-btn ${form.metodo_pago === metodo ? "activo-ingreso" : ""}`}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    metodo_pago: f.metodo_pago === metodo ? "" : metodo,
                  }))
                }
              >
                {metodo}
              </button>
            ))}
          </div>

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

          <button className="ie-btn-primario ie-btn-guardar-sheet" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </Sheet>
    </div>
  );
}