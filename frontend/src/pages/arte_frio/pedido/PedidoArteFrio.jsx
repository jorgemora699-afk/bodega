import { useEffect, useState } from "react";
import {
  ShoppingBag,
  ShoppingCart,
  Minus,
  Plus,
  Trash2,
  Send,
  Check,
  RefreshCw,
  Search,
  ChevronLeft,
} from "lucide-react";
import { listarProductos } from "../../../api/productos";
import { obtenerMiCliente, listarPreciosEspeciales } from "../../../api/clientes";
import { crearSolicitud } from "../../../api/solicitudesPedido";
import "./PedidoArteFrio.css";

export default function PedidoArteFrio() {
  const [miCliente, setMiCliente] = useState(null);
  const [catalogo, setCatalogo] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [nota, setNota] = useState("");

  const [vista, setVista] = useState("catalogo"); // catalogo | carrito

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [pedidoEnviado, setPedidoEnviado] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargando(true);
    setError(null);

    try {
      const cliente = await obtenerMiCliente();
      setMiCliente(cliente);

      const [productos, precios] = await Promise.all([
        listarProductos(),
        listarPreciosEspeciales(cliente.id),
      ]);

      const mapaPrecios = {};
      precios.forEach((pe) => {
        mapaPrecios[pe.producto_id] = pe.precio;
      });

      const subset = productos
        .filter((p) => p.activo !== false && mapaPrecios[p.id] != null)
        .map((p) => ({
          ...p,
          precio_unitario: mapaPrecios[p.id],
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

      setCatalogo(subset);
    } catch (err) {
      setError(
        "No se pudo cargar tu catálogo de productos. Intenta de nuevo."
      );
    } finally {
      setCargando(false);
    }
  }

  function cantidadEnCarrito(productoId) {
    return carrito.find((i) => i.producto_id === productoId)?.cantidad || 0;
  }

  function agregarAlCarrito(producto) {
    if (Number(producto.stock_actual) <= 0) return;

    setCarrito((actual) => {
      const existente = actual.find((i) => i.producto_id === producto.id);

      if (existente) {
        if (existente.cantidad >= Number(producto.stock_actual)) return actual;
        return actual.map((i) =>
          i.producto_id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }

      return [...actual, { ...producto, producto_id: producto.id, cantidad: 1 }];
    });
  }

  function ajustarCantidad(productoId, delta) {
    setCarrito((actual) =>
      actual
        .map((i) => {
          if (i.producto_id !== productoId) return i;
          const nueva = i.cantidad + delta;
          const max = Number(i.stock_actual);
          if (nueva < 1 || nueva > max) return i;
          return { ...i, cantidad: nueva };
        })
    );
  }

  function quitarDelCarrito(productoId) {
    setCarrito((actual) => actual.filter((i) => i.producto_id !== productoId));
  }

  function obtenerEstadoStock(stock) {
    const cantidad = Number(stock);
    if (cantidad <= 0) return { clase: "agotado", texto: "Agotado" };
    if (cantidad <= 5) return { clase: "bajo", texto: `Quedan ${cantidad}` };
    return { clase: "disponible", texto: `${cantidad} disponibles` };
  }

  async function enviarPedido() {
    if (carrito.length === 0) {
      setError("Agrega al menos un producto a tu pedido");
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      const solicitud = await crearSolicitud({
        cliente_id: miCliente.id,
        nota: nota.trim() || undefined,
        items: carrito.map((i) => ({
          producto_id: i.producto_id,
          cantidad: i.cantidad,
        })),
      });

      setPedidoEnviado(solicitud);
      setCarrito([]);
      setNota("");
      setVista("catalogo");
    } catch (err) {
      setError(
        err.response?.data?.error || "No se pudo enviar el pedido. Intenta de nuevo."
      );
    } finally {
      setEnviando(false);
    }
  }

  function hacerOtroPedido() {
    setPedidoEnviado(null);
    cargarDatos();
  }

  function irAlCarrito() {
    setError(null);
    setVista("carrito");
  }

  function volverAlCatalogo() {
    setError(null);
    setVista("catalogo");
  }

  const totalItems = carrito.reduce((sum, i) => sum + i.cantidad, 0);
  const totalCarrito = carrito.reduce(
    (sum, i) => sum + Number(i.precio_unitario) * i.cantidad,
    0
  );

  const categorias = [
    ...new Set(catalogo.map((p) => p.categoria).filter(Boolean)),
  ].sort();

  const catalogoFiltrado = catalogo.filter((p) => {
    const coincideBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const coincideCategoria = !categoriaFiltro || p.categoria === categoriaFiltro;
    return coincideBusqueda && coincideCategoria;
  });

  /* =========================
     PANTALLA DE ÉXITO
     ========================= */

  if (pedidoEnviado) {
    return (
      <div className="pa-container">
        <div className="pa-exito">
          <div className="pa-exito-icono">
            <Check size={28} />
          </div>

          <h2>Pedido enviado</h2>
          <p>Punto Amarillo recibió tu pedido y lo va a preparar.</p>

          {pedidoEnviado.id && (
            <span className="pa-exito-numero">Pedido #{pedidoEnviado.id}</span>
          )}

          <div className="pa-exito-resumen">
            {pedidoEnviado.items.map((item) => (
              <div key={item.id} className="pa-exito-item">
                <span>{item.cantidad} × {item.producto_nombre}</span>
              </div>
            ))}
          </div>

          <button className="pa-btn-primario" onClick={hacerOtroPedido}>
            Hacer otro pedido
          </button>
        </div>
      </div>
    );
  }

  /* =========================
     CARGA / ERROR INICIAL
     ========================= */

  if (cargando) {
    return (
      <div className="pa-container">
        <p className="pa-cargando">Cargando tu catálogo...</p>
      </div>
    );
  }

  if (error && catalogo.length === 0) {
    return (
      <div className="pa-container">
        <div className="pa-mensaje-error">
          <span>{error}</span>
          <button onClick={cargarDatos}>
            <RefreshCw size={13} />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  /* =========================
     HEADER
     ========================= */

  return (
    <div className="pa-container">
      {vista !== "carrito" && (
        <header className="pa-header">
          {miCliente?.nombre && (
            <span className="pa-header-cliente">Pedido para: {miCliente.nombre}</span>
          )}
          <h1>Hacer pedido</h1>
          <p>Toca los productos que quieres pedirle a Punto Amarillo</p>
        </header>
      )}

      {error && <div className="pa-mensaje-error"><span>{error}</span></div>}

      {/* =========================
          VISTA: CATÁLOGO
          ========================= */}

      {vista === "catalogo" && (
        <>
          {catalogo.length === 0 ? (
            <p className="pa-sin-catalogo">
              Todavía no hay productos disponibles para pedir. Avísale al jefe de
              Punto Amarillo que configure tus precios especiales.
            </p>
          ) : (
            <>
              <div className="pa-buscador">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>

              {categorias.length > 0 && (
                <div className="pa-filtros-categoria">
                  <button
                    className={`pa-chip ${categoriaFiltro === "" ? "activo" : ""}`}
                    onClick={() => setCategoriaFiltro("")}
                  >
                    Todas
                  </button>
                  {categorias.map((c) => (
                    <button
                      key={c}
                      className={`pa-chip ${categoriaFiltro === c ? "activo" : ""}`}
                      onClick={() => setCategoriaFiltro(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}

              <div className="pa-grid-productos">
                {catalogoFiltrado.map((producto) => {
                  const stock = obtenerEstadoStock(producto.stock_actual);
                  const agotado = Number(producto.stock_actual) <= 0;
                  const enCarrito = cantidadEnCarrito(producto.id);

                  return (
                    <div
                      key={producto.id}
                      className={`pa-prod-card ${enCarrito > 0 ? "en-carrito" : ""} ${
                        agotado ? "agotado" : ""
                      }`}
                      onClick={() => !agotado && agregarAlCarrito(producto)}
                    >
                      <div className="pa-prod-imagen">
                        <ShoppingBag size={26} />
                        {agotado && <div className="pa-prod-overlay">Agotado</div>}
                        {enCarrito > 0 && (
                          <span className="pa-prod-badge">{enCarrito}</span>
                        )}
                      </div>

                      <div className="pa-prod-info">
                        <span className="pa-prod-nombre">{producto.nombre}</span>

                        <span className={`pa-prod-stock ${stock.clase}`}>
                          {stock.texto}
                        </span>

                        {enCarrito > 0 && (
                          <div
                            className="pa-cantidad"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => ajustarCantidad(producto.id, -1)}
                            >
                              <Minus size={14} />
                            </button>
                            <span>{enCarrito}</span>
                            <button
                              type="button"
                              disabled={enCarrito >= Number(producto.stock_actual)}
                              onClick={() => ajustarCantidad(producto.id, 1)}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {catalogoFiltrado.length === 0 && (
                  <p className="pa-sin-resultados">
                    Ningún producto coincide con "{busqueda}"
                  </p>
                )}
              </div>
            </>
          )}

          {carrito.length > 0 && (
            <button className="pa-carrito-fab" onClick={irAlCarrito}>
              <span className="pa-carrito-fab-info">
                <ShoppingCart size={18} />
                {totalItems} producto{totalItems !== 1 ? "s" : ""}
              </span>
              <span className="pa-carrito-fab-total">
                ${totalCarrito.toLocaleString("es-CO")}
              </span>
            </button>
          )}
        </>
      )}

      {/* =========================
          VISTA: CARRITO / REVISAR PEDIDO
          ========================= */}

      {vista === "carrito" && (
        <div className="pa-detalle">
          <button className="pa-volver-catalogo" onClick={volverAlCatalogo}>
            <ChevronLeft size={16} />
            Seguir agregando productos
          </button>

          <h2 className="pa-detalle-titulo">Revisa tu pedido</h2>

          <div className="pa-resumen-lista">
            {carrito.map((item) => (
              <div key={item.producto_id} className="pa-resumen-fila">
                <div className="pa-resumen-fila-info">
                  <span className="pa-resumen-nombre">{item.nombre}</span>
                  <span className="pa-resumen-precio-unit">
                    ${Number(item.precio_unitario).toLocaleString("es-CO")} c/u
                  </span>
                </div>

                <div className="pa-cantidad">
                  <button
                    type="button"
                    onClick={() => ajustarCantidad(item.producto_id, -1)}
                  >
                    <Minus size={13} />
                  </button>
                  <span>{item.cantidad}</span>
                  <button
                    type="button"
                    disabled={item.cantidad >= Number(item.stock_actual)}
                    onClick={() => ajustarCantidad(item.producto_id, 1)}
                  >
                    <Plus size={13} />
                  </button>
                </div>

                <span className="pa-resumen-subtotal">
                  ${(Number(item.precio_unitario) * item.cantidad).toLocaleString("es-CO")}
                </span>

                <button
                  className="pa-resumen-quitar"
                  onClick={() => quitarDelCarrito(item.producto_id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {carrito.length === 0 && (
              <p className="pa-sin-resultados">
                Tu pedido quedó vacío — vuelve al catálogo para agregar productos
              </p>
            )}
          </div>

          <label htmlFor="pa-nota">Nota (opcional)</label>
          <textarea
            id="pa-nota"
            rows={2}
            maxLength={300}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ej: Para las 6pm, 2 sin cebolla"
          />

          <div className="pa-total">
            <span>Total</span>
            <span>${totalCarrito.toLocaleString("es-CO")}</span>
          </div>

          <button
            className="pa-btn-primario pa-btn-enviar"
            onClick={enviarPedido}
            disabled={enviando || carrito.length === 0}
          >
            <Send size={16} />
            {enviando ? "Enviando..." : "Enviar pedido"}
          </button>
        </div>
      )}
    </div>
  );
}