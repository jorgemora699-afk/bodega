import { useEffect, useState } from "react";
import {
  Package,
  PackagePlus,
  Phone,
  AlertTriangle,
  CheckCircle2,
  Minus,
  Plus,
} from "lucide-react";

import { listarProductos } from "../../../api/productos";
import { registrarEntrada, listarBajoStock } from "../../../api/inventario";
import { listarProveedoresDeProducto } from "../../../api/proveedores";
import Sheet from "../../../components/Sheet";
import "./Inventario.css";

export default function Inventario() {
  const [productos, setProductos] = useState([]);
  const [bajoStock, setBajoStock] = useState([]);

  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [enviando, setEnviando] = useState(false);

  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  const [proveedoresPorProducto, setProveedoresPorProducto] = useState({});
  const [expandido, setExpandido] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setError(null);

    try {
      const [productosData, bajoStockData] = await Promise.all([
        listarProductos(),
        listarBajoStock(),
      ]);

      setProductos(productosData);
      setBajoStock(bajoStockData);
    } catch (err) {
      setError("No se pudieron cargar los datos");
    }
  }

  function abrirProduccion() {
    setProductoSeleccionado(null);
    setCantidad(1);
    setMensaje(null);
    setError(null);
    setSheetAbierto(true);
  }

  function cerrarSheet(abierto) {
    setSheetAbierto(abierto);

    if (!abierto) {
      setProductoSeleccionado(null);
      setCantidad(1);
    }
  }

  function ajustarCantidad(delta) {
    setCantidad((c) => Math.max(1, Number(c || 1) + delta));
  }

  async function registrarProduccion() {
    if (!productoSeleccionado) return;

    if (!cantidad || Number(cantidad) < 1) {
      setError("Ingresa una cantidad válida");
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      await registrarEntrada({
        producto_id: productoSeleccionado.id,
        cantidad: Number(cantidad),
        motivo: "produccion",
      });

      setMensaje(
        `Se agregaron ${cantidad} unidades de ${productoSeleccionado.nombre}`
      );

      cerrarSheet(false);
      cargarDatos();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "No se pudo registrar la producción"
      );
    } finally {
      setEnviando(false);
    }
  }

  async function verProveedores(productoId) {
    if (expandido === productoId) {
      setExpandido(null);
      return;
    }

    setExpandido(productoId);

    if (!proveedoresPorProducto[productoId]) {
      try {
        const proveedores = await listarProveedoresDeProducto(productoId);

        setProveedoresPorProducto((prev) => ({
          ...prev,
          [productoId]: proveedores,
        }));
      } catch (err) {
        setError("No se pudieron cargar los proveedores");
      }
    }
  }

  // Identificar productos que están bajos de stock
  const idsBajoStock = new Set(
    bajoStock.map((producto) => producto.id)
  );

  // Mostrar primero los productos con stock bajo
  const productosOrdenados = [...productos].sort((a, b) => {
    const aBajo = idsBajoStock.has(a.id);
    const bBajo = idsBajoStock.has(b.id);

    if (aBajo && !bBajo) return -1;
    if (!aBajo && bBajo) return 1;

    return a.nombre.localeCompare(b.nombre);
  });

  return (
    <div className="inv-container">
      <header className="inv-header">
        <div>
          <h1>Inventario</h1>
          <p>
            {productos.length} productos registrados
            {bajoStock.length > 0 &&
              ` · ${bajoStock.length} por acabarse`}
          </p>
        </div>

        <button
          className="inv-btn-produccion-header"
          onClick={abrirProduccion}
        >
          <PackagePlus size={15} />
          Registrar producción
        </button>
      </header>

      {mensaje && (
        <div className="inv-mensaje-exito">
          <CheckCircle2 size={16} />
          {mensaje}
        </div>
      )}

      {error && !sheetAbierto && (
        <div className="inv-mensaje-error">
          {error}
        </div>
      )}

      <section className="inv-seccion">
        <h2>
          <PackagePlus size={16} />
          Mis productos
        </h2>

        {productosOrdenados.length === 0 ? (
          <div className="inv-sin-alertas">
            <CheckCircle2 size={18} />
            <span>No hay productos registrados</span>
          </div>
        ) : (
          <div className="inv-lista-productos">
            {productosOrdenados.map((producto) => {
              const estaBajoStock = idsBajoStock.has(producto.id);

              const proveedores =
                proveedoresPorProducto[producto.id] || [];

              return (
                <div
                  key={producto.id}
                  className={`inv-producto-card ${
                    estaBajoStock ? "stock-bajo" : ""
                  }`}
                >
                  <div className="inv-producto-top">
                    <div className="inv-producto-info">
                      <div className="inv-producto-nombre-wrapper">
                        <span className="inv-producto-icono">
                          <Package size={16} />
                        </span>

                        <span className="inv-prod-nombre">
                          {producto.nombre}
                        </span>
                      </div>

                      <span className="inv-producto-label">
                        Stock actual
                      </span>

                      <span className="inv-producto-stock">
                        {producto.stock_actual}
                      </span>
                    </div>

                    <div className="inv-producto-estado">
                      {estaBajoStock ? (
                        <span className="inv-badge-bajo">
                          <AlertTriangle size={12} />
                          Stock bajo
                        </span>
                      ) : (
                        <span className="inv-badge-ok">
                          <CheckCircle2 size={12} />
                          Disponible
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="inv-producto-acciones">

                    <button
                      className={`inv-btn-secundario ${
                        expandido === producto.id
                          ? "activo"
                          : ""
                      }`}
                      onClick={() =>
                        verProveedores(producto.id)
                      }
                    >
                      <Phone size={14} />

                      {expandido === producto.id
                        ? "Ocultar proveedor"
                        : "Ver proveedor"}
                    </button>
                  </div>

                  {expandido === producto.id && (
                    <div className="inv-proveedores-lista">
                      {proveedores.length === 0 ? (
                        <p className="inv-sin-proveedor">
                          No hay proveedores registrados
                          para este producto
                        </p>
                      ) : (
                        proveedores.map((prov) => (
                          <a
                            key={prov.id}
                            href={`tel:${prov.celular}`}
                            className="inv-proveedor-fila"
                          >
                            <span>
                              {prov.nombre}
                            </span>

                            <span className="inv-proveedor-numero">
                              {prov.celular}
                            </span>
                          </a>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Sheet
        open={sheetAbierto}
        onOpenChange={cerrarSheet}
        title={
          productoSeleccionado
            ? productoSeleccionado.nombre
            : "Registrar producción"
        }
      >
        <div className="inv-sheet-body">
          {error && (
            <div className="inv-mensaje-error">
              {error}
            </div>
          )}

          <label>Producto</label>

          <select
            value={productoSeleccionado?.id || ""}
            onChange={(e) => {
              const producto = productos.find(
                (p) => p.id === Number(e.target.value)
              );

              setProductoSeleccionado(producto || null);
              setCantidad(1);
              setError(null);
            }}
          >
            <option value="">Selecciona un producto...</option>

            {productos.map((producto) => (
              <option key={producto.id} value={producto.id}>
                {producto.nombre} — Stock: {producto.stock_actual}
              </option>
            ))}
          </select>

          {productoSeleccionado && (
            <>
              <p className="inv-sheet-subtitulo">
                Stock actual: {productoSeleccionado.stock_actual}
              </p>

              <label>¿Cuántas unidades se hicieron?</label>

              <div className="inv-stepper">
                <button
                  type="button"
                  className="inv-stepper-btn"
                  onClick={() => ajustarCantidad(-1)}
                >
                  <Minus size={16} />
                </button>

                <input
                  type="number"
                  min="1"
                  value={cantidad}
                  onChange={(e) => {
                    const valor = e.target.value;

                    if (valor === "") {
                      setCantidad("");
                      return;
                    }

                    setCantidad(Math.max(1, Number(valor)));
                  }}
                  className="inv-stepper-input"
                />

                <button
                  type="button"
                  className="inv-stepper-btn"
                  onClick={() => ajustarCantidad(1)}
                >
                  <Plus size={16} />
                </button>
              </div>
            </>
          )}

          <div className="inv-stepper">
            <button
              type="button"
              className="inv-stepper-btn"
              onClick={() => ajustarCantidad(-1)}
            >
              <Minus size={16} />
            </button>

            <input
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => {
                const valor = e.target.value;

                if (valor === "") {
                  setCantidad("");
                  return;
                }

                setCantidad(Math.max(1, Number(valor)));
              }}
              className="inv-stepper-input"
            />

            <button
              type="button"
              className="inv-stepper-btn"
              onClick={() => ajustarCantidad(1)}
            >
              <Plus size={16} />
            </button>
          </div>

          <button
            className="inv-btn-primario inv-btn-guardar-sheet"
            onClick={registrarProduccion}
            disabled={enviando || !productoSeleccionado}
          >
            {enviando
              ? "Registrando..."
              : "Registrar producción"}
          </button>
        </div>
      </Sheet>
    </div>
  );
}