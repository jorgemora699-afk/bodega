import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, PackagePlus, AlertTriangle } from "lucide-react";
import {
  listarIngresosEgresos,
  crearIngresoEgreso,
  actualizarIngresoEgreso,
  eliminarIngresoEgreso,
} from "../../../api/ingresosEgresos";
import { listarProveedores } from "../../../api/proveedores";
import { listarProductos } from "../../../api/productos";
import { registrarEntrada as registrarEntradaProducto } from "../../../api/inventario";
import { listarInsumos, registrarEntradaInsumo } from "../../../api/insumos";
import Sheet from "../../../components/Sheet";
import "./IngresosEgresos.css";
import CampoMoneda from "../../../components/CampoMoneda";

function formVacio() {
  return {
    tipo: "egreso",
    monto: "",
    descripcion: "",
    proveedor_id: "",
    metodo_pago: "",
  };
}

function formInventarioVacio() {
  return {
    activo: false,
    tipoItem: "producto", // "producto" o "insumo"
    itemId: "",
    cantidad: "",
  };
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

function etiquetaMetodoPago(valor) {
  if (valor === "efectivo") return "Efectivo";
  if (valor === "transferencia") return "Transferencia";
  return null;
}

export default function IngresosEgresos() {
  const [registros, setRegistros] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState("");

  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(formVacio());
  const [formInventario, setFormInventario] = useState(formInventarioVacio());
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(null);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [avisoInventario, setAvisoInventario] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarProveedores();
    cargarProductos();
    cargarInsumos();
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

  async function cargarProductos() {
    try {
      setProductos(await listarProductos());
    } catch (err) {
      // si falla, el selector de productos simplemente queda vacío
    }
  }

  async function cargarInsumos() {
    try {
      setInsumos(await listarInsumos());
    } catch (err) {
      // si falla, el selector de insumos simplemente queda vacío
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
    setFormInventario(formInventarioVacio());
    setMensaje(null);
    setAvisoInventario(null);
    setError(null);
    setSheetAbierto(true);
  }

  function iniciarEdicion(registro) {
    setEditandoId(registro.id);
    setMensaje(null);
    setAvisoInventario(null);
    setError(null);
    setForm({
      tipo: registro.tipo,
      monto: registro.monto,
      descripcion: registro.descripcion,
      proveedor_id: registro.proveedor_id || "",
      metodo_pago: registro.metodo_pago || "",
    });
    // Al editar nunca se ofrece registrar inventario — evita duplicar
    // una entrada que ya se hizo cuando se creó este egreso.
    setFormInventario(formInventarioVacio());
    setSheetAbierto(true);
  }

  function cerrarSheet(abierto) {
    setSheetAbierto(abierto);
    if (!abierto) {
      setEditandoId(null);
      setForm(formVacio());
      setFormInventario(formInventarioVacio());
    }
  }

  function cambiarTipoRegistro(tipo) {
    setForm((f) => ({ ...f, tipo }));
    if (tipo !== "egreso") {
      setFormInventario(formInventarioVacio());
    }
  }

  function toggleInventario() {
    setFormInventario((f) => ({
      ...formInventarioVacio(),
      activo: !f.activo,
    }));
  }

  function cambiarTipoItem(tipoItem) {
    setFormInventario((f) => ({ ...f, tipoItem, itemId: "" }));
  }

  async function guardar() {
    if (!form.monto || !form.descripcion.trim()) {
      setError("Monto y descripción son obligatorios");
      return;
    }

    if (formInventario.activo) {
      if (!formInventario.itemId) {
        setError(
          formInventario.tipoItem === "producto"
            ? "Selecciona el producto que compraste"
            : "Selecciona el insumo que compraste"
        );
        return;
      }
      if (!formInventario.cantidad || Number(formInventario.cantidad) <= 0) {
        setError("Ingresa una cantidad válida para el inventario");
        return;
      }
    }

    setGuardando(true);
    setError(null);

    const payload = {
      tipo: form.tipo,
      monto: Number(form.monto),
      descripcion: form.descripcion.trim(),
      proveedor_id: form.proveedor_id ? Number(form.proveedor_id) : null,
      metodo_pago: form.metodo_pago || null,
    };

    if (!editandoId && formInventario.activo) {
      payload.registrar_entrada = {
        tipo: formInventario.tipoItem,
        item_id: Number(formInventario.itemId),
        cantidad: Number(formInventario.cantidad),
      };
    }

    try {
      if (editandoId) {
        await actualizarIngresoEgreso(editandoId, payload);
        setMensaje("Registro actualizado");
      } else {
        await crearIngresoEgreso(payload);

        if (payload.registrar_entrada) {
          const nombreItem =
            formInventario.tipoItem === "producto"
              ? productos.find((p) => p.id === Number(formInventario.itemId))?.nombre
              : insumos.find((i) => i.id === Number(formInventario.itemId))?.nombre;

          setMensaje(
            `Egreso registrado y se agregaron ${formInventario.cantidad} ${nombreItem || ""} al inventario`
          );

          if (formInventario.tipoItem === "producto") {
            cargarProductos();
          } else {
            cargarInsumos();
          }
        } else {
          setMensaje(form.tipo === "ingreso" ? "Ingreso registrado" : "Egreso registrado");
        }
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

  const opcionesItem =
    formInventario.tipoItem === "producto"
      ? productos.filter((p) => p.activo)
      : insumos.filter((i) => i.activo);

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
      {avisoInventario && !sheetAbierto && (
        <div className="ie-mensaje-aviso">
          <AlertTriangle size={14} />
          {avisoInventario}
        </div>
      )}
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
        {registros.map((r) => {
          const metodoLabel = etiquetaMetodoPago(r.metodo_pago);

          return (
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
                {metodoLabel && (
                  <>
                    <span>·</span>
                    <span>{metodoLabel}</span>
                  </>
                )}
                {r.tiene_entrada_inventario && (
                  <>
                    <span>·</span>
                    <span>+{r.entrada_cantidad} {r.entrada_item_nombre} al inventario</span>
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
          );
        })}

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
              onClick={() => cambiarTipoRegistro("ingreso")}
            >
              Ingreso
            </button>
            <button
              className={`ie-tipo-btn ${form.tipo === "egreso" ? "activo-egreso" : ""}`}
              onClick={() => cambiarTipoRegistro("egreso")}
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
          <select
            value={form.metodo_pago}
            onChange={(e) => setForm((f) => ({ ...f, metodo_pago: e.target.value }))}
          >
            <option value="">Sin especificar</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
          </select>

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

          {/* ======================================
              REGISTRAR TAMBIÉN LA ENTRADA AL INVENTARIO
              Solo al crear un egreso nuevo
          ====================================== */}

          {!editandoId && form.tipo === "egreso" && (
            <div className="ie-inventario-toggle-row">
              <label className="ie-checkbox">
                <input
                  type="checkbox"
                  checked={formInventario.activo}
                  onChange={toggleInventario}
                />
                <span>
                  <PackagePlus size={14} />
                  También registrar la entrada al inventario
                </span>
              </label>
            </div>
          )}

          {formInventario.activo && (
            <div className="ie-inventario-panel">
              <label>¿Qué compraste?</label>
              <div className="ie-tipos">
                <button
                  type="button"
                  className={`ie-tipo-btn ${
                    formInventario.tipoItem === "producto" ? "activo-ingreso" : ""
                  }`}
                  onClick={() => cambiarTipoItem("producto")}
                >
                  Producto
                </button>
                <button
                  type="button"
                  className={`ie-tipo-btn ${
                    formInventario.tipoItem === "insumo" ? "activo-ingreso" : ""
                  }`}
                  onClick={() => cambiarTipoItem("insumo")}
                >
                  Insumo
                </button>
              </div>

              <label>
                {formInventario.tipoItem === "producto" ? "Producto" : "Insumo"}
              </label>
              <select
                value={formInventario.itemId}
                onChange={(e) =>
                  setFormInventario((f) => ({ ...f, itemId: e.target.value }))
                }
              >
                <option value="">Selecciona...</option>
                {opcionesItem.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                    {formInventario.tipoItem === "insumo"
                      ? ` (${item.unidad_medida})`
                      : ""}
                  </option>
                ))}
              </select>

              <label>Cantidad comprada</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={formInventario.cantidad}
                onChange={(e) =>
                  setFormInventario((f) => ({ ...f, cantidad: e.target.value }))
                }
                placeholder="Ej: 24"
              />

              <p className="ie-inventario-hint">
                Esto sumará la cantidad al stock actual, con motivo "compra".
              </p>
            </div>
          )}

          <button className="ie-btn-primario ie-btn-guardar-sheet" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </Sheet>
    </div>
  );
}