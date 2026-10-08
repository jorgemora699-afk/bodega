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
   HELPERS
   ========================= */

function claveCarrito(clienteId) {
  return `pa_carrito_v1_${clienteId}`;
}

function leerCarritoGuardado(clienteId) {
  try {
    const crudo = localStorage.getItem(claveCarrito(clienteId));
    return crudo ? JSON.parse(crudo) : null;
  } catch {
    return null;
  }
}

function stockMaximo(producto) {
  return Math.max(0, Math.floor(Number(producto.stock_actual)));
}

/* =========================
   CONTROL DE CANTIDAD (editable)
   ========================= */

function CantidadInput({ valor, max, onCambiar, tamano = 14 }) {
  const [texto, setTexto] = useState(String(valor));

  // Si la cantidad cambia desde afuera (botones, stock), sincroniza el texto
  useEffect(() => {
    setTexto(String(valor));
  }, [valor]);

  function confirmar() {
    const n = parseInt(texto, 10);
    if (Number.isNaN(n) || n < 1) {
      setTexto(String(valor));
      return;
    }
    const final = Math.min(n, max);
    setTexto(String(final));
    if (final !== valor) onCambiar(final);
  }

  return (
    <div className="pa-cantidad" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label="Quitar uno"
        disabled={valor <= 1}
        onClick={() => onCambiar(valor - 1)}
      >
        <Minus size={tamano} />
      </button>

      <input
        type="text"
        inputMode="numeric"
        aria-label="Cantidad"
        value={texto}
        onChange={(e) => setTexto(e.target.value.replace(/\D/g, "").slice(0, 4))}
        onFocus={(e) => e.target.select()}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.target.blur();
        }}
      />

      <button
        type="button"
        aria-label="Agregar uno"
        disabled={valor >= max}
        onClick={() => onCambiar(valor + 1)}
      >
        <Plus size={tamano} />
      </button>
    </div>
  );
}

/* =========================
   PANTALLA
   ========================= */

export default function PedidoArteFrio() {
  const [miCliente, setMiCliente] = useState(null);
  const [catalogo, setCatalogo] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [carritoListo, setCarritoListo] = useState(false); // ya se leyó localStorage
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

  /* Guarda el carrito y la nota cada vez que cambian */
  useEffect(() => {
    if (!carritoListo || !miCliente) return;

    try {
      const clave = claveCarrito(miCliente.id);
      if (carrito.length === 0 && !nota.trim()) {
        localStorage.removeItem(clave);
      } else {
        localStorage.setItem(
          clave,
          JSON.stringify({
            items: carrito.map((i) => ({
              producto_id: i.producto_id,
              cantidad: i.cantidad,
            })),
            nota,
          })
        );
      }
    } catch {
      /* sin localStorage (modo privado, etc.): el pedido sigue funcionando */
    }
  }, [carrito, nota, carritoListo, miCliente]);

  /* Reconstruye el carrito guardado con los datos frescos del catálogo:
     precios y stock actuales, y descarta lo que ya no se puede pedir. */
  function restaurarCarrito(clienteId, productosVigentes) {
    const guardado = leerCarritoGuardado(clienteId);

    if (guardado && Array.isArray(guardado.items)) {
      const items = guardado.items
        .map((g) => {
          const producto = productosVigentes.find((p) => p.id === g.producto_id);
          if (!producto) return null;

          const max = stockMaximo(producto);
          if (max < 1) return null;

          const cantidad = Math.min(
            Math.max(1, Math.floor(Number(g.cantidad)) || 1),
            max
          );
          return { ...producto, producto_id: producto.id, cantidad };
        })
        .filter(Boolean);

      setCarrito(items);
      setNota(typeof guardado.nota === "string" ? guardado.nota : "");
    }

    setCarritoListo(true);
  }

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
      restaurarCarrito(cliente.id, subset);
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
    if (stockMaximo(producto) < 1) return;

    setCarrito((actual) => {
      const existente = actual.find((i) => i.producto_id === producto.id);

      if (existente) {
        if (existente.cantidad >= stockMaximo(producto)) return actual;
        return actual.map((i) =>
          i.producto_id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }

      return [...actual, { ...producto, producto_id: producto.id, cantidad: 1 }];
    });
  }

  /* Fija la cantidad exacta (la usan los botones +/- y el campo editable) */
  function fijarCantidad(productoId, nueva) {
    setCarrito((actual) =>
      actual.map((i) => {
        if (i.producto_id !== productoId) return i;
        const cantidad = Math.min(Math.max(1, nueva), stockMaximo(i));
        return { ...i, cantidad };
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
      setCarrito([]); // el efecto de arriba borra el carrito guardado
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
                  const agotado = stockMaximo(producto) < 1;
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
                          <CantidadInput
                            valor={enCarrito}
                            max={stockMaximo(producto)}
                            onCambiar={(n) => fijarCantidad(producto.id, n)}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}

                {catalogoFiltrado.length === 0 && (
                  <p className="pa-sin-resultados">
                    {busqueda
                      ? `Ningún producto coincide con "${busqueda}"`
                      : "No hay productos en esta categoría"}
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

                <CantidadInput
                  valor={item.cantidad}
                  max={stockMaximo(item)}
                  tamano={13}
                  onCambiar={(n) => fijarCantidad(item.producto_id, n)}
                />

                <span className="pa-resumen-subtotal">
                  ${(Number(item.precio_unitario) * item.cantidad).toLocaleString("es-CO")}
                </span>

                <button
                  className="pa-resumen-quitar"
                  aria-label={`Quitar ${item.nombre}`}
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