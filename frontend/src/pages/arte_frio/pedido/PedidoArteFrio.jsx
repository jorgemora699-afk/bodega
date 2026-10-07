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

/* =========================
   CONTROL DE CANTIDAD

   Va FUERA del componente a propósito: si se define dentro, React lo
   vuelve a crear en cada render y el campo pierde el foco tras cada tecla.
   ========================= */

function CantidadControl({ cantidad, max, nombre, onDecrementar, onIncrementar, className = "" }) {
  return (
    <div className={`pa-cantidad ${className}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={`Quitar una unidad de ${nombre}`}
        onClick={onDecrementar}
      >
        <Minus size={14} />
      </button>
      <span>{cantidad}</span>
      <button
        type="button"
        aria-label={`Agregar una unidad de ${nombre}`}
        disabled={cantidad >= max}
        onClick={onIncrementar}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

export default function PedidoArteFrio() {
  const [miCliente, setMiCliente] = useState(null);
  const [catalogo, setCatalogo] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [nota, setNota] = useState("");

  const [vista, setVista] = useState("catalogo"); // "catalogo" | "carrito"

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

  function restarDelCarrito(productoId) {
    setCarrito((actual) =>
      actual.flatMap((i) => {
        if (i.producto_id !== productoId) return [i];
        if (i.cantidad <= 1) return [];
        return [{ ...i, cantidad: i.cantidad - 1 }];
      })
    );
  }

  function ajustarCantidad(productoId, delta) {
    setCarrito((actual) =>
      actual.map((i) => {
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

  function irAlCarrito() {
    setError(null);
    setVista("carrito");
  }

  function volverAlCatalogo() {
    setError(null);
    setVista("catalogo");
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

  const totalItems = carrito.reduce((sum, i) => sum + i.cantidad, 0);

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
     VISTA: CATÁLOGO
     ========================= */

  if (vista === "catalogo") {
    return (
      <div className="pa-container">
        <header className="pa-header">
          <h1>Hacer pedido</h1>
          <p>Toca los productos que quieres pedirle a Punto Amarillo</p>
        </header>

        {error && <div className="pa-mensaje-error"><span>{error}</span></div>}

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
                    </div>

                    <div className="pa-prod-info">
                      <span className="pa-prod-nombre">{producto.nombre}</span>

                      <span className={`pa-prod-stock ${stock.clase}`}>
                        {stock.texto}
                      </span>

                      {enCarrito > 0 && (
                        <CantidadControl
                          className="pa-cantidad-tarjeta"
                          nombre={producto.nombre}
                          cantidad={enCarrito}
                          max={Number(producto.stock_actual)}
                          onDecrementar={() => restarDelCarrito(producto.id)}
                          onIncrementar={() => agregarAlCarrito(producto)}
                        />
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
          <button className="pa-fab" onClick={irAlCarrito}>
            <span className="pa-fab-info">
              <ShoppingCart size={18} />
              {totalItems} producto{totalItems !== 1 ? "s" : ""}
            </span>
            <span className="pa-fab-flecha">Revisar pedido →</span>
          </button>
        )}
      </div>
    );
  }

  /* =========================
     VISTA: REVISAR PEDIDO (checkout)
     ========================= */

  return (
    <div className="pa-container">
      <div className="pa-detalle">
        <button className="pa-volver-catalogo" onClick={volverAlCatalogo}>
          <ChevronLeft size={16} />
          Seguir agregando productos
        </button>

        <h2 className="pa-detalle-titulo">Tu pedido ({totalItems})</h2>

        {error && <div className="pa-mensaje-error"><span>{error}</span></div>}

        <div className="pa-resumen-lista">
          {carrito.map((item) => (
            <div key={item.producto_id} className="pa-resumen-fila">
              <span className="pa-resumen-nombre">{item.nombre}</span>

              <CantidadControl
                className="pa-cantidad-chica"
                nombre={item.nombre}
                cantidad={item.cantidad}
                max={Number(item.stock_actual)}
                onDecrementar={() => ajustarCantidad(item.producto_id, -1)}
                onIncrementar={() => ajustarCantidad(item.producto_id, 1)}
              />

              <button
                className="pa-resumen-quitar"
                onClick={() => quitarDelCarrito(item.producto_id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
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

        <button
          className="pa-btn-primario pa-btn-enviar"
          onClick={enviarPedido}
          disabled={enviando || carrito.length === 0}
        >
          <Send size={16} />
          {enviando ? "Enviando..." : "Enviar pedido"}
        </button>
      </div>
    </div>
  );
}