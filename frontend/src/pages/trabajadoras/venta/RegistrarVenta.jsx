import { useEffect, useState } from "react";
import { listarProductos } from "../../../api/productos";
import { listarTrabajadoras } from "../../../api/trabajadoras";
import { crearVenta } from "../../../api/ventas";
import "./RegistrarVenta.css";

const METODOS_PAGO = ["efectivo", "transferencia", "datafono"];

export default function RegistrarVenta() {
  const [productos, setProductos] = useState([]);
  const [trabajadoras, setTrabajadoras] = useState([]);

  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [metodoPago, setMetodoPago] = useState("");
  const [trabajadoraId, setTrabajadoraId] = useState("");

  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    try {
      const [productosData, trabajadorasData] = await Promise.all([
        listarProductos(),
        listarTrabajadoras(),
      ]);
      setProductos(productosData);
      setTrabajadoras(trabajadorasData);
    } catch (err) {
      setError("No se pudieron cargar los datos. Revisa tu conexión.");
    }
  }

  function seleccionarProducto(producto) {
    setProductoSeleccionado(producto);
    setCantidad(1);
    setConfirmando(false);
    setMensaje(null);
    setError(null);
  }

  function irAConfirmar() {
    if (!productoSeleccionado || !metodoPago || !trabajadoraId) {
      setError("Selecciona producto, método de pago y quién realiza la venta");
      return;
    }
    setError(null);
    setConfirmando(true);
  }

  async function confirmarVenta() {
    setEnviando(true);
    setError(null);

    try {
      await crearVenta({
        producto_id: productoSeleccionado.id,
        trabajadora_id: Number(trabajadoraId),
        cantidad: Number(cantidad),
        metodo_pago: metodoPago,
      });

      setMensaje("Venta registrada correctamente");
      setProductoSeleccionado(null);
      setCantidad(1);
      setMetodoPago("");
      setConfirmando(false);

      // refresca el stock mostrado en la grilla de productos
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo registrar la venta");
      setConfirmando(false);
    } finally {
      setEnviando(false);
    }
  }

  const total = productoSeleccionado
    ? Number(productoSeleccionado.precio_unitario) * Number(cantidad || 0)
    : 0;

  return (
    <div className="venta-container">
      <header className="venta-header">
        <h1>Registrar venta</h1>
      </header>

      {mensaje && <div className="venta-mensaje-exito">{mensaje}</div>}
      {error && <div className="venta-mensaje-error">{error}</div>}

      {!confirmando && (
        <>
          <div className="venta-grid-productos">
            {productos.map((producto) => (
              <button
                key={producto.id}
                className={`venta-prod-btn ${
                  productoSeleccionado?.id === producto.id ? "activo" : ""
                }`}
                onClick={() => seleccionarProducto(producto)}
              >
                <span className="venta-prod-nombre">{producto.nombre}</span>
                <span className="venta-prod-precio">
                  ${Number(producto.precio_unitario).toLocaleString("es-CO")}
                </span>
                <span className="venta-prod-stock">Stock: {producto.stock_actual}</span>
              </button>
            ))}
          </div>

          {productoSeleccionado && (
            <div className="venta-detalle">
              <label>Cantidad</label>
              <input
                type="number"
                min="1"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />

              <label>Método de pago</label>
              <div className="venta-metodos">
                {METODOS_PAGO.map((metodo) => (
                  <button
                    key={metodo}
                    className={`venta-metodo-btn ${metodoPago === metodo ? "activo" : ""}`}
                    onClick={() => setMetodoPago(metodo)}
                  >
                    {metodo}
                  </button>
                ))}
              </div>

              <label>¿Quién realiza la venta?</label>
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

              <div className="venta-total">
                <span>Total</span>
                <span>${total.toLocaleString("es-CO")}</span>
              </div>

              <button className="venta-btn-primario" onClick={irAConfirmar}>
                Continuar
              </button>
            </div>
          )}
        </>
      )}

      {confirmando && (
        <div className="venta-confirmacion">
          <h2>Confirmar venta</h2>
          <div className="venta-resumen-fila">
            <span>Producto</span>
            <span>{productoSeleccionado.nombre}</span>
          </div>
          <div className="venta-resumen-fila">
            <span>Cantidad</span>
            <span>{cantidad}</span>
          </div>
          <div className="venta-resumen-fila">
            <span>Método de pago</span>
            <span>{metodoPago}</span>
          </div>
          <div className="venta-resumen-fila">
            <span>Vendido por</span>
            <span>{trabajadoras.find((t) => t.id === Number(trabajadoraId))?.nombre}</span>
          </div>
          <div className="venta-resumen-fila venta-resumen-total">
            <span>Total</span>
            <span>${total.toLocaleString("es-CO")}</span>
          </div>

          <div className="venta-confirmacion-botones">
            <button
              className="venta-btn-secundario"
              onClick={() => setConfirmando(false)}
              disabled={enviando}
            >
              Volver
            </button>
            <button
              className="venta-btn-primario"
              onClick={confirmarVenta}
              disabled={enviando}
            >
              {enviando ? "Registrando..." : "Confirmar venta"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}