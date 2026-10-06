import { useEffect, useState } from "react";
import {
  ShoppingBag,
  Minus,
  Plus,
  Trash2,
  Send,
  Check,
  RefreshCw,
} from "lucide-react";
import { listarProductos } from "../../../api/productos";
import { obtenerMiCliente, listarPreciosEspeciales } from "../../../api/clientes";
import { crearSolicitud } from "../../../api/solicitudesPedido";
import "./PedidoArteFrio.css";

export default function PedidoArteFrio() {
  const [miCliente, setMiCliente] = useState(null);
  const [catalogo, setCatalogo] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [nota, setNota] = useState("");

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
     PANTALLA PRINCIPAL
     ========================= */

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
        <div className="pa-grid-productos">
          {catalogo.map((producto) => {
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
        </div>
      )}

      {carrito.length > 0 && (
        <div className="pa-resumen">
          <h2>Tu pedido ({totalItems})</h2>

          <div className="pa-resumen-lista">
            {carrito.map((item) => (
              <div key={item.producto_id} className="pa-resumen-fila">
                <span className="pa-resumen-nombre">{item.nombre}</span>

                <div className="pa-cantidad pa-cantidad-chica">
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
            disabled={enviando}
          >
            <Send size={16} />
            {enviando ? "Enviando..." : "Enviar pedido"}
          </button>
        </div>
      )}
    </div>
  );
}