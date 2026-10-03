import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, PackagePlus, X } from "lucide-react";
import {
  listarIngresosEgresos,
  crearIngresoEgreso,
  actualizarIngresoEgreso,
  eliminarIngresoEgreso,
} from "../../../api/ingresosEgresos";
import { listarProveedores } from "../../../api/proveedores";
import { listarProductos } from "../../../api/productos";
import { listarInsumos } from "../../../api/insumos";
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

function filaVacia() {
  return { tipoItem: "producto", itemId: "", cantidad: "" };
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

function etiquetaEntrada(e) {
  const unidad = e.unidad_medida ? ` ${e.unidad_medida}` : "";
  return `+${e.cantidad}${unidad} ${e.item_nombre || ""}`;
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

  // Entradas de inventario: las que ya existían (solo al editar, cada una
  // se puede marcar para eliminar) y las que se están agregando ahora
  // (tanto al crear como al editar).
  const [entradasExistentes, setEntradasExistentes] = useState([]);
  const [idsAEliminar, setIdsAEliminar] = useState([]);
  const [filasNuevas, setFilasNuevas] = useState([]);

  const [confirmandoEliminar, setConfirmandoEliminar] = useState(null);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
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
      // no bloquea la pantalla si falla
    }
  }

  async function cargarProductos() {
    try {
      setProductos(await listarProductos());
    } catch (err) {
      // no bloquea la pantalla si falla
    }
  }

  async function cargarInsumos() {
    try {
      setInsumos(await listarInsumos());
    } catch (err) {
      // no bloquea la pantalla si falla
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
    setEntradasExistentes([]);
    setIdsAEliminar([]);
    setFilasNuevas([]);
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
      proveedor_id: registro.proveedor_id || "",
      metodo_pago: registro.metodo_pago || "",
    });
    setEntradasExistentes(registro.entradas_inventario || []);
    setIdsAEliminar([]);
    setFilasNuevas([]);
    setSheetAbierto(true);
  }

  function cerrarSheet(abierto) {
    setSheetAbierto(abierto);
    if (!abierto) {
      setEditandoId(null);
      setForm(formVacio());
      setEntradasExistentes([]);
      setIdsAEliminar([]);
      setFilasNuevas([]);
    }
  }

  function marcarEntradaExistenteParaEliminar(detalleId) {
    setIdsAEliminar((prev) =>
      prev.includes(detalleId) ? prev.filter((id) => id !== detalleId) : [...prev, detalleId]
    );
  }

  function agregarFila() {
    setFilasNuevas((f) => [...f, filaVacia()]);
  }

  function quitarFila(index) {
    setFilasNuevas((f) => f.filter((_, i) => i !== index));
  }

  function cambiarFila(index, campo, valor) {
    setFilasNuevas((f) =>
      f.map((fila, i) => {
        if (i !== index) return fila;
        if (campo === "tipoItem") {
          return { ...fila, tipoItem: valor, itemId: "" };
        }
        return { ...fila, [campo]: valor };
      })
    );
  }

  function unidadDeFila(fila) {
    if (fila.tipoItem !== "insumo" || !fila.itemId) return null;
    return insumos.find((i) => i.id === Number(fila.itemId))?.unidad_medida || null;
  }

  async function guardar() {
    if (!form.monto || !form.descripcion.trim()) {
      setError("Monto y descripción son obligatorios");
      return;
    }

    for (const fila of filasNuevas) {
      if (!fila.itemId) {
        setError(
          fila.tipoItem === "producto"
            ? "Selecciona un producto en cada entrada que agregaste"
            : "Selecciona un insumo en cada entrada que agregaste"
        );
        return;
      }
      if (!fila.cantidad || Number(fila.cantidad) <= 0) {
        setError("Ingresa una cantidad válida en cada entrada que agregaste");
        return;
      }
    }

    setGuardando(true);
    setError(null);

    const entradasFormateadas = filasNuevas.map((f) => ({
      tipo: f.tipoItem,
      item_id: Number(f.itemId),
      cantidad: Number(f.cantidad),
    }));

    const payload = {
      tipo: form.tipo,
      monto: Number(form.monto),
      descripcion: form.descripcion.trim(),
      proveedor_id: form.proveedor_id ? Number(form.proveedor_id) : null,
      metodo_pago: form.metodo_pago || null,
    };

    try {
      if (editandoId) {
        payload.eliminar_detalle_ids = idsAEliminar;
        payload.nuevas_entradas = entradasFormateadas;
        await actualizarIngresoEgreso(editandoId, payload);
        setMensaje("Registro actualizado");
      } else {
        payload.registrar_entradas = entradasFormateadas;
        await crearIngresoEgreso(payload);
        setMensaje(
          entradasFormateadas.length > 0
            ? "Egreso registrado y se actualizó el inventario"
            : form.tipo === "ingreso"
            ? "Ingreso registrado"
            : "Egreso registrado"
        );
      }

      if (entradasFormateadas.length > 0 || idsAEliminar.length > 0) {
        cargarProductos();
        cargarInsumos();
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
      cargarProductos();
      cargarInsumos();
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
        {registros.map((r) => {
          const metodoLabel = etiquetaMetodoPago(r.metodo_pago);
          const entradas = r.entradas_inventario || [];

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
                {r.proveedor_nombre && (
                  <>
                    <span>·</span>
                    <span>{r.proveedor_nombre}</span>
                  </>
                )}
              </div>

              {entradas.length > 0 && (
                <div className="ie-entradas-resumen">
                  {entradas.map((e, i) => (
                    <span key={e.id ?? i} className="ie-entrada-chip">
                      {etiquetaEntrada(e)}
                    </span>
                  ))}
                </div>
              )}

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
            placeholder="Ej: Factura de insumos y gaseosas"
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
              ENTRADAS DE INVENTARIO
          ====================================== */}

          {form.tipo === "egreso" && (
            <div className="ie-inventario-seccion">
              <label>
                <PackagePlus size={14} />
                {" "}Entradas al inventario (opcional)
              </label>

              {entradasExistentes.length > 0 && (
                <div className="ie-entradas-existentes">
                  {entradasExistentes.map((e) => {
                    const marcada = idsAEliminar.includes(e.id);
                    return (
                      <div
                        key={e.id}
                        className={`ie-entrada-existente ${marcada ? "para-eliminar" : ""}`}
                      >
                        <span>{etiquetaEntrada(e)}</span>
                        <button
                          type="button"
                          onClick={() => marcarEntradaExistenteParaEliminar(e.id)}
                        >
                          {marcada ? "Deshacer" : "Quitar"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {filasNuevas.map((fila, index) => {
                const unidad = unidadDeFila(fila);
                const opciones = fila.tipoItem === "producto" ? productos : insumos;

                return (
                  <div key={index} className="ie-fila-entrada">
                    <div className="ie-fila-entrada-header">
                      <div className="ie-tipos ie-tipos-chico">
                        <button
                          type="button"
                          className={`ie-tipo-btn ${
                            fila.tipoItem === "producto" ? "activo-ingreso" : ""
                          }`}
                          onClick={() => cambiarFila(index, "tipoItem", "producto")}
                        >
                          Producto
                        </button>
                        <button
                          type="button"
                          className={`ie-tipo-btn ${
                            fila.tipoItem === "insumo" ? "activo-ingreso" : ""
                          }`}
                          onClick={() => cambiarFila(index, "tipoItem", "insumo")}
                        >
                          Insumo
                        </button>
                      </div>

                      <button
                        type="button"
                        className="ie-fila-entrada-quitar"
                        aria-label="Quitar esta entrada"
                        onClick={() => quitarFila(index)}
                      >
                        <X size={15} />
                      </button>
                    </div>

                    <select
                      value={fila.itemId}
                      onChange={(e) => cambiarFila(index, "itemId", e.target.value)}
                    >
                      <option value="">
                        {fila.tipoItem === "producto" ? "Selecciona un producto..." : "Selecciona un insumo..."}
                      </option>
                      {opciones
                        .filter((item) => item.activo)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.nombre}
                            {fila.tipoItem === "insumo" ? ` (${item.unidad_medida})` : ""}
                          </option>
                        ))}
                    </select>

                    <div className="ie-fila-entrada-cantidad">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={fila.cantidad}
                        onChange={(e) => cambiarFila(index, "cantidad", e.target.value)}
                        placeholder="Cantidad"
                      />
                      {unidad && <span className="ie-fila-entrada-unidad">{unidad}</span>}
                    </div>
                  </div>
                );
              })}

              <button type="button" className="ie-agregar-entrada-btn" onClick={agregarFila}>
                <Plus size={14} />
                Agregar {filasNuevas.length > 0 || entradasExistentes.length > 0 ? "otro" : "un"} producto o insumo
              </button>

              <p className="ie-inventario-hint">
                Cada entrada suma esa cantidad al stock actual, con motivo "compra".
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