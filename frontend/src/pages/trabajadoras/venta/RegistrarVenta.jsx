import { useEffect, useState } from "react";
import {
  ShoppingBag,
  ShoppingCart,
  Minus,
  Plus,
  Trash2,
  Banknote,
  ArrowLeftRight,
  Receipt,
  Check,
  Search,
  ChevronLeft,
  Printer,
  UserPlus,
  User,
  Building2,
  X,
  Clock3,
} from "lucide-react";
import { listarProductos } from "../../../api/productos";
import { listarTrabajadoras } from "../../../api/trabajadoras";
import { crearOrden } from "../../../api/ordenes";
import { listarClientes, crearCliente, listarPreciosEspeciales } from "../../../api/clientes";
import "./RegistrarVenta.css";

const METODOS_PAGO = [
  { valor: "efectivo", label: "Efectivo", Icon: Banknote },
  { valor: "transferencia", label: "Transferencia", Icon: ArrowLeftRight },
  { valor: "credito", label: "Cuenta por cobrar", Icon: Receipt },
];

const CLAVE_CARRITO = "pa_venta_carrito";
const CLAVE_TRABAJADORA = "pa_venta_trabajadora";
const BILLETES = [5000, 10000, 20000, 50000, 100000];

const CLIENTE_VACIO = {
  tipo: "natural",
  nombre: "",
  documento: "",
  contacto: "",
  celular: "",
  direccion: "",
};

/* =========================
   CARRITO — clave de línea

   Un producto normal se identifica solo por su id. Un paquete "mixto" (ej.
   Paquete de empanadas mixta) puede tener varias líneas con el mismo
   producto_id pero sabores distintos (Pollo+Carne vs Pollo+Queso son líneas
   separadas), así que su clave incluye también la selección, ordenada para
   que el orden en que se eligieron los sabores no importe.
   ========================= */

function claveCarrito(productoId, seleccion) {
  if (!seleccion || seleccion.length === 0) return String(productoId);
  return `${productoId}:${[...seleccion].sort((a, b) => a - b).join("-")}`;
}

/* =========================
   FECHA (yyyy-mm-dd local, para el input type="date")
   ========================= */

function hoyISO() {
  const hoy = new Date();
  const offset = hoy.getTimezoneOffset();
  const local = new Date(hoy.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function formatearFechaCorta(fechaISO) {
  return new Date(fechaISO + "T00:00:00").toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function esAdminActual() {
  try {
    return localStorage.getItem("rol") === "jefe";
  } catch {
    return false;
  }
}

/* =========================
   STORAGE (a prueba de fallos)
   ========================= */

function leerCarritoGuardado() {
  try {
    const raw = sessionStorage.getItem(CLAVE_CARRITO);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function leerTrabajadoraGuardada() {
  try {
    return localStorage.getItem(CLAVE_TRABAJADORA) || "";
  } catch {
    return "";
  }
}

/* =========================
   CONTROL DE CANTIDAD (botones + escribir)

   Va FUERA de RegistrarVenta a propósito: si se define dentro,
   React lo vuelve a crear en cada render y el campo pierde el
   foco después de cada tecla.
   ========================= */

function CantidadControl({
  cantidad,
  max,
  nombre,
  onDecrementar,
  onIncrementar,
  onEscribir,
  deshabilitarMenos = false,
  className = "",
}) {
  // null = no se está editando; se muestra la cantidad real del carrito
  const [borrador, setBorrador] = useState(null);

  function manejarCambio(e) {
    const limpio = e.target.value.replace(/\D/g, "").slice(0, 4);

    if (limpio === "") {
      setBorrador("");
      return;
    }

    const numero = Math.min(Number(limpio), max);

    if (numero < 1) {
      setBorrador(limpio);
      return;
    }

    setBorrador(String(numero));
    onEscribir(numero);
  }

  return (
    <div
      className={`venta-cantidad ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="venta-cantidad-btn"
        aria-label={`Quitar una unidad de ${nombre}`}
        disabled={deshabilitarMenos}
        onClick={onDecrementar}
      >
        <Minus size={16} />
      </button>

      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="venta-cantidad-input"
        aria-label={`Cantidad de ${nombre}`}
        value={borrador ?? String(cantidad)}
        onChange={manejarCambio}
        onFocus={(e) => {
          setBorrador(String(cantidad));
          e.target.select();
        }}
        onBlur={() => setBorrador(null)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />

      <button
        type="button"
        className="venta-cantidad-btn mas"
        aria-label={`Agregar una unidad de ${nombre}`}
        disabled={cantidad >= max}
        onClick={onIncrementar}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

export default function RegistrarVenta() {
  const [productos, setProductos] = useState([]);
  const [trabajadoras, setTrabajadoras] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");

  const [carrito, setCarrito] = useState(leerCarritoGuardado);
  const [vista, setVista] = useState("catalogo");

  const [metodoPago, setMetodoPago] = useState("");
  const [trabajadoraId, setTrabajadoraId] = useState(leerTrabajadoraGuardada);
  const [recibido, setRecibido] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [mostrarSelectorCliente, setMostrarSelectorCliente] = useState(false);

  /* Solo el jefe puede elegir una fecha distinta a hoy (venta de días anteriores) */
  const esAdmin = esAdminActual();
  const [fechaVenta, setFechaVenta] = useState(hoyISO);

  /* Cuenta por cobrar: selección/creación de cliente */
  const [clienteId, setClienteId] = useState("");
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [clientesResultados, setClientesResultados] = useState([]);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [mostrarFormCliente, setMostrarFormCliente] = useState(false);
  const [formCliente, setFormCliente] = useState(CLIENTE_VACIO);
  const [creandoCliente, setCreandoCliente] = useState(false);
  const [errorCliente, setErrorCliente] = useState(null);

  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  const [reciboOrden, setReciboOrden] = useState(null);
  const [reciboEfectivo, setReciboEfectivo] = useState(null);
  const [preciosEspeciales, setPreciosEspeciales] = useState({});

  /* Selector de sabores para paquetes "mixtos" (ej. Paquete de empanadas mixta) */
  const [selectorPaquete, setSelectorPaquete] = useState(null);
  const [seleccionActual, setSeleccionActual] = useState([]);

  useEffect(() => {
    cargarDatos();
  }, []);

  /* Guardar el carrito para que sobreviva a una recarga */
  useEffect(() => {
    try {
      if (carrito.length > 0) {
        sessionStorage.setItem(CLAVE_CARRITO, JSON.stringify(carrito));
      } else {
        sessionStorage.removeItem(CLAVE_CARRITO);
      }
    } catch {
      /* si el storage no está disponible, se ignora */
    }
  }, [carrito]);

  /* Sincronizar el carrito con el stock y precios más recientes */
  useEffect(() => {
    if (productos.length === 0) return;

    setCarrito((actual) => {
      if (actual.length === 0) return actual;

      return actual.reduce((acc, item) => {
        const p = productos.find((x) => x.id === item.producto_id);
        if (!p) return acc;

        if (p.requiere_seleccion) {
          // El stock real de un paquete mixto lo determinan los sabores
          // elegidos, no el producto en sí; se conserva la línea tal cual
          // (el backend valida el stock real de cada sabor al confirmar).
          acc.push({
            ...p,
            producto_id: p.id,
            cantidad: item.cantidad,
            clave: item.clave,
            seleccion: item.seleccion,
            seleccion_nombres: item.seleccion_nombres,
          });
          return acc;
        }

        const stock = Number(p.stock_actual);
        if (stock <= 0) return acc;

        acc.push({
          ...p,
          producto_id: p.id,
          cantidad: Math.min(item.cantidad, stock),
          clave: item.clave,
        });

        return acc;
      }, []);
    });
  }, [productos]);

  /* Buscar clientes con un pequeño debounce, solo si no hay uno ya elegido */
  useEffect(() => {
    if (metodoPago !== "credito" || clienteSeleccionado) return undefined;

    const termino = busquedaCliente.trim();

    if (termino.length < 2) {
      setClientesResultados([]);
      return undefined;
    }

    let activo = true;
    setBuscandoClientes(true);

    const temporizador = setTimeout(async () => {
      try {
        const data = await listarClientes({ buscar: termino });
        if (activo) setClientesResultados(data);
      } catch (err) {
        if (activo) setClientesResultados([]);
      } finally {
        if (activo) setBuscandoClientes(false);
      }
    }, 350);

    return () => {
      activo = false;
      clearTimeout(temporizador);
    };
  }, [busquedaCliente, metodoPago, clienteSeleccionado]);

  /* Precios especiales del cliente elegido — se recargan cada vez que cambia */
  useEffect(() => {
    if (!clienteId) {
      setPreciosEspeciales({});
      return undefined;
    }

    let activo = true;

    listarPreciosEspeciales(Number(clienteId))
      .then((data) => {
        if (!activo) return;
        const mapa = {};
        data.forEach((pe) => {
          mapa[pe.producto_id] = pe.precio;
        });
        setPreciosEspeciales(mapa);
      })
      .catch(() => {
        if (activo) setPreciosEspeciales({});
      });

    return () => {
      activo = false;
    };
  }, [clienteId]);

  async function cargarDatos() {
    try {
      const [productosData, trabajadorasData] = await Promise.all([
        listarProductos(),
        listarTrabajadoras(),
      ]);

      setProductos(productosData);
      setTrabajadoras(trabajadorasData);

      /* Si la trabajadora recordada ya no existe, se limpia */
      setTrabajadoraId((prev) =>
        prev && trabajadorasData.some((t) => String(t.id) === String(prev))
          ? prev
          : ""
      );
    } catch (err) {
      setError("No se pudieron cargar los datos. Revisa tu conexión.");
    }
  }

  function elegirTrabajadora(id) {
    setTrabajadoraId(id);

    try {
      if (id) {
        localStorage.setItem(CLAVE_TRABAJADORA, id);
      } else {
        localStorage.removeItem(CLAVE_TRABAJADORA);
      }
    } catch {
      /* se ignora */
    }
  }

  function cantidadEnCarrito(productoId) {
    return carrito.find((i) => i.producto_id === productoId)?.cantidad || 0;
  }

  /* Total en el carrito de un producto "mixto", sumando todas sus
     combinaciones de sabores (para el contador en la tarjeta del catálogo) */
  function totalEnCarritoMixto(productoId) {
    return carrito
      .filter((i) => i.producto_id === productoId)
      .reduce((sum, i) => sum + i.cantidad, 0);
  }

  function agregarAlCarrito(producto, seleccion = null) {
    if (!producto.requiere_seleccion && Number(producto.stock_actual) <= 0) {
      return;
    }

    const clave = claveCarrito(producto.id, seleccion);
    const seleccionNombres = seleccion
      ? seleccion.map((id) => productos.find((p) => p.id === id)?.nombre || "")
      : undefined;

    setCarrito((actual) => {
      const existente = actual.find((item) => item.clave === clave);
      const max = producto.requiere_seleccion ? 9999 : Number(producto.stock_actual);

      if (existente) {
        if (existente.cantidad >= max) {
          return actual;
        }

        return actual.map((item) =>
          item.clave === clave
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }

      return [
        ...actual,
        {
          ...producto,
          producto_id: producto.id,
          cantidad: 1,
          clave,
          seleccion: seleccion || undefined,
          seleccion_nombres: seleccionNombres,
        },
      ];
    });
  }

  /* Resta una unidad desde la tarjeta o el carrito; si llega a 0, la quita */
  function restarDelCarrito(clave) {
    setCarrito((actual) =>
      actual.flatMap((item) => {
        if (item.clave !== clave) return [item];
        if (item.cantidad <= 1) return [];
        return [{ ...item, cantidad: item.cantidad - 1 }];
      })
    );
  }

  function ajustarCantidadCarrito(clave, delta) {
    setCarrito((actual) =>
      actual.map((item) => {
        if (item.clave !== clave) return item;

        const nuevaCantidad = item.cantidad + delta;
        const max = item.requiere_seleccion ? 9999 : Number(item.stock_actual);

        if (nuevaCantidad < 1) return item;
        if (nuevaCantidad > max) return item;

        return {
          ...item,
          cantidad: nuevaCantidad,
        };
      })
    );
  }

  /* Fija una cantidad exacta (cuando la escriben con el teclado) */
  function establecerCantidad(clave, cantidad) {
    setCarrito((actual) =>
      actual.map((item) => {
        if (item.clave !== clave) return item;

        const max = item.requiere_seleccion ? 9999 : Number(item.stock_actual);
        const nueva = Math.max(1, Math.min(cantidad, max));

        return { ...item, cantidad: nueva };
      })
    );
  }

  function obtenerEstadoStock(stock) {
    const cantidad = Number(stock);

    if (cantidad <= 0) {
      return {
        clase: "agotado",
        texto: "Agotado",
      };
    }

    if (cantidad <= 5) {
      return {
        clase: "bajo",
        texto: `Poco stock · ${cantidad} disponibles`,
      };
    }

    return {
      clase: "disponible",
      texto: `${cantidad} disponibles`,
    };
  }

  function precioEfectivo(producto) {
    const idProducto = producto.producto_id ?? producto.id;
    const especial = preciosEspeciales[idProducto];
    return especial != null ? Number(especial) : Number(producto.precio_unitario);
  }

  function tienePrecioEspecial(producto) {
    const idProducto = producto.producto_id ?? producto.id;
    return preciosEspeciales[idProducto] != null;
  }

  function quitarDelCarrito(clave) {
    setCarrito((prev) => prev.filter((i) => i.clave !== clave));
  }

  function irAlCarrito() {
    setError(null);
    setVista("carrito");
  }

  function volverAlCatalogo() {
    setError(null);
    setVista("catalogo");
  }

  function cambiarRecibido(valor) {
    setRecibido(valor.replace(/\D/g, "").slice(0, 9));
  }

  /* ---------- Método de pago ---------- */

  function cambiarMetodoPago(valor) {
    setMetodoPago(valor);
    setError(null);

    if (valor !== "efectivo") {
      setRecibido("");
    }
  }

  /* ---------- Cliente (cuenta por cobrar) ---------- */

  function limpiarCliente() {
    setClienteId("");
    setClienteSeleccionado(null);
    setBusquedaCliente("");
    setClientesResultados([]);
    setMostrarFormCliente(false);
    setFormCliente(CLIENTE_VACIO);
    setErrorCliente(null);
    setMostrarSelectorCliente(false); // ← agregar
  }

  function elegirCliente(cliente) {
    setClienteId(String(cliente.id));
    setClienteSeleccionado(cliente);
    setBusquedaCliente("");
    setClientesResultados([]);
    setMostrarFormCliente(false);
  }

  function cambiarClienteSeleccionado() {
    setClienteId("");
    setClienteSeleccionado(null);
  }

  function abrirFormCliente() {
    setMostrarFormCliente(true);
    setFormCliente({ ...CLIENTE_VACIO, nombre: busquedaCliente });
    setErrorCliente(null);
  }

  function cerrarFormCliente() {
    setMostrarFormCliente(false);
    setFormCliente(CLIENTE_VACIO);
    setErrorCliente(null);
  }

  function cambiarTipoCliente(tipo) {
    setFormCliente((f) => ({
      ...f,
      tipo,
      contacto: tipo === "natural" ? "" : f.contacto,
    }));
  }

  async function guardarNuevoCliente() {
    const nombre = formCliente.nombre.trim();
    const documento = formCliente.documento.trim();

    if (!nombre || !documento) {
      setErrorCliente(
        formCliente.tipo === "juridica"
          ? "Ingresa la razón social y el NIT"
          : "Ingresa el nombre y la cédula"
      );
      return;
    }

    setCreandoCliente(true);
    setErrorCliente(null);

    try {
      const cliente = await crearCliente({
        tipo: formCliente.tipo,
        nombre,
        documento,
        contacto: formCliente.tipo === "juridica" ? formCliente.contacto.trim() || null : null,
        celular: formCliente.celular.trim() || null,
        direccion: formCliente.direccion.trim() || null,
      });

      elegirCliente(cliente);
    } catch (err) {
      setErrorCliente(
        err.response?.data?.error || "No se pudo crear el cliente"
      );
    } finally {
      setCreandoCliente(false);
    }
  }

  /* ---------- Paquetes "mixtos" (ej. Paquete de empanadas mixta) ---------- */

  function abrirSelectorPaquete(producto) {
    setSelectorPaquete(producto);
    setSeleccionActual([]);
  }

  function cerrarSelectorPaquete() {
    setSelectorPaquete(null);
    setSeleccionActual([]);
  }

  function alternarSaborSeleccionado(id) {
    setSeleccionActual((actual) => {
      if (actual.includes(id)) {
        return actual.filter((x) => x !== id);
      }
      if (actual.length >= (selectorPaquete?.cantidad_seleccion || 0)) {
        return actual;
      }
      return [...actual, id];
    });
  }

  function confirmarSelectorPaquete() {
    if (!selectorPaquete) return;
    if (seleccionActual.length !== selectorPaquete.cantidad_seleccion) return;

    agregarAlCarrito(selectorPaquete, seleccionActual);
    cerrarSelectorPaquete();
  }

  const saboresDisponibles = selectorPaquete
    ? productos.filter(
        (p) =>
          p.categoria === selectorPaquete.categoria_seleccion &&
          p.activo !== false &&
          Number(p.stock_actual) > 0
      )
    : [];

  /* ---------- Confirmar / enviar ---------- */

  function irAConfirmar() {
    if (carrito.length === 0) {
      setError("Agrega al menos un producto al carrito");
      return;
    }

    if (!metodoPago || !trabajadoraId) {
      setError("Selecciona método de pago y quién realiza la venta");
      return;
    }

    if (metodoPago === "credito" && !clienteId) {
      setError("Selecciona o crea el cliente para la cuenta por cobrar");
      return;
    }

    if (
      metodoPago === "efectivo" &&
      recibidoNum > 0 &&
      recibidoNum < totalCarrito
    ) {
      setError("El efectivo recibido es menor al total de la venta");
      return;
    }

    setError(null);
    setVista("confirmando");
  }

  async function confirmarOrden() {
    setEnviando(true);
    setError(null);

    try {
      const orden = await crearOrden({
        trabajadora_id: Number(trabajadoraId),
        metodo_pago: metodoPago,
        cliente_id: clienteId ? Number(clienteId) : undefined,
        descripcion: descripcion.trim() || undefined,
        // Solo el jefe puede mandar una fecha distinta a hoy; para las
        // trabajadoras esto no se envía y el backend usa la fecha/hora actual.
        fecha: esAdmin && fechaVenta !== hoyISO() ? fechaVenta : undefined,
        items: carrito.map((i) => ({
          producto_id: i.producto_id,
          cantidad: i.cantidad,
          ...(i.seleccion ? { seleccion: i.seleccion } : {}),
        })),
      });

      setReciboEfectivo(
        tieneRecibido
          ? { recibido: recibidoNum, cambio: recibidoNum - totalCarrito }
          : null
      );
      setReciboOrden(orden);
      setCarrito([]);
      setMetodoPago("");
      setRecibido("");
      setDescripcion("");
      setFechaVenta(hoyISO());
      limpiarCliente();
      setMensaje(null);
      setVista("recibo");

      await cargarDatos();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "No se pudo registrar la venta"
      );
      setVista("carrito");
    } finally {
      setEnviando(false);
    }
  }

  function nuevaVenta() {
    setReciboOrden(null);
    setReciboEfectivo(null);
    setRecibido("");
    setDescripcion("");
    setFechaVenta(hoyISO());
    limpiarCliente();
    setMensaje(null);
    setError(null);
    setBusqueda("");
    setCategoriaFiltro("");
    setVista("catalogo");
  }

  function formatearFechaRecibo(isoString) {
    if (!isoString) return "";

    return new Date(isoString).toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function etiquetaMetodoPago(valor) {
    if (valor === "credito") return "Cuenta por cobrar";
    if (valor === "efectivo") return "Efectivo";
    if (valor === "transferencia") return "Transferencia";
    return valor;
  }

  const categorias = [
    ...new Set(
      productos.map((p) => p.categoria).filter(Boolean)
    ),
  ].sort();

  const productosFiltrados = productos.filter((p) => {
    const coincideBusqueda = p.nombre
      .toLowerCase()
      .includes(busqueda.toLowerCase());

    const coincideCategoria =
      !categoriaFiltro || p.categoria === categoriaFiltro;

    return coincideBusqueda && coincideCategoria;
  });

  const totalCarrito = carrito.reduce(
    (sum, i) => sum + precioEfectivo(i) * i.cantidad,
    0
  );

  const cantidadTotalCarrito = carrito.reduce(
    (sum, i) => sum + i.cantidad,
    0
  );

  /* Calculadora de efectivo */
  const recibidoNum = Number(recibido) || 0;
  const tieneRecibido = metodoPago === "efectivo" && recibidoNum > 0;
  const cambio = recibidoNum - totalCarrito;
  const billetesSugeridos = BILLETES.filter((b) => b > totalCarrito).slice(0, 3);

  const esCredito = metodoPago === "credito";
  const fechaEsAtrasada = esAdmin && fechaVenta !== hoyISO();

  return (
    <div className="venta-container">

      {/* =========================
          HEADER
          ========================= */}

      {vista !== "confirmando" && vista !== "recibo" && (
        <header className="venta-header">
          <h1>Registrar venta</h1>

          <p>
            {vista === "catalogo"
              ? "Toca los productos para agregarlos al carrito"
              : "Revisa el pedido antes de confirmar"}
          </p>
        </header>
      )}

      {/* =========================
          MENSAJES
          ========================= */}

      {mensaje && (
        <div className="venta-mensaje-exito">
          <Check size={16} />
          {mensaje}
        </div>
      )}

      {error && (
        <div className="venta-mensaje-error">
          {error}
        </div>
      )}

      {/* =========================
          CATÁLOGO
          ========================= */}

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
                  onChange={(e) =>
                    setBusqueda(e.target.value)
                  }
                />
              </div>

              {categorias.length > 0 && (
                <div className="venta-filtros-categoria">
                  <button
                    className={`venta-chip ${
                      categoriaFiltro === ""
                        ? "activo"
                        : ""
                    }`}
                    onClick={() =>
                      setCategoriaFiltro("")
                    }
                  >
                    Todas
                  </button>

                  {categorias.map((c) => (
                    <button
                      key={c}
                      className={`venta-chip ${
                        categoriaFiltro === c
                          ? "activo"
                          : ""
                      }`}
                      onClick={() =>
                        setCategoriaFiltro(c)
                      }
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
              const stock = obtenerEstadoStock(
                producto.stock_actual
              );

              const agotado =
                !producto.requiere_seleccion &&
                Number(producto.stock_actual) <= 0;

              const enCarrito =
                cantidadEnCarrito(producto.id);

              const enCarritoMixto = producto.requiere_seleccion
                ? totalEnCarritoMixto(producto.id)
                : 0;

              return (
                <div
                  key={producto.id}
                  className={`venta-prod-card ${
                    enCarrito > 0 || enCarritoMixto > 0
                      ? "en-carrito"
                      : ""
                  } ${
                    agotado ? "agotado" : ""
                  }`}
                  onClick={() => {
                    if (agotado) return;
                    if (producto.requiere_seleccion) {
                      abrirSelectorPaquete(producto);
                    } else {
                      agregarAlCarrito(producto);
                    }
                  }}
                >
                  <div className="venta-prod-imagen">
                    <ShoppingBag size={28} />

                    {agotado && (
                      <div className="venta-prod-overlay">
                        Agotado
                      </div>
                    )}
                  </div>

                  <div className="venta-prod-info">
                    <span className="venta-prod-nombre">
                      {producto.nombre}
                    </span>

                    <span className="venta-prod-precio">
                      {tienePrecioEspecial(producto) && (
                        <span className="venta-precio-tachado">
                          ${Number(producto.precio_unitario).toLocaleString("es-CO")}
                        </span>
                      )}
                      ${precioEfectivo(producto).toLocaleString("es-CO")}
                    </span>

                    {producto.requiere_seleccion ? (
                      <span className="venta-prod-stock disponible">
                        <span className="venta-stock-dot"></span>
                        Elige {producto.cantidad_seleccion} sabores
                      </span>
                    ) : (
                      <span
                        className={`venta-prod-stock ${stock.clase}`}
                      >
                        <span className="venta-stock-dot"></span>
                        {stock.texto}
                      </span>
                    )}

                    {producto.requiere_seleccion && enCarritoMixto > 0 && (
                      <span className="venta-badge-en-carrito">
                        {enCarritoMixto} en el carrito
                      </span>
                    )}

                    {!producto.requiere_seleccion && enCarrito > 0 && (
                      <CantidadControl
                        className="venta-cantidad-tarjeta"
                        nombre={producto.nombre}
                        cantidad={enCarrito}
                        max={Number(producto.stock_actual)}
                        onDecrementar={() =>
                          restarDelCarrito(claveCarrito(producto.id))
                        }
                        onIncrementar={() =>
                          agregarAlCarrito(producto)
                        }
                        onEscribir={(n) =>
                          establecerCantidad(claveCarrito(producto.id), n)
                        }
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {productos.length > 0 &&
              productosFiltrados.length === 0 && (
                <p className="venta-sin-resultados">
                  Ningún producto coincide con el filtro
                </p>
              )}
          </div>

          {carrito.length > 0 && (
            <button
              className="venta-carrito-fab"
              onClick={irAlCarrito}
            >
              <span className="venta-carrito-fab-info">
                <ShoppingCart size={18} />

                {cantidadTotalCarrito} producto
                {cantidadTotalCarrito !== 1
                  ? "s"
                  : ""}
              </span>

              <span className="venta-carrito-fab-total">
                $
                {totalCarrito.toLocaleString(
                  "es-CO"
                )}
              </span>
            </button>
          )}
        </>
      )}

      {/* =========================
          SELECTOR DE SABORES (paquetes mixtos)
          ========================= */}

      {selectorPaquete && (
        <div className="venta-selector-overlay" onClick={cerrarSelectorPaquete}>
          <div className="venta-selector-panel" onClick={(e) => e.stopPropagation()}>
            <div className="venta-selector-header">
              <div>
                <h3>{selectorPaquete.nombre}</h3>
                <p>
                  Elige {selectorPaquete.cantidad_seleccion} sabores distintos
                  ({seleccionActual.length}/{selectorPaquete.cantidad_seleccion})
                </p>
              </div>
              <button
                type="button"
                className="venta-selector-cerrar"
                onClick={cerrarSelectorPaquete}
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="venta-selector-lista">
              {saboresDisponibles.length === 0 && (
                <p className="venta-sin-resultados">
                  No hay sabores disponibles en este momento
                </p>
              )}

              {saboresDisponibles.map((sabor) => {
                const elegido = seleccionActual.includes(sabor.id);
                const deshabilitado =
                  !elegido &&
                  seleccionActual.length >= selectorPaquete.cantidad_seleccion;

                return (
                  <button
                    type="button"
                    key={sabor.id}
                    className={`venta-selector-opcion ${elegido ? "elegido" : ""}`}
                    disabled={deshabilitado}
                    onClick={() => alternarSaborSeleccionado(sabor.id)}
                  >
                    <span>{sabor.nombre}</span>
                    {elegido && <Check size={16} />}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="venta-btn-primario"
              disabled={seleccionActual.length !== selectorPaquete.cantidad_seleccion}
              onClick={confirmarSelectorPaquete}
            >
              Agregar al carrito
            </button>
          </div>
        </div>
      )}

      {/* =========================
          CARRITO
          ========================= */}

      {vista === "carrito" && (
        <div className="venta-detalle">

          <button
            className="venta-volver-catalogo"
            onClick={volverAlCatalogo}
          >
            <ChevronLeft size={16} />
            Seguir agregando productos
          </button>

          <div className="venta-carrito-lista">
            {carrito.map((item) => (
              <div
                key={item.clave}
                className="venta-carrito-item"
              >
                <div className="venta-carrito-item-info">
                  <span className="venta-carrito-item-nombre">
                    {item.nombre}
                    {item.seleccion_nombres && (
                      <span className="venta-carrito-item-sabores">
                        {item.seleccion_nombres.join(" y ")}
                      </span>
                    )}
                  </span>

                  <span className="venta-carrito-item-precio">
                    ${precioEfectivo(item).toLocaleString("es-CO")} c/u
                    {tienePrecioEspecial(item) && (
                      <span className="venta-badge-precio-especial">Precio especial</span>
                    )}
                  </span>
                </div>

                <CantidadControl
                  className="venta-cantidad-carrito"
                  nombre={item.nombre}
                  cantidad={item.cantidad}
                  max={item.requiere_seleccion ? 9999 : Number(item.stock_actual)}
                  deshabilitarMenos={item.cantidad <= 1}
                  onDecrementar={() =>
                    ajustarCantidadCarrito(item.clave, -1)
                  }
                  onIncrementar={() =>
                    ajustarCantidadCarrito(item.clave, 1)
                  }
                  onEscribir={(n) =>
                    establecerCantidad(item.clave, n)
                  }
                />

                <span className="venta-carrito-item-subtotal">
                  ${(precioEfectivo(item) * item.cantidad).toLocaleString("es-CO")}
                </span>

                <button
                  className="venta-carrito-item-quitar"
                  onClick={() =>
                    quitarDelCarrito(item.clave)
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          <label>Método de pago</label>

          <div className="venta-metodos">
            {METODOS_PAGO.map(
              ({ valor, label, Icon }) => (
                <button
                  key={valor}
                  className={`venta-metodo-btn ${
                    metodoPago === valor
                      ? "activo"
                      : ""
                  }`}
                  onClick={() =>
                    cambiarMetodoPago(valor)
                  }
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              )
            )}
          </div>

          {/* =========================
              CALCULADORA DE EFECTIVO
              ========================= */}

          {metodoPago === "efectivo" && (
            <div className="venta-efectivo">
              <label htmlFor="venta-recibido">
                Efectivo recibido (opcional)
              </label>

              <div className="venta-efectivo-input">
                <span>$</span>

                <input
                  id="venta-recibido"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  value={
                    recibido
                      ? Number(recibido).toLocaleString("es-CO")
                      : ""
                  }
                  onChange={(e) =>
                    cambiarRecibido(e.target.value)
                  }
                />
              </div>

              <div className="venta-efectivo-rapidos">
                <button
                  type="button"
                  className={`venta-chip ${
                    recibidoNum === totalCarrito ? "activo" : ""
                  }`}
                  onClick={() =>
                    setRecibido(String(totalCarrito))
                  }
                >
                  Exacto
                </button>

                {billetesSugeridos.map((b) => (
                  <button
                    key={b}
                    type="button"
                    className={`venta-chip ${
                      recibidoNum === b ? "activo" : ""
                    }`}
                    onClick={() => setRecibido(String(b))}
                  >
                    ${b.toLocaleString("es-CO")}
                  </button>
                ))}
              </div>

              {recibidoNum > 0 && (
                <div
                  className={`venta-cambio ${
                    cambio >= 0 ? "ok" : "falta"
                  }`}
                >
                  <span>
                    {cambio >= 0
                      ? "Cambio a devolver"
                      : "Faltan"}
                  </span>

                  <strong>
                    $
                    {Math.abs(cambio).toLocaleString("es-CO")}
                  </strong>
                </div>
              )}
            </div>
          )}

          {/* =========================
              CUENTA POR COBRAR — CLIENTE
              ========================= */}

          <label>Cliente {esCredito ? "" : "(opcional)"}</label>

          {esCredito && (
            <div className="venta-credito-aviso">
              <Clock3 size={14} />
              Esta venta queda pendiente por cobrar hasta que se marque como pagada.
            </div>
          )}

          {!esCredito && !clienteSeleccionado && !mostrarSelectorCliente && (
            <button
              type="button"
              className="venta-cliente-nuevo-btn"
              onClick={() => setMostrarSelectorCliente(true)}
            >
              <UserPlus size={15} />
              Asociar cliente (opcional)
            </button>
          )}

          {(esCredito || mostrarSelectorCliente || clienteSeleccionado) && (
            <div className="venta-credito">
              {clienteSeleccionado ? (
                <div className="venta-cliente-card">
                  <span className="venta-cliente-icono">
                    {clienteSeleccionado.tipo === "juridica" ? (
                      <Building2 size={18} />
                    ) : (
                      <User size={18} />
                    )}
                  </span>

                  <div className="venta-cliente-info">
                    <strong>{clienteSeleccionado.nombre}</strong>
                    <span>
                      {clienteSeleccionado.tipo === "juridica" ? "NIT" : "Cédula"}:{" "}
                      {clienteSeleccionado.documento}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="venta-cliente-cambiar"
                    onClick={cambiarClienteSeleccionado}
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <>
                  <div className="venta-buscador">
                    <Search size={16} />

                    <input
                      type="text"
                      placeholder="Buscar cliente por nombre o documento..."
                      value={busquedaCliente}
                      onChange={(e) => {
                        setBusquedaCliente(e.target.value);
                        setMostrarFormCliente(false);
                      }}
                    />
                  </div>

                  {!mostrarFormCliente && (
                    <>
                      {buscandoClientes && (
                        <p className="venta-cliente-buscando">Buscando...</p>
                      )}

                      {!buscandoClientes && busquedaCliente.trim().length >= 2 && (
                        <div className="venta-cliente-resultados">
                          {clientesResultados.length === 0 ? (
                            <p className="venta-sin-resultados venta-sin-resultados-inline">
                              Ningún cliente coincide con "{busquedaCliente}"
                            </p>
                          ) : (
                            clientesResultados.map((cliente) => (
                              <button
                                type="button"
                                key={cliente.id}
                                className="venta-cliente-resultado"
                                onClick={() => elegirCliente(cliente)}
                              >
                                <span className="venta-cliente-icono">
                                  {cliente.tipo === "juridica" ? (
                                    <Building2 size={16} />
                                  ) : (
                                    <User size={16} />
                                  )}
                                </span>

                                <span className="venta-cliente-resultado-info">
                                  <strong>{cliente.nombre}</strong>
                                  <small>{cliente.documento}</small>
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        className="venta-cliente-nuevo-btn"
                        onClick={abrirFormCliente}
                      >
                        <UserPlus size={15} />
                        Crear nuevo cliente
                      </button>
                    </>
                  )}

                  {mostrarFormCliente && (
                    <div className="venta-cliente-form">
                      <div className="venta-cliente-form-header">
                        <span>Nuevo cliente</span>

                        <button
                          type="button"
                          className="venta-cliente-form-cerrar"
                          aria-label="Cancelar creación de cliente"
                          onClick={cerrarFormCliente}
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div className="venta-tipo-cliente">
                        <button
                          type="button"
                          className={`venta-tipo-cliente-btn ${
                            formCliente.tipo === "natural" ? "activo" : ""
                          }`}
                          onClick={() => cambiarTipoCliente("natural")}
                        >
                          <User size={15} />
                          Persona natural
                        </button>

                        <button
                          type="button"
                          className={`venta-tipo-cliente-btn ${
                            formCliente.tipo === "juridica" ? "activo" : ""
                          }`}
                          onClick={() => cambiarTipoCliente("juridica")}
                        >
                          <Building2 size={15} />
                          Persona jurídica
                        </button>
                      </div>

                      {errorCliente && (
                        <div className="venta-mensaje-error venta-mensaje-error-chico">
                          {errorCliente}
                        </div>
                      )}

                      <label>
                        {formCliente.tipo === "juridica" ? "Razón social" : "Nombre completo"}
                      </label>

                      <input
                        type="text"
                        value={formCliente.nombre}
                        onChange={(e) =>
                          setFormCliente((f) => ({ ...f, nombre: e.target.value }))
                        }
                        placeholder={
                          formCliente.tipo === "juridica" ? "Ej: Arte Frío" : "Ej: Juan Pérez"
                        }
                      />

                      <label>
                        {formCliente.tipo === "juridica" ? "NIT" : "Cédula"}
                      </label>

                      <input
                        type="text"
                        value={formCliente.documento}
                        onChange={(e) =>
                          setFormCliente((f) => ({ ...f, documento: e.target.value }))
                        }
                        placeholder={
                          formCliente.tipo === "juridica" ? "Ej: 900123456-1" : "Ej: 123456789"
                        }
                      />

                      {formCliente.tipo === "juridica" && (
                        <>
                          <label>Persona de contacto</label>

                          <input
                            type="text"
                            value={formCliente.contacto}
                            onChange={(e) =>
                              setFormCliente((f) => ({ ...f, contacto: e.target.value }))
                            }
                            placeholder="Ej: María Gómez"
                          />
                        </>
                      )}

                      <label>Celular (opcional)</label>

                      <input
                        type="text"
                        inputMode="numeric"
                        value={formCliente.celular}
                        onChange={(e) =>
                          setFormCliente((f) => ({ ...f, celular: e.target.value }))
                        }
                        placeholder="Ej: 3001234567"
                      />

                      <label>Dirección (opcional)</label>

                      <input
                        type="text"
                        value={formCliente.direccion}
                        onChange={(e) =>
                          setFormCliente((f) => ({ ...f, direccion: e.target.value }))
                        }
                        placeholder="Ej: Cll 10 #5-20"
                      />

                      <button
                        type="button"
                        className="venta-btn-primario venta-cliente-form-guardar"
                        onClick={guardarNuevoCliente}
                        disabled={creandoCliente}
                      >
                        {creandoCliente ? "Creando..." : "Crear cliente y continuar"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* =========================
              NOTA / DESCRIPCIÓN
              ========================= */}

          {metodoPago && (
            <>
              <label htmlFor="venta-descripcion">Nota (opcional)</label>

              <textarea
                id="venta-descripcion"
                className="venta-descripcion"
                rows={2}
                maxLength={300}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: Pedido para el evento del sábado"
              />
            </>
          )}

          <label>
            ¿Quién realiza la venta?
          </label>

          <select
            value={trabajadoraId}
            onChange={(e) =>
              elegirTrabajadora(e.target.value)
            }
          >
            <option value="">
              Selecciona...
            </option>

            {trabajadoras.map((t) => (
              <option
                key={t.id}
                value={t.id}
              >
                {t.nombre}
              </option>
            ))}
          </select>

          {/* =========================
              FECHA DE LA VENTA — solo admin
              ========================= */}

          {esAdmin && (
            <>
              <label htmlFor="venta-fecha">
                Fecha de la venta
              </label>

              <input
                id="venta-fecha"
                type="date"
                max={hoyISO()}
                value={fechaVenta}
                onChange={(e) => setFechaVenta(e.target.value)}
              />

              {fechaEsAtrasada && (
                <p className="venta-nota-fecha">
                  Se registrará como si se hubiera vendido el{" "}
                  {formatearFechaCorta(fechaVenta)}, no hoy.
                </p>
              )}
            </>
          )}

          <div className="venta-total">
            <span>Total</span>

            <span>
              $
              {totalCarrito.toLocaleString(
                "es-CO"
              )}
            </span>
          </div>

          <button
            className="venta-btn-primario"
            onClick={irAConfirmar}
          >
            Continuar
          </button>
        </div>
      )}

      {/* =========================
          CONFIRMACIÓN
          ========================= */}

      {vista === "confirmando" && (
        <div className="venta-confirmacion">

          <div className="venta-confirmacion-icono">
            <ShoppingBag size={26} />
          </div>

          <h2>Confirmar venta</h2>

          <div className="venta-confirmacion-items">
            {carrito.map((item) => (
              <div
                key={item.clave}
                className="venta-resumen-fila"
              >
                <span>
                  {item.cantidad} ×{" "}
                  {item.nombre}
                  {item.seleccion_nombres &&
                    ` (${item.seleccion_nombres.join(" y ")})`}
                </span>

                <span>
                  ${(precioEfectivo(item) * item.cantidad).toLocaleString("es-CO")}
                </span>
              </div>
            ))}
          </div>

          <div className="venta-resumen-fila">
            <span>Método de pago</span>

            <span>
              {etiquetaMetodoPago(metodoPago)}
            </span>
          </div>

          {clienteSeleccionado && (
            <div className="venta-resumen-fila">
              <span>Cliente</span>
              <span>{clienteSeleccionado.nombre}</span>
            </div>
          )}

          <div className="venta-resumen-fila">
            <span>Vendido por</span>

            <span>
              {
                trabajadoras.find(
                  (t) =>
                    t.id ===
                    Number(trabajadoraId)
                )?.nombre
              }
            </span>
          </div>

          {fechaEsAtrasada && (
            <div className="venta-resumen-fila">
              <span>Fecha de la venta</span>
              <span>{formatearFechaCorta(fechaVenta)}</span>
            </div>
          )}

          {descripcion.trim() && (
            <div className="venta-resumen-fila">
              <span>Nota</span>
              <span>{descripcion.trim()}</span>
            </div>
          )}

          <div className="venta-resumen-fila venta-resumen-total">
            <span>Total</span>

            <span>
              $
              {totalCarrito.toLocaleString(
                "es-CO"
              )}
            </span>
          </div>

          {esCredito && (
            <div className="venta-credito-aviso venta-credito-aviso-confirmacion">
              <Clock3 size={14} />
              Este pedido quedará como cuenta por cobrar pendiente.
            </div>
          )}

          {tieneRecibido && (
            <>
              <div className="venta-resumen-fila">
                <span>Efectivo recibido</span>

                <span>
                  ${recibidoNum.toLocaleString("es-CO")}
                </span>
              </div>

              <div className="venta-cambio ok">
                <span>Cambio a devolver</span>

                <strong>
                  ${cambio.toLocaleString("es-CO")}
                </strong>
              </div>
            </>
          )}

          <div className="venta-confirmacion-botones">
            <button
              className="venta-btn-secundario"
              onClick={() =>
                setVista("carrito")
              }
              disabled={enviando}
            >
              Volver
            </button>

            <button
              className="venta-btn-primario"
              onClick={confirmarOrden}
              disabled={enviando}
            >
              {enviando
                ? "Registrando..."
                : "Confirmar venta"}
            </button>
          </div>
        </div>
      )}

      {/* =========================
          RECIBO
          ========================= */}

      {vista === "recibo" && reciboOrden && (
        <div className="venta-recibo-pantalla">

          <div className="venta-confirmacion-icono">
            <Check size={26} />
          </div>

          <h2>Venta registrada</h2>

          <p className="venta-recibo-numero">
            Pedido #{reciboOrden.id}
          </p>

          {reciboOrden.metodo_pago === "credito" && !reciboOrden.pagada && (
            <div className="venta-credito-aviso venta-credito-aviso-recibo">
              <Clock3 size={14} />
              Pendiente por cobrar
              {reciboOrden.cliente_nombre ? ` — ${reciboOrden.cliente_nombre}` : ""}
            </div>
          )}

          {reciboEfectivo && (
            <div className="venta-cambio ok">
              <span>Cambio a devolver</span>

              <strong>
                $
                {reciboEfectivo.cambio.toLocaleString("es-CO")}
              </strong>
            </div>
          )}

          <div
            id="recibo-print"
            className="recibo-imprimible"
          >
            <div className="recibo-negocio">
              PUNTO AMARILLO
            </div>

            <div className="recibo-fecha">
              {formatearFechaRecibo(
                reciboOrden.fecha
              )}
            </div>

            <div className="recibo-linea" />

            {reciboOrden.ventas?.map((v) => (
              <div
                key={v.id}
                className="recibo-item"
              >
                <div className="recibo-item-nombre">
                  {v.cantidad} × {v.producto_nombre}
                  {v.selecciones?.length > 0 && (
                    <span className="recibo-item-sabores">
                      {" "}
                      ({v.selecciones.map((s) => s.producto_nombre).join(" y ")})
                    </span>
                  )}
                </div>
                <div className="recibo-item-detalle">
                  <span className="recibo-item-precio">
                    ${Number(v.precio_unitario).toLocaleString("es-CO")} c/u
                  </span>
                  <span className="recibo-item-subtotal">
                    ${Number(v.total).toLocaleString("es-CO")}
                  </span>
                </div>
              </div>
            ))}

            <div className="recibo-linea" />

            <div className="recibo-total">
              <span>Total</span>

              <span>
                $
                {Number(
                  reciboOrden.total
                ).toLocaleString("es-CO")}
              </span>
            </div>

            <div className="recibo-detalle">
              Método de pago: {etiquetaMetodoPago(reciboOrden.metodo_pago)}
            </div>

            {reciboEfectivo && (
              <>
                <div className="recibo-detalle">
                  Efectivo recibido: $
                  {reciboEfectivo.recibido.toLocaleString("es-CO")}
                </div>

                <div className="recibo-detalle">
                  Cambio: $
                  {reciboEfectivo.cambio.toLocaleString("es-CO")}
                </div>
              </>
            )}

            {reciboOrden.cliente_nombre && !reciboOrden.cliente_es_predeterminado && (
              <div className="recibo-cliente">
                <div className="recibo-cliente-titulo">Datos del cliente</div>

                <div className="recibo-detalle recibo-cliente-nombre">
                  {reciboOrden.cliente_nombre}
                </div>

                {reciboOrden.cliente_documento && (
                  <div className="recibo-detalle">
                    {reciboOrden.cliente_tipo === "juridica" ? "NIT" : "Cédula"}: {reciboOrden.cliente_documento}
                  </div>
                )}

                {reciboOrden.cliente_celular && (
                  <div className="recibo-detalle">
                    Celular: {reciboOrden.cliente_celular}
                  </div>
                )}

                {reciboOrden.cliente_direccion && (
                  <div className="recibo-detalle">
                    Dirección: {reciboOrden.cliente_direccion}
                  </div>
                )}
              </div>
            )}

            <div className="recibo-footer">
              ¡Gracias por su compra!
            </div>
          </div>

          <div className="venta-recibo-botones">
            <button
              className="venta-btn-secundario"
              onClick={() => window.print()}
            >
              <Printer size={16} />
              Imprimir recibo
            </button>

            <button
              className="venta-btn-primario"
              onClick={nuevaVenta}
            >
              Nueva venta
            </button>
          </div>
        </div>
      )}
    </div>
  );
}