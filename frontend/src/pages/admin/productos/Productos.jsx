import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search, Tag, AlertTriangle, X, Shuffle } from "lucide-react";
import {
  listarProductos,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
} from "../../../api/productos";
import { listarInsumos } from "../../../api/insumos";
import Sheet from "../../../components/Sheet";
import "./Productos.css";
import CampoMoneda from "../../../components/CampoMoneda";


function formVacio() {
  return {
    nombre: "",
    categoria: "",
    precio_unitario: "",
    stock_actual: "",
    stock_minimo: "5",
    insumos: [],
    requiere_seleccion: false,
    categoria_seleccion: "",
    cantidad_seleccion: "2",
    cantidad_por_seleccion: "1",
    producto_base_id: "", // NUEVO
    unidades_por_paquete: "1", // NUEVO
  };
}

function filaInsumoVacia() {
  return { insumo_id: "", cantidad: "1" };
}

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [categoriasAbiertas, setCategoriasAbiertas] = useState({});
  const [sugerenciasCategoriaAbiertas, setSugerenciasCategoriaAbiertas] = useState(false);
  const [sugerenciasCategoriaSeleccionAbiertas, setSugerenciasCategoriaSeleccionAbiertas] = useState(false);

  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(formVacio());
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(null);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarDatos();
    cargarInsumos();
  }, []);

  async function cargarDatos() {
    setError(null);

    try {
      const datos = await listarProductos();

      setProductos(datos);

      const categoriasIniciales = [
        ...new Set(
          datos
            .map((p) => p.categoria)
            .filter(Boolean)
        ),
      ].sort();

      if (categoriasIniciales.length > 0) {
        setCategoriasAbiertas((prev) => ({
          ...prev,
          [categoriasIniciales[0]]: true,
        }));
      }
    } catch (err) {
      setError("No se pudieron cargar los productos");
    }
  }

  async function cargarInsumos() {
    try {
      const datos = await listarInsumos();
      setInsumos(datos);
    } catch (err) {
      // Si falla, simplemente no se muestra el selector de insumo con datos —
      // no bloqueamos el resto de la pantalla de productos por esto.
      setInsumos([]);
    }
  }

  function toggleCategoria(categoria) {
    setCategoriasAbiertas((prev) => ({
      ...prev,
      [categoria]: prev[categoria] === undefined
        ? false
        : !prev[categoria],
    }));
  }

  function iniciarCreacion() {
    setEditandoId(null);
    setForm(formVacio());
    setMensaje(null);
    setError(null);
    setSheetAbierto(true);
  }

  function iniciarEdicion(producto) {
    setEditandoId(producto.id);
    setMensaje(null);
    setError(null);
    setForm({
      nombre: producto.nombre,
      categoria: producto.categoria || "",
      precio_unitario: producto.precio_unitario,
      stock_minimo: producto.stock_minimo ?? "5",
      producto_base_id: producto.producto_base_id ? String(producto.producto_base_id) : "",
      unidades_por_paquete: producto.unidades_por_paquete ? String(producto.unidades_por_paquete) : "1",
      insumos:
        producto.insumos && producto.insumos.length > 0
          ? producto.insumos.map((i) => ({
              insumo_id: String(i.insumo_id),
              cantidad: String(i.cantidad),
            }))
          : [],
      requiere_seleccion: Boolean(producto.requiere_seleccion),
      categoria_seleccion: producto.categoria_seleccion || "",
      cantidad_seleccion: producto.cantidad_seleccion
        ? String(producto.cantidad_seleccion)
        : "2",
      cantidad_por_seleccion: producto.cantidad_por_seleccion // NUEVO
        ? String(producto.cantidad_por_seleccion)
        : "1",
      // stock_actual no se edita aquí — los cambios de stock pasan por Inventario
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

  /* ---------- Insumos del producto (fila por fila) ---------- */

  function agregarFilaInsumo() {
    setForm((f) => ({ ...f, insumos: [...f.insumos, filaInsumoVacia()] }));
  }

  function actualizarFilaInsumo(index, campo, valor) {
    setForm((f) => ({
      ...f,
      insumos: f.insumos.map((ins, i) => (i === index ? { ...ins, [campo]: valor } : ins)),
    }));
  }

  function quitarFilaInsumo(index) {
    setForm((f) => ({ ...f, insumos: f.insumos.filter((_, i) => i !== index) }));
  }

  /* ---------- Paquete "mixto" (ej. Paquete de empanadas mixta) ---------- */

  function alternarRequiereSeleccion() {
    setForm((f) => ({
      ...f,
      requiere_seleccion: !f.requiere_seleccion,
      // No tiene sentido combinar "paquete mixto" con insumos propios;
      // al activarlo se limpian los insumos que hubiera cargados.
      insumos: !f.requiere_seleccion ? [] : f.insumos,
    }));
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.precio_unitario) {
      setError("Nombre y precio son obligatorios");
      return;
    }

    if (form.requiere_seleccion) {
      if (!form.categoria_seleccion.trim()) {
        setError("Indica de qué categoría se eligen los sabores");
        return;
      }
      if (!form.cantidad_seleccion || Number(form.cantidad_seleccion) < 2) {
        setError("La cantidad a elegir debe ser al menos 2");
        return;
      }
      if (!form.cantidad_por_seleccion || Number(form.cantidad_por_seleccion) < 1) { // NUEVO
        setError("Las unidades de cada sabor deben ser al menos 1");
        return;
      }
    }

    const insumosValidos = form.insumos
      .filter((i) => i.insumo_id && i.cantidad)
      .map((i) => ({
        insumo_id: Number(i.insumo_id),
        cantidad: Number(i.cantidad),
      }));

    const payloadSeleccion = {
      requiere_seleccion: form.requiere_seleccion,
      ...(form.requiere_seleccion
        ? {
            categoria_seleccion: form.categoria_seleccion.trim(),
            cantidad_seleccion: Number(form.cantidad_seleccion),
            cantidad_por_seleccion: Number(form.cantidad_por_seleccion),
          }
        : {}),
    };

    setGuardando(true);
    setError(null);

    try {
      if (editandoId) {
        await actualizarProducto(editandoId, {
          nombre: form.nombre,
          categoria: form.categoria || null,
          precio_unitario: Number(form.precio_unitario),
          stock_minimo: Number(form.stock_minimo) || 5,
          producto_base_id: form.producto_base_id ? Number(form.producto_base_id) : null,
          unidades_por_paquete: form.producto_base_id ? Number(form.unidades_por_paquete) || 1 : null,
          insumos: insumosValidos,
          ...payloadSeleccion,
        });
        setMensaje("Producto actualizado");
      } else {
        await crearProducto({
          nombre: form.nombre,
          categoria: form.categoria || null,
          precio_unitario: Number(form.precio_unitario),
          stock_actual: Number(form.stock_actual) || 0,
          stock_minimo: Number(form.stock_minimo) || 5,
          producto_base_id: form.producto_base_id ? Number(form.producto_base_id) : null,
          unidades_por_paquete: form.producto_base_id ? Number(form.unidades_por_paquete) || 1 : null,
          insumos: insumosValidos,
          ...payloadSeleccion,
        });
        setMensaje("Producto creado");
      }
      cerrarSheet(false);
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar el producto");
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminar(productoId) {
    setGuardando(true);
    setError(null);
    try {
      await eliminarProducto(productoId);
      setMensaje("Producto desactivado");
      setConfirmandoEliminar(null);
      cargarDatos();
    } catch (err) {
      setError("No se pudo desactivar el producto");
    } finally {
      setGuardando(false);
    }
  }

  const categorias = [...new Set(productos.map((p) => p.categoria).filter(Boolean))].sort();

  const productosFiltrados = productos.filter((p) => {
    const coincideBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const coincideCategoria = !categoriaFiltro || p.categoria === categoriaFiltro;
    return coincideBusqueda && coincideCategoria;
  });

  // Insumos ya elegidos en otra fila, para no repetir el mismo insumo dos veces
  // en el mismo producto (evita que "cantidad" quede ambigua entre dos filas).
  function insumosDisponiblesPara(indexActual) {
    const elegidosEnOtrasFilas = new Set(
      form.insumos
        .filter((_, i) => i !== indexActual)
        .map((i) => i.insumo_id)
        .filter(Boolean)
    );
    return insumos.filter((i) => !elegidosEnOtrasFilas.has(String(i.id)));
  }

  return (
    <div className="prodad-container">
      <header className="prodad-header">
        <div>
          <h1>Productos</h1>
          <p>Catálogo, precios y categorías</p>
        </div>
        <button className="prodad-btn-nuevo" onClick={iniciarCreacion}>
          <Plus size={16} />
          Nuevo
        </button>
      </header>

      {mensaje && <div className="prodad-mensaje-exito">{mensaje}</div>}
      {error && !sheetAbierto && <div className="prodad-mensaje-error">{error}</div>}

      {productos.length > 0 && (
        <>
          <div className="prodad-buscador">
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          {categorias.length > 0 && (
            <div className="prodad-filtros-categoria">
              <button
                className={`prodad-chip ${categoriaFiltro === "" ? "activo" : ""}`}
                onClick={() => setCategoriaFiltro("")}
              >
                Todas
              </button>
              {categorias.map((c) => (
                <button
                  key={c}
                  className={`prodad-chip ${categoriaFiltro === c ? "activo" : ""}`}
                  onClick={() => setCategoriaFiltro(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <div className="prodad-lista">
        {productosFiltrados.map((p) => {
          const stockBajo = Number(p.stock_actual) <= Number(p.stock_minimo);
          return (
            <div key={p.id} className="prodad-tarjeta">
              <div className="prodad-fila-principal">
                <div className="prodad-info">
                  <span className="prodad-nombre">{p.nombre}</span>
                  {p.categoria && (
                    <span className="prodad-categoria">
                      <Tag size={11} />
                      {p.categoria}
                    </span>
                  )}
                </div>
                <span className="prodad-precio">
                  ${Number(p.precio_unitario).toLocaleString("es-CO")}
                </span>
              </div>

              <div className="prodad-stock-fila">
                {p.producto_base_id ? (
                  <span className="prodad-categoria" title="Comparte stock con otro producto">
                    <Tag size={11} />
                    {p.unidades_por_paquete > 1
                      ? `x${p.unidades_por_paquete} de ${p.producto_base_nombre}`
                      : `Mismo stock que: ${p.producto_base_nombre}`}{" "}
                    ({p.stock_actual})
                  </span>
                ) : p.requiere_seleccion ? (
                  <span className="prodad-categoria" title="La trabajadora elige los sabores al vender">
                    <Shuffle size={11} />
                    x{p.cantidad_por_seleccion * p.cantidad_seleccion} · Elige {p.cantidad_seleccion} de "{p.categoria_seleccion}" ({p.cantidad_por_seleccion} c/u)
                  </span>
                ) : (
                  <span className={stockBajo ? "prodad-stock-bajo" : "prodad-stock"}>
                    {stockBajo && <AlertTriangle size={12} />}
                    Stock: {p.stock_actual}
                  </span>
                )}
                {p.insumos && p.insumos.length > 0 && (
                  <span
                    className="prodad-categoria"
                    title="Insumos que se descuentan al vender"
                  >
                    <Tag size={11} />
                    Usa: {p.insumos.map((i) => i.insumo_nombre).join(", ")}
                  </span>
                )}
              </div>

              {confirmandoEliminar === p.id ? (
                <div className="prodad-confirmar">
                  <span>¿Desactivar este producto?</span>
                  <div className="prodad-botones">
                    <button
                      className="prodad-btn-secundario"
                      onClick={() => setConfirmandoEliminar(null)}
                      disabled={guardando}
                    >
                      No
                    </button>
                    <button
                      className="prodad-btn-peligro"
                      onClick={() => confirmarEliminar(p.id)}
                      disabled={guardando}
                    >
                      Sí, desactivar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="prodad-acciones">
                  <button className="prodad-btn-secundario" onClick={() => iniciarEdicion(p)}>
                    <Pencil size={13} />
                    Editar
                  </button>
                  <button
                    className="prodad-btn-peligro-outline"
                    onClick={() => setConfirmandoEliminar(p.id)}
                  >
                    <Trash2 size={13} />
                    Desactivar
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {productos.length === 0 && (
          <p className="prodad-sin-datos">Todavía no hay productos registrados</p>
        )}
        {productos.length > 0 && productosFiltrados.length === 0 && (
          <p className="prodad-sin-datos">Ningún producto coincide con el filtro</p>
        )}
      </div>

      <Sheet
        open={sheetAbierto}
        onOpenChange={cerrarSheet}
        title={editandoId ? "Editar producto" : "Nuevo producto"}
      >
        <div className="prodad-form">
          {error && <div className="prodad-mensaje-error">{error}</div>}

          <label>Nombre</label>
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            placeholder="Ej: Empanada de pollo"
          />

          <label>Categoría (opcional)</label>
          <div className="prodad-categoria-combo">
            <input
              type="text"
              value={form.categoria}
              onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
              onFocus={() => setSugerenciasCategoriaAbiertas(true)}
              onBlur={() => setTimeout(() => setSugerenciasCategoriaAbiertas(false), 150)}
              placeholder="Ej: congelados"
              autoComplete="off"
            />

            {sugerenciasCategoriaAbiertas && categorias.length > 0 && (
              <div className="prodad-categoria-sugerencias">
                {categorias
                  .filter((c) => c.toLowerCase().includes(form.categoria.toLowerCase()))
                  .map((c) => (
                    <button
                      type="button"
                      key={c}
                      className="prodad-categoria-sugerencia"
                      onMouseDown={(e) => e.preventDefault()} // evita que el blur cierre antes del click
                      onClick={() => {
                        setForm((f) => ({ ...f, categoria: c }));
                        setSugerenciasCategoriaAbiertas(false);
                      }}
                    >
                      {c}
                    </button>
                  ))}

                {categorias.filter((c) => c.toLowerCase().includes(form.categoria.toLowerCase())).length === 0 && (
                  <p className="prodad-categoria-sin-coincidencia">
                    Se creará "{form.categoria}" como nueva categoría
                  </p>
                )}
              </div>
            )}
          </div>

          <label>Precio unitario</label>
          <CampoMoneda
            value={form.precio_unitario}
            onChange={(valor) => setForm((f) => ({ ...f, precio_unitario: valor }))}
          />

          <label>Vincular con otro producto (misma unidad física, opcional)</label>
          <select
            value={form.producto_base_id}
            onChange={(e) => setForm((f) => ({ ...f, producto_base_id: e.target.value }))}
          >
            <option value="">No, tiene su propio stock</option>
            {productos
              .filter((p) => p.id !== editandoId && !p.producto_base_id) // no vincular a algo que ya está vinculado
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
          </select>

          {form.producto_base_id && (
            <>
              <div className="prodad-info-box">
                <Tag size={14} />
                <p>
                  Este producto descuenta del stock de{" "}
                  <strong>{productos.find((p) => p.id === Number(form.producto_base_id))?.nombre}</strong>.
                  Deja 1 si es la misma unidad con otro precio (ej. congelada). Pon un
                  número mayor si es un paquete de varias unidades (ej. 12 para "Paquete x12").
                </p>
              </div>

              <label>Unidades que descuenta cada venta</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.unidades_por_paquete}
                onChange={(e) => setForm((f) => ({ ...f, unidades_por_paquete: e.target.value }))}
              />

              {Number(form.unidades_por_paquete) > 1 && (
                <div className="prodad-seleccion-total">
                  Vender 1 unidad de este producto descuenta{" "}
                  <strong>{form.unidades_por_paquete} unidades</strong> de{" "}
                  {productos.find((p) => p.id === Number(form.producto_base_id))?.nombre}
                </div>
              )}
            </>
          )}

          {!form.requiere_seleccion && !form.producto_base_id && (
            <>
              <label>Stock mínimo (alerta de bajo stock)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.stock_minimo}
                onChange={(e) => setForm((f) => ({ ...f, stock_minimo: e.target.value }))}
              />
            </>
          )}

          {!editandoId && form.insumos.length === 0 && !form.requiere_seleccion && !form.producto_base_id && (
            <>
              <label>Stock inicial</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.stock_actual}
                onChange={(e) => setForm((f) => ({ ...f, stock_actual: e.target.value }))}
              />
            </>
          )}

          {editandoId && !form.requiere_seleccion && !form.producto_base_id && (
            <p className="prodad-nota-stock">
              Para cambiar el stock, usa la sección de Inventario.
            </p>
          )}

          {/* ---------- Paquete "mixto" (ej. Paquete de empanadas mixta) ---------- */}

          <div className="prodad-seleccion-toggle-fila">
            <label className="prodad-seleccion-toggle-label">
              <input
                type="checkbox"
                checked={form.requiere_seleccion}
                onChange={alternarRequiereSeleccion}
              />
              Es un paquete mixto (se eligen sabores al vender)
            </label>
          </div>

          {form.requiere_seleccion && (
            <div className="prodad-seleccion-config">
              <div className="prodad-info-box">
                <Shuffle size={14} />
              </div>

              <label>Categoría de la que se eligen los sabores</label>
              <div className="prodad-categoria-combo">
                <input
                  type="text"
                  value={form.categoria_seleccion}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, categoria_seleccion: e.target.value }))
                  }
                  onFocus={() => setSugerenciasCategoriaSeleccionAbiertas(true)}
                  onBlur={() =>
                    setTimeout(() => setSugerenciasCategoriaSeleccionAbiertas(false), 150)
                  }
                  placeholder="Ej: empanadas"
                  autoComplete="off"
                />

                {sugerenciasCategoriaSeleccionAbiertas && categorias.length > 0 && (
                  <div className="prodad-categoria-sugerencias">
                    {categorias
                      .filter((c) =>
                        c.toLowerCase().includes(form.categoria_seleccion.toLowerCase())
                      )
                      .map((c) => (
                        <button
                          type="button"
                          key={c}
                          className="prodad-categoria-sugerencia"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setForm((f) => ({ ...f, categoria_seleccion: c }));
                            setSugerenciasCategoriaSeleccionAbiertas(false);
                          }}
                        >
                          {c}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="prodad-seleccion-cantidades">
                <div className="prodad-seleccion-campo">
                  <label>Sabores a elegir</label>
                  <input
                    type="number"
                    min="2"
                    step="1"
                    value={form.cantidad_seleccion}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cantidad_seleccion: e.target.value }))
                    }
                  />
                </div>

                <div className="prodad-seleccion-campo">
                  <label>Unidades por sabor</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.cantidad_por_seleccion}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cantidad_por_seleccion: e.target.value }))
                    }
                  />
                </div>
              </div>

              {Number(form.cantidad_seleccion) > 0 && Number(form.cantidad_por_seleccion) > 0 && (
                <div className="prodad-seleccion-total">
                  Total del paquete:{" "}
                  <strong>
                    {Number(form.cantidad_seleccion) * Number(form.cantidad_por_seleccion)} unidades
                  </strong>{" "}
                  ({form.cantidad_seleccion} sabores × {form.cantidad_por_seleccion} c/u)
                </div>
              )}
            </div>
          )}

          {!form.requiere_seleccion && !form.producto_base_id && (
            <>
              <label>Insumos que se descuentan al vender (opcional)</label>
              <p className="prodad-nota-stock" style={{ marginTop: 0 }}>
                Ej: una hamburguesa puede usar 1 pan + 1 carne + 1 queso. Cada venta
                descuenta esa cantidad de cada insumo automáticamente.
              </p>

              <div className="prodad-insumos-lista">
                {form.insumos.map((ins, index) => (
                  <div key={index} className="prodad-insumo-fila">
                    <select
                      value={ins.insumo_id}
                      onChange={(e) => actualizarFilaInsumo(index, "insumo_id", e.target.value)}
                    >
                      <option value="">Selecciona un insumo...</option>
                      {insumosDisponiblesPara(index).map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nombre} ({i.unidad_medida})
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="prodad-insumo-cantidad"
                      placeholder="Cant."
                      value={ins.cantidad}
                      onChange={(e) => actualizarFilaInsumo(index, "cantidad", e.target.value)}
                    />

                    <button
                      type="button"
                      className="prodad-insumo-quitar"
                      onClick={() => quitarFilaInsumo(index)}
                      aria-label="Quitar insumo"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button type="button" className="prodad-btn-agregar-insumo" onClick={agregarFilaInsumo}>
                <Plus size={14} />
                Agregar insumo
              </button>
            </>
          )}

          <button
            className="prodad-btn-primario prodad-btn-guardar-sheet"
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