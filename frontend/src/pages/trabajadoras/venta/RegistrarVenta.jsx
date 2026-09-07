import { useEffect, useState } from "react";
import { ShoppingBag, Minus, Plus, Banknote, ArrowLeftRight, CreditCard, Check, Search } from "lucide-react";
import { listarProductos } from "../../../api/productos";
import { listarTrabajadoras } from "../../../api/trabajadoras";
import { crearVenta } from "../../../api/ventas";
import "./RegistrarVenta.css";

const METODOS_PAGO = [
  { valor: "efectivo", label: "Efectivo", Icon: Banknote },
  { valor: "transferencia", label: "Transferencia", Icon: ArrowLeftRight },
  { valor: "datafono", label: "Datáfono", Icon: CreditCard },
];

export default function RegistrarVenta() {
  const [productos, setProductos] = useState([]);
  const [trabajadoras, setTrabajadoras] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");

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

  function ajustarCantidad(delta) {
    setCantidad((c) => Math.max(1, Number(c) + delta));
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

  const categorias = [...new Set(productos.map((p) => p.categoria).filter(Boolean))].sort();

  const productosFiltrados = productos.filter((p) => {
    const coincideBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const coincideCategoria = !categoriaFiltro || p.categoria === categoriaFiltro;
    return coincideBusqueda && coincideCategoria;
  });

  return (
    <div className="venta-container">
      <header className="venta-header">
        <h1>Registrar venta</h1>
        <p>Selecciona el producto que se vendió</p>
      </header>

      {mensaje && (
        <div className="venta-mensaje-exito">
          <Check size={16} /> {mensaje}
        </div>
      )}
      {error && <div className="venta-mensaje-error">{error}</div>}

      {!confirmando && (
        <>
          {productos.length > 0 && (
            <>
              <div className="venta-buscador">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>

              {categorias.length > 0 && (
                <div className="venta-filtros-categoria">
                  <button
                    className={`venta-chip ${categoriaFiltro === "" ? "activo" : ""}`}
                    onClick={() => setCategoriaFiltro("")}
                  >
                    Todas
                  </button>
                  {categorias.map((c) => (
                    <button
                      key={c}
                      className={`venta-chip ${categoriaFiltro === c ? "activo" : ""}`}
                      onClick={() => setCategoriaFiltro(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="venta-grid-productos">
            {productosFiltrados.map((producto) => {
              const activo = productoSeleccionado?.id === producto.id;
              const bajoStock = producto.stock_actual <= 5;
              return (
                <button
                  key={producto.id}
                  className={`venta-prod-btn ${activo ? "activo" : ""}`}
                  onClick={() => seleccionarProducto(producto)}
                >
                  {activo && (
                    <span className="venta-prod-check">
                      <Check size={13} />
                    </span>
                  )}
                  <span className="venta-prod-icono">
                    <ShoppingBag size={20} />
                  </span>
                  <span className="venta-prod-nombre">{producto.nombre}</span>
                  <span className="venta-prod-precio">
                    ${Number(producto.precio_unitario).toLocaleString("es-CO")}
                  </span>
                  <span className={`venta-prod-stock ${bajoStock ? "bajo" : ""}`}>
                    Stock: {producto.stock_actual}
                  </span>
                </button>
              );
            })}

            {productos.length > 0 && productosFiltrados.length === 0 && (
              <p className="venta-sin-resultados">Ningún producto coincide con el filtro</p>
            )}
          </div>

          {productoSeleccionado && (
            <div className="venta-detalle">
              <label>Cantidad</label>
              <div className="venta-stepper">
                <button
                  type="button"
                  className="venta-stepper-btn"
                  onClick={() => ajustarCantidad(-1)}
                >
                  <Minus size={16} />
                </button>
                <span className="venta-stepper-valor">{cantidad}</span>
                <button
                  type="button"
                  className="venta-stepper-btn"
                  onClick={() => ajustarCantidad(1)}
                >
                  <Plus size={16} />
                </button>
              </div>

              <label>Método de pago</label>
              <div className="venta-metodos">
                {METODOS_PAGO.map(({ valor, label, Icon }) => (
                  <button
                    key={valor}
                    className={`venta-metodo-btn ${metodoPago === valor ? "activo" : ""}`}
                    onClick={() => setMetodoPago(valor)}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
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
          <div className="venta-confirmacion-icono">
            <ShoppingBag size={26} />
          </div>
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
            <span className="venta-capitalize">{metodoPago}</span>
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