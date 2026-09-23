import { useEffect, useState } from "react";
import {
  Package,
  PackagePlus,
  Phone,
  AlertTriangle,
  CheckCircle2,
  Search,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

import { listarProductos } from "../../../api/productos";
import { registrarEntrada, reportarNivelProducto, listarBajoStock } from "../../../api/inventario";
import { listarProveedoresDeProducto } from "../../../api/proveedores";
import Sheet from "../../../components/Sheet";
import VerificacionTrabajadora from "../../../components/VerificacionTrabajadora";
import "./Inventario.css";

const MOTIVOS_ENTRADA = [
  { valor: "produccion", label: "Producción" },
  { valor: "ajuste", label: "Ajuste de conteo" },
];

const MOTIVOS_SALIDA = [
  { valor: "consumo", label: "Consumo interno" },
  { valor: "merma", label: "Merma / dañado" },
];

function formVacio() {
  return {
    tipo: "entrada",
    producto_id: "",
    cantidad: "",
    motivo: "produccion",
  };
}

export default function Inventario() {
  const [productos, setProductos] = useState([]);
  const [bajoStock, setBajoStock] = useState([]);

  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [form, setForm] = useState(formVacio());
  const [enviando, setEnviando] = useState(false);
  const [trabajadoraVerificada, setTrabajadoraVerificada] = useState(null);
  const [busquedaMovimiento, setBusquedaMovimiento] = useState("");

  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState("");

  const [proveedoresPorProducto, setProveedoresPorProducto] = useState({});
  const [expandido, setExpandido] = useState(null);

  const productosParaMovimiento = productos.filter((producto) =>
    producto.nombre.toLowerCase().includes(busquedaMovimiento.toLowerCase())
  );

  const productoSeleccionado = productos.find(
    (p) => String(p.id) === String(form.producto_id)
  );

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setError(null);

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

  function abrirMovimiento() {
    setForm(formVacio());
    setBusquedaMovimiento("");
    setMensaje(null);
    setError(null);
    setTrabajadoraVerificada(null);
    setSheetAbierto(true);
  }

  function cerrarSheet(abierto) {
    setSheetAbierto(abierto);

    if (!abierto) {
      setForm(formVacio());
      setBusquedaMovimiento("");
      setTrabajadoraVerificada(null);
    }
  }

  function cambiarTipo(tipo) {
    setForm((f) => ({
      ...f,
      tipo,
      cantidad: "",
      motivo: tipo === "entrada" ? "produccion" : "consumo",
    }));
  }

  function ajustarCantidad(delta) {
    const minimo = form.tipo === "entrada" ? 1 : 0;

    setForm((f) => {
      const actual = Number(f.cantidad || 0);
      const siguiente = Math.max(minimo, actual + delta);
      return { ...f, cantidad: siguiente };
    });
  }

  async function guardar() {
    if (!form.producto_id || form.cantidad === "" || form.cantidad === null) {
      setError("Selecciona un producto e ingresa la cantidad");
      return;
    }

    if (form.tipo === "salida" && Number(form.cantidad) < 0) {
      setError("La cantidad no puede ser negativa");
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      if (form.tipo === "entrada") {
        await registrarEntrada({
          producto_id: Number(form.producto_id),
          cantidad: Number(form.cantidad),
          motivo: form.motivo,
          trabajadora_id: trabajadoraVerificada.id,
        });

        setMensaje(`Se agregaron ${form.cantidad} unidades de ${productoSeleccionado.nombre}`);
      } else {
        const resultado = await reportarNivelProducto({
          producto_id: Number(form.producto_id),
          cantidad_restante: Number(form.cantidad),
          motivo: form.motivo,
          trabajadora_id: trabajadoraVerificada.id,
        });

        if (resultado.sin_cambios) {
          setMensaje("El nivel reportado coincide con el registrado, no hubo cambios");
        } else if (resultado.tipo === "entrada") {
          setMensaje(
            `Había menos registrado de lo real: se corrigió agregando ${resultado.cantidad} unidades`
          );
        } else {
          setMensaje(
            `Salida registrada: se consumieron ${resultado.cantidad} unidades de ${productoSeleccionado.nombre}`
          );
        }
      }

      cerrarSheet(false);
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo registrar el movimiento");
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

        setProveedoresPorProducto((prev) => ({
          ...prev,
          [productoId]: proveedores,
        }));
      } catch (err) {
        setError("No se pudieron cargar los proveedores");
      }
    }
  }

  const motivosDisponibles = form.tipo === "entrada" ? MOTIVOS_ENTRADA : MOTIVOS_SALIDA;

  /* Vista previa de lo que se va a registrar, antes de guardar */
  let previa = null;
  if (
    form.tipo === "salida" &&
    productoSeleccionado &&
    form.cantidad !== "" &&
    form.cantidad !== null
  ) {
    const stockActual = Number(productoSeleccionado.stock_actual);
    const restante = Number(form.cantidad);
    const diferencia = Math.round((stockActual - restante) * 100) / 100;

    if (diferencia > 0) {
      previa = {
        tipo: "salida",
        texto: `Se registrará una salida de ${diferencia} unidades`,
      };
    } else if (diferencia < 0) {
      previa = {
        tipo: "entrada",
        texto: `Había menos registrado: se agregarán ${Math.abs(diferencia)} unidades`,
      };
    } else {
      previa = {
        tipo: "igual",
        texto: "Sin cambios respecto al stock actual",
      };
    }
  }

  const idsBajoStock = new Set(bajoStock.map((producto) => producto.id));

  const productosOrdenados = [...productos].sort((a, b) => {
    const aBajo = idsBajoStock.has(a.id);
    const bBajo = idsBajoStock.has(b.id);

    if (aBajo && !bBajo) return -1;
    if (!aBajo && bBajo) return 1;

    return a.nombre.localeCompare(b.nombre);
  });

  const productosFiltrados = productosOrdenados.filter((producto) =>
    producto.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="inv-container">
      <header className="inv-header">
        <div>
          <h1>Inventario</h1>
          <p>
            {productos.length} productos registrados
            {bajoStock.length > 0 && ` · ${bajoStock.length} por acabarse`}
          </p>
        </div>

        <button className="inv-btn-produccion-header" onClick={abrirMovimiento}>
          <PackagePlus size={15} />
          Registrar movimiento
        </button>
      </header>

      {mensaje && (
        <div className="inv-mensaje-exito">
          <CheckCircle2 size={16} />
          {mensaje}
        </div>
      )}

      {error && !sheetAbierto && <div className="inv-mensaje-error">{error}</div>}

      <div className="inv-buscador">
        <Search size={17} />
        <input
          type="text"
          placeholder="Buscar producto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <section className="inv-seccion">
        <h2>
          <PackagePlus size={16} />
          Mis productos
        </h2>

        {productosFiltrados.length === 0 ? (
          <div className="inv-sin-alertas">
            <CheckCircle2 size={18} />
            <span>No hay productos registrados</span>
          </div>
        ) : (
          <div className="inv-lista-productos">
            {productosFiltrados.map((producto) => {
              const estaBajoStock = idsBajoStock.has(producto.id);
              const proveedores = proveedoresPorProducto[producto.id] || [];

              return (
                <div key={producto.id} className={`inv-producto-card ${estaBajoStock ? "stock-bajo" : ""}`}>
                  <div className="inv-producto-top">
                    <div className="inv-producto-info">
                      <div className="inv-producto-nombre-wrapper">
                        <span className="inv-producto-icono">
                          <Package size={16} />
                        </span>
                        <span className="inv-prod-nombre">{producto.nombre}</span>
                      </div>

                      <span className="inv-producto-label">Stock actual</span>
                      <span className="inv-producto-stock">{producto.stock_actual}</span>
                    </div>

                    <div className="inv-producto-estado">
                      {estaBajoStock ? (
                        <span className="inv-badge-bajo">
                          <AlertTriangle size={12} />
                          Stock bajo
                        </span>
                      ) : (
                        <span className="inv-badge-ok">
                          <CheckCircle2 size={12} />
                          Disponible
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="inv-producto-acciones">
                    <button
                      className={`inv-btn-secundario ${expandido === producto.id ? "activo" : ""}`}
                      onClick={() => verProveedores(producto.id)}
                    >
                      <Phone size={14} />
                      {expandido === producto.id ? "Ocultar proveedor" : "Ver proveedor"}
                    </button>
                  </div>

                  {expandido === producto.id && (
                    <div className="inv-proveedores-lista">
                      {proveedores.length === 0 ? (
                        <p className="inv-sin-proveedor">No hay proveedores registrados para este producto</p>
                      ) : (
                        proveedores.map((prov) => (
                          <a key={prov.id} href={`tel:${prov.celular}`} className="inv-proveedor-fila">
                            <span>{prov.nombre}</span>
                            <span className="inv-proveedor-numero">{prov.celular}</span>
                          </a>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Sheet open={sheetAbierto} onOpenChange={cerrarSheet} title="Movimiento de inventario">
        <div className="inv-sheet-body">
          {error && <div className="inv-mensaje-error">{error}</div>}

          {!trabajadoraVerificada ? (
            <VerificacionTrabajadora onVerificado={setTrabajadoraVerificada} />
          ) : (
            <>
              <label>Tipo de movimiento</label>
              <div className="inv-tipos">
                <button
                  type="button"
                  className={`inv-tipo-btn entrada ${form.tipo === "entrada" ? "activo" : ""}`}
                  onClick={() => cambiarTipo("entrada")}
                >
                  <TrendingUp size={15} />
                  Entrada
                </button>
                <button
                  type="button"
                  className={`inv-tipo-btn salida ${form.tipo === "salida" ? "activo" : ""}`}
                  onClick={() => cambiarTipo("salida")}
                >
                  <TrendingDown size={15} />
                  Salida
                </button>
              </div>

              <label>Buscar producto</label>
              <div className="inv-producto-buscador">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Escribe el nombre del producto..."
                  value={busquedaMovimiento}
                  onChange={(e) => {
                    setBusquedaMovimiento(e.target.value);
                    setForm((f) => ({ ...f, producto_id: "" }));
                  }}
                />
              </div>

              {busquedaMovimiento && !form.producto_id && (
                <div className="inv-productos-resultados">
                  {productosParaMovimiento.length === 0 ? (
                    <p className="inv-sin-productos">No se encontraron productos</p>
                  ) : (
                    productosParaMovimiento.map((producto) => (
                      <button
                        type="button"
                        key={producto.id}
                        className="inv-producto-resultado"
                        onClick={() => {
                          setForm((f) => ({ ...f, producto_id: String(producto.id) }));
                          setBusquedaMovimiento(producto.nombre);
                          setError(null);
                        }}
                      >
                        <div>
                          <strong>{producto.nombre}</strong>
                          <span>Stock actual: {producto.stock_actual}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              <label>
                {form.tipo === "entrada" ? "¿Cuántas unidades se hicieron?" : "¿Cuánto queda actualmente?"}
              </label>

              {form.tipo === "salida" && productoSeleccionado && (
                <p className="inv-stock-referencia">
                  Stock registrado: {productoSeleccionado.stock_actual}
                </p>
              )}

              <div className="inv-stepper">
                <button type="button" className="inv-stepper-btn" onClick={() => ajustarCantidad(-1)}>
                  −
                </button>

                <input
                  type="number"
                  min="0"
                  value={form.cantidad}
                  onChange={(e) => {
                    const valor = e.target.value;
                    setForm((f) => ({ ...f, cantidad: valor === "" ? "" : Math.max(0, Number(valor)) }));
                  }}
                  className="inv-stepper-input"
                />

                <button type="button" className="inv-stepper-btn" onClick={() => ajustarCantidad(1)}>
                  +
                </button>
              </div>

              {previa && (
                <p className={`inv-previa inv-previa-${previa.tipo}`}>
                  {previa.texto}
                </p>
              )}

              <label>Motivo</label>
              <select
                value={form.motivo}
                onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
              >
                {motivosDisponibles.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.label}
                  </option>
                ))}
              </select>

              {form.tipo === "salida" && (
                <p className="inv-hint-motivo">
                  Si resulta que había más stock del registrado, se corrige
                  automáticamente como un ajuste, sin importar el motivo elegido.
                </p>
              )}

              <button
                className="inv-btn-primario inv-btn-guardar-sheet"
                onClick={guardar}
                disabled={enviando || !form.producto_id}
              >
                {enviando ? "Guardando..." : "Guardar movimiento"}
              </button>
            </>
          )}
        </div>
      </Sheet>
    </div>
  );
}