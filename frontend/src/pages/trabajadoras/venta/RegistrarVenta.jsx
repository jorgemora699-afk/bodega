import { useEffect, useState } from "react";
import {
  ShoppingBag,
  ShoppingCart,
  Minus,
  Plus,
  Trash2,
  Banknote,
  ArrowLeftRight,
  CreditCard,
  Check,
  Search,
  ChevronLeft,
} from "lucide-react";
import { listarProductos } from "../../../api/productos";
import { listarTrabajadoras } from "../../../api/trabajadoras";
import { crearOrden } from "../../../api/ordenes";
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

  const [carrito, setCarrito] = useState([]); // [{ producto_id, nombre, precio_unitario, cantidad }]
  const [vista, setVista] = useState("catalogo"); // "catalogo" | "carrito" | "confirmando"

  const [metodoPago, setMetodoPago] = useState("");
  const [trabajadoraId, setTrabajadoraId] = useState("");

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

  function cantidadEnCarrito(productoId) {
    return carrito.find((i) => i.producto_id === productoId)?.cantidad || 0;
  }

  function agregarAlCarrito(producto) {
    setMensaje(null);
    setError(null);
    setCarrito((prev) => {
      const existente = prev.find((i) => i.producto_id === producto.id);
      if (existente) {
        return prev.map((i) =>
          i.producto_id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }
      return [
        ...prev,
        {
          producto_id: producto.id,
          nombre: producto.nombre,
          precio_unitario: producto.precio_unitario,
          cantidad: 1,
        },
      ];
    });
  }

  function ajustarCantidadCarrito(productoId, delta) {
    setCarrito((prev) =>
      prev
        .map((i) =>
          i.producto_id === productoId ? { ...i, cantidad: i.cantidad + delta } : i
        )
        .filter((i) => i.cantidad > 0)
    );
  }

  function quitarDelCarrito(productoId) {
    setCarrito((prev) => prev.filter((i) => i.producto_id !== productoId));
  }

  function irAlCarrito() {
    setVista("carrito");
  }

  function volverAlCatalogo() {
    setVista("catalogo");
  }

  function irAConfirmar() {
    if (!metodoPago || !trabajadoraId) {
      setError("Selecciona método de pago y quién realiza la venta");
      return;
    }
    setError(null);
    setVista("confirmando");
  }

  async function confirmarOrden() {
    setEnviando(true);
    setError(null);

    try {
      await crearOrden({
        trabajadora_id: Number(trabajadoraId),
        metodo_pago: metodoPago,
        items: carrito.map((i) => ({
          producto_id: i.producto_id,
          cantidad: i.cantidad,
        })),
      });

      setMensaje("Venta registrada correctamente");
      setCarrito([]);
      setMetodoPago("");
      setTrabajadoraId("");
      setVista("catalogo");
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo registrar la venta");
      setVista("carrito");
    } finally {
      setEnviando(false);
    }
  }

  const categorias = [...new Set(productos.map((p) => p.categoria).filter(Boolean))].sort();

  const productosFiltrados = productos.filter((p) => {
    const coincideBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const coincideCategoria = !categoriaFiltro || p.categoria === categoriaFiltro;
    return coincideBusqueda && coincideCategoria;
  });

  const totalCarrito = carrito.reduce(
    (sum, i) => sum + Number(i.precio_unitario) * i.cantidad,
    0
  );
  const cantidadTotalCarrito = carrito.reduce((sum, i) => sum + i.cantidad, 0);

  return (
    <div className="venta-container">
      {vista !== "confirmando" && (
        <header className="venta-header">
          <h1>Registrar venta</h1>
          <p>
            {vista === "catalogo"
              ? "Toca los productos para agregarlos al carrito"
              : "Revisa el pedido antes de confirmar"}
          </p>
        </header>
      )}

      {mensaje && (
        <div className="venta-mensaje-exito">
          <Check size={16} /> {mensaje}
        </div>
      )}
      {error && <div className="venta-mensaje-error">{error}</div>}

      {vista === "catalogo" && (
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
              const bajoStock = producto.stock_actual <= 5;
              const enCarrito = cantidadEnCarrito(producto.id);
              return (
                <button
                  key={producto.id}
                  className={`venta-prod-btn ${enCarrito > 0 ? "en-carrito" : ""}`}
                  onClick={() => agregarAlCarrito(producto)}
                >
                  {enCarrito > 0 && (
                    <span className="venta-prod-badge-carrito">{enCarrito}</span>
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

          {carrito.length > 0 && (
            <button className="venta-carrito-fab" onClick={irAlCarrito}>
              <span className="venta-carrito-fab-info">
                <ShoppingCart size={18} />
                {cantidadTotalCarrito} producto{cantidadTotalCarrito !== 1 ? "s" : ""}
              </span>
              <span className="venta-carrito-fab-total">
                ${totalCarrito.toLocaleString("es-CO")}
              </span>
            </button>
          )}
        </>
      )}

      {vista === "carrito" && (
        <div className="venta-detalle">
          <button className="venta-volver-catalogo" onClick={volverAlCatalogo}>
            <ChevronLeft size={16} />
            Seguir agregando productos
          </button>

          <div className="venta-carrito-lista">
            {carrito.map((item) => (
              <div key={item.producto_id} className="venta-carrito-item">
                <div className="venta-carrito-item-info">
                  <span className="venta-carrito-item-nombre">{item.nombre}</span>
                  <span className="venta-carrito-item-precio">
                    ${Number(item.precio_unitario).toLocaleString("es-CO")} c/u
                  </span>
                </div>

                <div className="venta-stepper venta-stepper-chico">
                  <button
                    type="button"
                    className="venta-stepper-btn"
                    onClick={() => ajustarCantidadCarrito(item.producto_id, -1)}
                  >
                    <Minus size={14} />
                  </button>
                  <span className="venta-stepper-valor">{item.cantidad}</span>
                  <button
                    type="button"
                    className="venta-stepper-btn"
                    onClick={() => ajustarCantidadCarrito(item.producto_id, 1)}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <span className="venta-carrito-item-subtotal">
                  ${(Number(item.precio_unitario) * item.cantidad).toLocaleString("es-CO")}
                </span>

                <button
                  className="venta-carrito-item-quitar"
                  onClick={() => quitarDelCarrito(item.producto_id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
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
          <select value={trabajadoraId} onChange={(e) => setTrabajadoraId(e.target.value)}>
            <option value="">Selecciona...</option>
            {trabajadoras.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>

          <div className="venta-total">
            <span>Total</span>
            <span>${totalCarrito.toLocaleString("es-CO")}</span>
          </div>

          <button className="venta-btn-primario" onClick={irAConfirmar}>
            Continuar
          </button>
        </div>
      )}

      {vista === "confirmando" && (
        <div className="venta-confirmacion">
          <div className="venta-confirmacion-icono">
            <ShoppingBag size={26} />
          </div>
          <h2>Confirmar venta</h2>

          <div className="venta-confirmacion-items">
            {carrito.map((item) => (
              <div key={item.producto_id} className="venta-resumen-fila">
                <span>
                  {item.cantidad} × {item.nombre}
                </span>
                <span>
                  ${(Number(item.precio_unitario) * item.cantidad).toLocaleString("es-CO")}
                </span>
              </div>
            ))}
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
            <span>${totalCarrito.toLocaleString("es-CO")}</span>
          </div>

          <div className="venta-confirmacion-botones">
            <button
              className="venta-btn-secundario"
              onClick={() => setVista("carrito")}
              disabled={enviando}
            >
              Volver
            </button>
            <button
              className="venta-btn-primario"
              onClick={confirmarOrden}
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