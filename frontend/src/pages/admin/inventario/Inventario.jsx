import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Plus,
  Phone,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Search,
  MoreVertical,
  History,
  X,
} from "lucide-react";

import { listarProductos } from "../../../api/productos";
import { listarTrabajadoras } from "../../../api/trabajadoras";
import { listarProveedoresDeProducto } from "../../../api/proveedores";

import {
  registrarEntrada,
  registrarSalida,
  listarBajoStock,
  listarMovimientos,
} from "../../../api/inventario";

import Sheet from "../../../components/Sheet";
import "./Inventario.css";

const MOTIVOS_ENTRADA = [
  { valor: "produccion", label: "Producción" },
  { valor: "compra", label: "Compra" },
  { valor: "ajuste", label: "Ajuste de conteo" },
];

const MOTIVOS_SALIDA = [
  { valor: "merma", label: "Merma / dañado" },
  { valor: "ajuste", label: "Ajuste de conteo" },
];

function formVacio() {
  return {
    tipo: "entrada",
    producto_id: "",
    cantidad: "",
    motivo: "produccion",
    trabajadora_id: "",
  };
}

function formatearFecha(isoString) {
  if (!isoString) return "";

  return new Date(isoString).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Inventario() {
  const [productos, setProductos] = useState([]);
  const [trabajadoras, setTrabajadoras] = useState([]);
  const [bajoStock, setBajoStock] = useState([]);
  const [movimientos, setMovimientos] = useState([]);

  const [busqueda, setBusqueda] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState("todas");

  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [sheetMovimientos, setSheetMovimientos] = useState(false);

  const [form, setForm] = useState(formVacio());

  const [proveedoresPorProducto, setProveedoresPorProducto] = useState({});
  const [verProveedoresId, setVerProveedoresId] = useState(null);

  const [menuAbiertoId, setMenuAbiertoId] = useState(null);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setError(null);

    try {
      const [
        productosData,
        trabajadorasData,
        bajoStockData,
        movimientosData,
      ] = await Promise.all([
        listarProductos(),
        listarTrabajadoras(),
        listarBajoStock(),
        listarMovimientos(),
      ]);

      setProductos(productosData || []);
      setTrabajadoras(trabajadorasData || []);
      setBajoStock(bajoStockData || []);
      setMovimientos((movimientosData || []).slice(0, 30));
    } catch (err) {
      setError("No se pudieron cargar los datos de inventario");
    }
  }

  function iniciarCreacion(tipo = "entrada", productoId = "") {
    setForm({
      ...formVacio(),
      tipo,
      producto_id: productoId ? String(productoId) : "",
      motivo: tipo === "entrada" ? "produccion" : "merma",
    });

    setMensaje(null);
    setError(null);
    setMenuAbiertoId(null);
    setSheetAbierto(true);
  }

  function cerrarSheet(abierto) {
    setSheetAbierto(abierto);

    if (!abierto) {
      setForm(formVacio());
      setError(null);
    }
  }

  function cambiarTipo(tipo) {
    setForm((f) => ({
      ...f,
      tipo,
      motivo: tipo === "entrada" ? "produccion" : "merma",
    }));
  }

  async function guardar() {
    if (!form.producto_id || !form.cantidad) {
      setError("Selecciona un producto e ingresa la cantidad");
      return;
    }

    const cantidad = Number(form.cantidad);

    if (cantidad <= 0) {
      setError("La cantidad debe ser mayor a 0");
      return;
    }

    const productoSeleccionado = productos.find(
      (p) => Number(p.id) === Number(form.producto_id)
    );

    if (
      form.tipo === "salida" &&
      productoSeleccionado &&
      cantidad > Number(productoSeleccionado.stock_actual)
    ) {
      setError(
        `No hay suficiente stock. Disponible: ${productoSeleccionado.stock_actual}`
      );
      return;
    }

    setGuardando(true);
    setError(null);

    const payload = {
      producto_id: Number(form.producto_id),
      cantidad,
      motivo: form.motivo,
      trabajadora_id: form.trabajadora_id
        ? Number(form.trabajadora_id)
        : null,
    };

    try {
      if (form.tipo === "entrada") {
        await registrarEntrada(payload);
      } else {
        await registrarSalida(payload);
      }

      setMensaje("Movimiento registrado correctamente");
      cerrarSheet(false);
      await cargarDatos();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "No se pudo registrar el movimiento"
      );
    } finally {
      setGuardando(false);
    }
  }

  async function toggleProveedores(productoId) {
    if (verProveedoresId === productoId) {
      setVerProveedoresId(null);
      return;
    }

    setVerProveedoresId(productoId);

    if (!proveedoresPorProducto[productoId]) {
      try {
        const proveedores = await listarProveedoresDeProducto(productoId);

        setProveedoresPorProducto((prev) => ({
          ...prev,
          [productoId]: proveedores || [],
        }));
      } catch (err) {
        setError("No se pudieron cargar los proveedores");
      }
    }
  }

  function obtenerEstadoStock(producto) {
    const stock = Number(producto.stock_actual || 0);

    const productoBajoStock = bajoStock.some(
      (p) => Number(p.id) === Number(producto.id)
    );

    if (stock <= 0) {
      return {
        clase: "agotado",
        texto: "Agotado",
      };
    }

    if (productoBajoStock) {
      return {
        clase: "bajo",
        texto: "Stock bajo",
      };
    }

    return {
      clase: "normal",
      texto: "Disponible",
    };
  }

  function obtenerCategoria(producto) {
    return (
      producto.categoria_nombre ||
      producto.categoria ||
      producto.categoria_name ||
      "Otros"
    );
  }

  const categorias = useMemo(() => {
    const lista = productos
      .map((p) => obtenerCategoria(p))
      .filter(Boolean);

    return [...new Set(lista)];
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return productos.filter((producto) => {
      const nombre = String(producto.nombre || "").toLowerCase();
      const categoria = obtenerCategoria(producto);

      const coincideBusqueda =
        !texto || nombre.includes(texto);

      const coincideCategoria =
        categoriaActiva === "todas" ||
        categoria === categoriaActiva;

      return coincideBusqueda && coincideCategoria;
    });
  }, [productos, busqueda, categoriaActiva]);

  const productosPorCategoria = useMemo(() => {
    const grupos = {};

    productosFiltrados.forEach((producto) => {
      const categoria = obtenerCategoria(producto);

      if (!grupos[categoria]) {
        grupos[categoria] = [];
      }

      grupos[categoria].push(producto);
    });

    return grupos;
  }, [productosFiltrados]);

  const cantidadStockBajo = bajoStock.length;

  function renderTarjeta(producto) {
    const estado = obtenerEstadoStock(producto);
    const menuAbierto = menuAbiertoId === producto.id;
    const proveedoresAbiertos = verProveedoresId === producto.id;

    return (
      <div
        key={producto.id}
        className={`admin-inv-producto-card ${
          estado.clase === "bajo"
            ? "admin-inv-producto-card-bajo"
            : ""
        } ${
          estado.clase === "agotado"
            ? "admin-inv-producto-card-agotado"
            : ""
        }`}
      >
        <div className="admin-inv-producto-contenido">
          <div className="admin-inv-producto-icono">
            <Boxes size={20} />
          </div>

          <div className="admin-inv-producto-info">
            <span className="admin-inv-producto-nombre">
              {producto.nombre}
            </span>

            <span className="admin-inv-producto-stock">
              Stock actual:{" "}
              <strong>{producto.stock_actual ?? 0}</strong>
              {producto.unidad ? ` ${producto.unidad}` : ""}
            </span>

            <span
              className={`admin-inv-estado-stock ${estado.clase}`}
            >
              {estado.clase === "bajo" ||
              estado.clase === "agotado" ? (
                <AlertTriangle size={11} />
              ) : (
                <span className="admin-inv-punto-estado" />
              )}

              {estado.texto}
            </span>
          </div>

          <div className="admin-inv-producto-menu-wrapper">
            <button
              type="button"
              className="admin-inv-menu-btn"
              onClick={(e) => {
                e.stopPropagation();

                setMenuAbiertoId((actual) =>
                  actual === producto.id ? null : producto.id
                );
              }}
            >
              <MoreVertical size={18} />
            </button>

            {menuAbierto && (
              <div
                className="admin-inv-menu"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() =>
                    iniciarCreacion("entrada", producto.id)
                  }
                >
                  <TrendingUp size={15} />
                  Registrar entrada
                </button>

                <button
                  type="button"
                  onClick={() =>
                    iniciarCreacion("salida", producto.id)
                  }
                >
                  <TrendingDown size={15} />
                  Registrar salida
                </button>

                <button
                  type="button"
                  onClick={() => {
                    toggleProveedores(producto.id);
                    setMenuAbiertoId(null);
                  }}
                >
                  <Phone size={15} />
                  Ver proveedor
                </button>
              </div>
            )}
          </div>
        </div>

        {proveedoresAbiertos && (
          <div className="admin-inv-proveedores">
            <div className="admin-inv-proveedores-header">
              <span>Proveedores</span>

              <button
                type="button"
                onClick={() => setVerProveedoresId(null)}
              >
                <X size={14} />
              </button>
            </div>

            {(proveedoresPorProducto[producto.id] || []).length === 0 ? (
              <p className="admin-inv-sin-proveedor">
                Sin proveedores registrados
              </p>
            ) : (
              <div className="admin-inv-proveedores-lista">
                {proveedoresPorProducto[producto.id].map((prov) => (
                  <div
                    key={prov.id}
                    className="admin-inv-proveedor-fila"
                  >
                    <span>{prov.nombre}</span>

                    {prov.celular ? (
                      <a href={`tel:${prov.celular}`}>
                        <Phone size={12} />
                        {prov.celular}
                      </a>
                    ) : (
                      <span>Sin teléfono</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const motivosDisponibles =
    form.tipo === "entrada"
      ? MOTIVOS_ENTRADA
      : MOTIVOS_SALIDA;

  return (
    <div
      className="admin-inv-container"
      onClick={() => setMenuAbiertoId(null)}
    >
      <header className="admin-inv-header">
        <div>
          <h1>Inventario</h1>
          <p>Ajustes de stock, producción y mermas</p>
        </div>

        <button
          type="button"
          className="admin-inv-btn-nuevo"
          onClick={(e) => {
            e.stopPropagation();
            iniciarCreacion();
          }}
        >
          <Plus size={16} />
          Nuevo movimiento
        </button>
      </header>

      {mensaje && (
        <div className="admin-inv-mensaje-exito">
          {mensaje}
        </div>
      )}

      {error && !sheetAbierto && (
        <div className="admin-inv-mensaje-error">
          {error}
        </div>
      )}

      {/* RESUMEN */}
      <section className="admin-inv-resumen">
        <div className="admin-inv-resumen-card">
          <div className="admin-inv-resumen-icono">
            <Boxes size={18} />
          </div>

          <div>
            <strong>{productos.length}</strong>
            <span>Productos</span>
          </div>
        </div>

        <div className="admin-inv-resumen-card alerta">
          <div className="admin-inv-resumen-icono">
            <AlertTriangle size={18} />
          </div>

          <div>
            <strong>{cantidadStockBajo}</strong>
            <span>Stock bajo</span>
          </div>
        </div>

        <div className="admin-inv-resumen-card">
          <div className="admin-inv-resumen-icono">
            <History size={18} />
          </div>

          <div>
            <strong>{movimientos.length}</strong>
            <span>Movimientos</span>
          </div>
        </div>
      </section>

      {/* BUSCADOR */}
      <div className="admin-inv-buscador">
        <Search size={17} />

        <input
          type="text"
          placeholder="Buscar producto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        {busqueda && (
          <button
            type="button"
            onClick={() => setBusqueda("")}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* FILTROS */}
      <div className="admin-inv-filtros">
        <button
          type="button"
          className={
            categoriaActiva === "todas" ? "activo" : ""
          }
          onClick={() => setCategoriaActiva("todas")}
        >
          Todos
        </button>

        {categorias.map((categoria) => (
          <button
            type="button"
            key={categoria}
            className={
              categoriaActiva === categoria ? "activo" : ""
            }
            onClick={() => setCategoriaActiva(categoria)}
          >
            {categoria}
          </button>
        ))}
      </div>

      {/* PRODUCTOS */}
      <section className="admin-inv-productos-seccion">
        {productosFiltrados.length === 0 ? (
          <div className="admin-inv-vacio">
            <Boxes size={28} />
            <strong>No encontramos productos</strong>

            <span>
              {busqueda
                ? "Prueba con otro nombre."
                : "Todavía no hay productos registrados."}
            </span>
          </div>
        ) : (
          Object.entries(productosPorCategoria).map(
            ([categoria, productosCategoria]) => (
              <div
                className="admin-inv-categoria-grupo"
                key={categoria}
              >
                <div className="admin-inv-categoria-header">
                  <h2>{categoria}</h2>
                  <span>{productosCategoria.length}</span>
                </div>

                <div className="admin-inv-productos-grid">
                  {productosCategoria.map(renderTarjeta)}
                </div>
              </div>
            )
          )
        )}
      </section>

      {/* MOVIMIENTOS */}
      <section className="admin-inv-movimientos-resumen">
        <div>
          <div className="admin-inv-movimientos-titulo">
            <History size={18} />
            <div>
              <h2>Movimientos recientes</h2>
              <p>
                Consulta las últimas entradas y salidas de inventario.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="admin-inv-btn-historial"
          onClick={() => setSheetMovimientos(true)}
        >
          Ver movimientos
          <History size={15} />
        </button>
      </section>

      {/* SHEET NUEVO MOVIMIENTO */}
      <Sheet
        open={sheetAbierto}
        onOpenChange={cerrarSheet}
        title="Nuevo movimiento de inventario"
      >
        <div className="admin-inv-form">
          {error && (
            <div className="admin-inv-mensaje-error">
              {error}
            </div>
          )}

          <label>Tipo de movimiento</label>

          <div className="admin-inv-tipos">
            <button
              type="button"
              className={`admin-inv-tipo-btn entrada ${
                form.tipo === "entrada" ? "activo" : ""
              }`}
              onClick={() => cambiarTipo("entrada")}
            >
              <TrendingUp size={15} />
              Entrada
            </button>

            <button
              type="button"
              className={`admin-inv-tipo-btn salida ${
                form.tipo === "salida" ? "activo" : ""
              }`}
              onClick={() => cambiarTipo("salida")}
            >
              <TrendingDown size={15} />
              Salida
            </button>
          </div>

          <label>Producto</label>

          <select
            value={form.producto_id}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                producto_id: e.target.value,
              }))
            }
          >
            <option value="">Selecciona...</option>

            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} — stock: {p.stock_actual}
              </option>
            ))}
          </select>

          {form.producto_id && (
            <div className="admin-inv-stock-seleccionado">
              Stock disponible:{" "}
              <strong>
                {
                  productos.find(
                    (p) =>
                      Number(p.id) ===
                      Number(form.producto_id)
                  )?.stock_actual ?? 0
                }
              </strong>
            </div>
          )}

          <label>Cantidad</label>

          <input
            type="number"
            min="0.01"
            step="0.01"
            value={form.cantidad}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                cantidad: e.target.value,
              }))
            }
            placeholder="Ej: 50"
          />

          <label>Motivo</label>

          <select
            value={form.motivo}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                motivo: e.target.value,
              }))
            }
          >
            {motivosDisponibles.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.label}
              </option>
            ))}
          </select>

          <label>¿Quién lo registra? (opcional)</label>

          <select
            value={form.trabajadora_id}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                trabajadora_id: e.target.value,
              }))
            }
          >
            <option value="">
              Sin especificar
            </option>

            {trabajadoras.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="admin-inv-btn-primario admin-inv-btn-guardar-sheet"
            onClick={guardar}
            disabled={guardando}
          >
            {guardando
              ? "Guardando..."
              : "Guardar movimiento"}
          </button>
        </div>
      </Sheet>

      {/* SHEET HISTORIAL */}
      <Sheet
        open={sheetMovimientos}
        onOpenChange={setSheetMovimientos}
        title="Movimientos recientes"
      >
        <div className="admin-inv-historial">
          {movimientos.length === 0 ? (
            <div className="admin-inv-vacio">
              <History size={28} />
              <strong>
                Todavía no hay movimientos
              </strong>
              <span>
                Los movimientos registrados aparecerán aquí.
              </span>
            </div>
          ) : (
            movimientos.map((movimiento) => {
              const producto = productos.find(
                (p) =>
                  Number(p.id) ===
                  Number(movimiento.producto_id)
              );

              return (
                <div
                  key={movimiento.id}
                  className="admin-inv-mov-fila"
                >
                  <span
                    className={`admin-inv-mov-icono ${movimiento.tipo}`}
                  >
                    {movimiento.tipo === "entrada" ? (
                      <TrendingUp size={14} />
                    ) : (
                      <TrendingDown size={14} />
                    )}
                  </span>

                  <div className="admin-inv-mov-info">
                    <span className="admin-inv-mov-producto">
                      {producto?.nombre ||
                        `Producto #${movimiento.producto_id}`}
                    </span>

                    <span className="admin-inv-mov-detalle">
                      {movimiento.motivo} ·{" "}
                      {formatearFecha(
                        movimiento.fecha
                      )}
                    </span>
                  </div>

                  <span
                    className={`admin-inv-mov-cantidad ${movimiento.tipo}`}
                  >
                    {movimiento.tipo === "entrada"
                      ? "+"
                      : "-"}
                    {movimiento.cantidad}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </Sheet>
    </div>
  );
}