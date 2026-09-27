import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search, Tag, AlertTriangle } from "lucide-react";
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
    insumo_id: "",
  };
}

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [categoriasAbiertas, setCategoriasAbiertas] = useState({});
  const [sugerenciasCategoriaAbiertas, setSugerenciasCategoriaAbiertas] = useState(false);

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
      insumo_id: producto.insumo_id || "",
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

  async function guardar() {
    if (!form.nombre.trim() || !form.precio_unitario) {
      setError("Nombre y precio son obligatorios");
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      if (editandoId) {
        await actualizarProducto(editandoId, {
          nombre: form.nombre,
          categoria: form.categoria || null,
          precio_unitario: Number(form.precio_unitario),
          stock_minimo: Number(form.stock_minimo) || 5,
          insumo_id: form.insumo_id ? Number(form.insumo_id) : null,
        });
        setMensaje("Producto actualizado");
      } else {
        await crearProducto({
          nombre: form.nombre,
          categoria: form.categoria || null,
          precio_unitario: Number(form.precio_unitario),
          stock_actual: Number(form.stock_actual) || 0,
          stock_minimo: Number(form.stock_minimo) || 5,
          insumo_id: form.insumo_id ? Number(form.insumo_id) : null,
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
                <span className={stockBajo ? "prodad-stock-bajo" : "prodad-stock"}>
                  {stockBajo && <AlertTriangle size={12} />}
                  Stock: {p.stock_actual}
                </span>
                {p.insumo_nombre && (
                  <span className="prodad-categoria" title="Insumo que se descuenta al vender">
                    <Tag size={11} />
                    Usa: {p.insumo_nombre}
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

          <label>Stock mínimo (alerta de bajo stock)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.stock_minimo}
            onChange={(e) => setForm((f) => ({ ...f, stock_minimo: e.target.value }))}
          />

          {!editandoId && (
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

          {editandoId && (
            <p className="prodad-nota-stock">
              Para cambiar el stock, usa la sección de Inventario.
            </p>
          )}

          <label>Insumo que se descuenta al vender (opcional)</label>
          <select
            value={form.insumo_id}
            onChange={(e) => setForm((f) => ({ ...f, insumo_id: e.target.value }))}
          >
            <option value="">Ninguno</option>
            {insumos.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre} ({i.unidad_medida})
              </option>
            ))}
          </select>
          <p className="prodad-nota-stock">
            Ej: si este producto es "Jugo de mora en leche", elige "Pulpa de mora". Cada
            unidad vendida descuenta 1 unidad de ese insumo automáticamente.
          </p>

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