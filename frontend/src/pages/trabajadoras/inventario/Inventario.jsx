import { useEffect, useState } from "react";
import { listarProductos } from "../../../api/productos";
import { registrarEntrada, listarBajoStock } from "../../../api/inventario";
import { listarProveedoresDeProducto } from "../../../api/proveedores";
import { listarTrabajadoras } from "../../../api/trabajadoras";
import "./Inventario.css";

export default function Inventario() {
  const [productos, setProductos] = useState([]);
  const [bajoStock, setBajoStock] = useState([]);
  const [trabajadoras, setTrabajadoras] = useState([]);

  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [cantidad, setCantidad] = useState("");
  const [trabajadoraId, setTrabajadoraId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  const [proveedoresPorProducto, setProveedoresPorProducto] = useState({});
  const [cargandoProveedores, setCargandoProveedores] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    try {
      const [productosData, bajoStockData, trabajadorasData] = await Promise.all([
        listarProductos(),
        listarBajoStock(),
        listarTrabajadoras(),
      ]);
      setProductos(productosData);
      setBajoStock(bajoStockData);
      setTrabajadoras(trabajadorasData);
    } catch (err) {
      setError("No se pudieron cargar los datos");
    }
  }

  function seleccionarProducto(producto) {
    setProductoSeleccionado(producto);
    setCantidad("");
    setTrabajadoraId("");
    setMensaje(null);
    setError(null);
  }

  async function registrarProduccion() {
    if (!productoSeleccionado || !cantidad || !trabajadoraId) {
      setError("Selecciona un producto, ingresa la cantidad y quién la registra");
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      await registrarEntrada({
        producto_id: productoSeleccionado.id,
        trabajadora_id: Number(trabajadoraId),
        cantidad: Number(cantidad),
        motivo: "produccion",
      });

      setMensaje(`Se agregaron ${cantidad} unidades de ${productoSeleccionado.nombre}`);
      setProductoSeleccionado(null);
      setCantidad("");
      setTrabajadoraId("");
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo registrar la producción");
    } finally {
      setEnviando(false);
    }
  }

  async function verProveedores(productoId) {
    if (proveedoresPorProducto[productoId]) {
      setCargandoProveedores(cargandoProveedores === productoId ? null : productoId);
      return;
    }

    setCargandoProveedores(productoId);
    try {
      const proveedores = await listarProveedoresDeProducto(productoId);
      setProveedoresPorProducto((prev) => ({ ...prev, [productoId]: proveedores }));
    } catch (err) {
      setError("No se pudieron cargar los proveedores");
    }
  }

  return (
    <div className="inv-container">
      <h1>Inventario</h1>

      {mensaje && <div className="inv-mensaje-exito">{mensaje}</div>}
      {error && <div className="inv-mensaje-error">{error}</div>}

      <section className="inv-seccion">
        <h2>Registrar producción</h2>
        <div className="inv-grid-productos">
          {productos.map((producto) => (
            <button
              key={producto.id}
              className={`inv-prod-btn ${
                productoSeleccionado?.id === producto.id ? "activo" : ""
              }`}
              onClick={() => seleccionarProducto(producto)}
            >
              <span className="inv-prod-nombre">{producto.nombre}</span>
              <span className="inv-prod-stock">Stock: {producto.stock_actual}</span>
            </button>
          ))}
        </div>

        {productoSeleccionado && (
          <div className="inv-form-produccion">
            <label>¿Cuántas unidades se hicieron de {productoSeleccionado.nombre}?</label>
            <input
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              placeholder="Ej: 100"
            />

            <label>¿Quién la registra?</label>
            <select
              value={trabajadoraId}
              onChange={(e) => setTrabajadoraId(e.target.value)}
            >
              <option value="">Selecciona...</option>
              {trabajadoras.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>

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
        <h2>Productos por acabarse</h2>
        {bajoStock.length === 0 && (
          <p className="inv-sin-alertas">Todo el stock está en buen nivel</p>
        )}
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
                Ver proveedor
              </button>

              {cargandoProveedores === producto.id && (
                <div className="inv-proveedores-lista">
                  {(proveedoresPorProducto[producto.id] || []).length === 0 ? (
                    <p className="inv-sin-proveedor">
                      No hay proveedores registrados para este producto
                    </p>
                  ) : (
                    proveedoresPorProducto[producto.id].map((prov) => (
                      <div key={prov.id} className="inv-proveedor-fila">
                        <span>{prov.nombre}</span>
                        <a href={`tel:${prov.celular}`}>{prov.celular}</a>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}