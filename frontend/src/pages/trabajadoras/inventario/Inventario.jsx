import { useEffect, useState } from "react";
import { Package, PackagePlus, Phone, AlertTriangle, CheckCircle2, Minus, Plus } from "lucide-react";
import { listarProductos } from "../../../api/productos";
import { registrarEntrada, listarBajoStock } from "../../../api/inventario";
import { listarProveedoresDeProducto } from "../../../api/proveedores";
import "./Inventario.css";

export default function Inventario() {
  const [productos, setProductos] = useState([]);
  const [bajoStock, setBajoStock] = useState([]);

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

  function seleccionarProducto(producto) {
    setProductoSeleccionado(producto);
    setCantidad(1);
    setMensaje(null);
    setError(null);
  }

  function ajustarCantidad(delta) {
    setCantidad((c) => Math.max(1, Number(c) + delta));
  }

  async function registrarProduccion() {
    if (!productoSeleccionado) {
      setError("Selecciona un producto");
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

      setMensaje(`Se agregaron ${cantidad} unidades de ${productoSeleccionado.nombre}`);
      setProductoSeleccionado(null);
      setCantidad(1);
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo registrar la producción");
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
        setProveedoresPorProducto((prev) => ({ ...prev, [productoId]: proveedores }));
      } catch (err) {
        setError("No se pudieron cargar los proveedores");
      }
    }
  }

  return (
    <div className="inv-container">
      <header className="inv-header">
        <h1>Inventario</h1>
        <p>Registra producción y revisa qué se está acabando</p>
      </header>

      {mensaje && (
        <div className="inv-mensaje-exito">
          <CheckCircle2 size={16} /> {mensaje}
        </div>
      )}
      {error && <div className="inv-mensaje-error">{error}</div>}

      <section className="inv-seccion">
        <h2>
          <PackagePlus size={16} />
          Registrar producción
        </h2>

        <div className="inv-grid-productos">
          {productos.map((producto) => (
            <button
              key={producto.id}
              className={`inv-prod-btn ${
                productoSeleccionado?.id === producto.id ? "activo" : ""
              }`}
              onClick={() => seleccionarProducto(producto)}
            >
              <span className="inv-prod-icono">
                <Package size={18} />
              </span>
              <span className="inv-prod-nombre">{producto.nombre}</span>
              <span className="inv-prod-stock">Stock: {producto.stock_actual}</span>
            </button>
          ))}
        </div>

        {productoSeleccionado && (
          <div className="inv-form-produccion">
            <label>¿Cuántas unidades se hicieron de {productoSeleccionado.nombre}?</label>
            <div className="inv-stepper">
              <button type="button" className="inv-stepper-btn" onClick={() => ajustarCantidad(-1)}>
                <Minus size={16} />
              </button>
              <span className="inv-stepper-valor">{cantidad}</span>
              <button type="button" className="inv-stepper-btn" onClick={() => ajustarCantidad(1)}>
                <Plus size={16} />
              </button>
            </div>
            <button
              className="inv-btn-primario"
              onClick={registrarProduccion}
              disabled={enviando}
            >
              {enviando ? "Registrando..." : "Registrar producción"}
            </button>
          </div>
        )}
      </section>

      <section className="inv-seccion">
        <h2>
          <AlertTriangle size={16} />
          Productos por acabarse
        </h2>

        {bajoStock.length === 0 ? (
          <div className="inv-sin-alertas">
            <CheckCircle2 size={18} />
            <span>Todo el stock está en buen nivel</span>
          </div>
        ) : (
          <div className="inv-lista-bajo-stock">
            {bajoStock.map((producto) => (
              <div key={producto.id} className="inv-bajo-stock-card">
                <div className="inv-bajo-stock-info">
                  <span className="inv-prod-nombre">{producto.nombre}</span>
                  <span className="inv-badge-bajo">Quedan {producto.stock_actual}</span>
                </div>
                <button
                  className="inv-btn-secundario"
                  onClick={() => verProveedores(producto.id)}
                >
                  <Phone size={14} />
                  Ver proveedor
                </button>

                {expandido === producto.id && (
                  <div className="inv-proveedores-lista">
                    {(proveedoresPorProducto[producto.id] || []).length === 0 ? (
                      <p className="inv-sin-proveedor">
                        No hay proveedores registrados para este producto
                      </p>
                    ) : (
                      proveedoresPorProducto[producto.id].map((prov) => (
                        <a key={prov.id} href={`tel:${prov.celular}`} className="inv-proveedor-fila">
                          <span>{prov.nombre}</span>
                          <span className="inv-proveedor-numero">{prov.celular}</span>
                        </a>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}