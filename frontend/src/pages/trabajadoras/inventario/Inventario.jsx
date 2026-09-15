import { useEffect, useState } from "react";
import {
  Package,
  PackagePlus,
  Phone,
  AlertTriangle,
  CheckCircle2,
  Minus,
  Plus,
  Wheat,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { listarProductos } from "../../../api/productos";
import { registrarEntrada, listarBajoStock } from "../../../api/inventario";
import { listarProveedoresDeProducto } from "../../../api/proveedores";
import {
  listarInsumos,
  registrarEntradaInsumo,
  registrarSalidaInsumo,
  listarBajoStockInsumo,
  listarProveedoresDeInsumo,
} from "../../../api/insumos";
import Sheet from "../../../components/Sheet";
import "./Inventario.css";

const MOTIVOS_ENTRADA_INSUMO = [
  { valor: "compra", label: "Compra" },
  { valor: "ajuste", label: "Ajuste de conteo" },
];
const MOTIVOS_SALIDA_INSUMO = [
  { valor: "uso", label: "Uso en cocina" },
  { valor: "merma", label: "Merma / dañado" },
  { valor: "ajuste", label: "Ajuste de conteo" },
];

function formMovimientoInsumoVacio() {
  return { tipo: "entrada", insumo_id: "", cantidad: "", motivo: "compra" };
}

export default function Inventario() {
  const [productos, setProductos] = useState([]);
  const [bajoStockProductos, setBajoStockProductos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [bajoStockInsumos, setBajoStockInsumos] = useState([]);

  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  // --- sheet: producción de producto ---
  const [sheetProduccionAbierto, setSheetProduccionAbierto] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [cantidadProduccion, setCantidadProduccion] = useState(1);
  const [enviandoProduccion, setEnviandoProduccion] = useState(false);

  // --- proveedores de productos bajo stock ---
  const [proveedoresPorProducto, setProveedoresPorProducto] = useState({});
  const [expandidoProducto, setExpandidoProducto] = useState(null);

  // --- sheet: movimiento de insumo ---
  const [sheetInsumoAbierto, setSheetInsumoAbierto] = useState(false);
  const [formInsumo, setFormInsumo] = useState(formMovimientoInsumoVacio());
  const [enviandoInsumo, setEnviandoInsumo] = useState(false);

  // --- proveedores de insumos bajo stock ---
  const [proveedoresPorInsumo, setProveedoresPorInsumo] = useState({});
  const [expandidoInsumo, setExpandidoInsumo] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    try {
      const [productosData, bajoStockProdData, insumosData, bajoStockInsData] = await Promise.all([
        listarProductos(),
        listarBajoStock(),
        listarInsumos(),
        listarBajoStockInsumo(),
      ]);
      setProductos(productosData);
      setBajoStockProductos(bajoStockProdData);
      setInsumos(insumosData);
      setBajoStockInsumos(bajoStockInsData);
    } catch (err) {
      setError("No se pudieron cargar los datos");
    }
  }

  // --- producción de producto ---

  function abrirProduccion(producto) {
    setProductoSeleccionado(producto);
    setCantidadProduccion(1);
    setMensaje(null);
    setError(null);
    setSheetProduccionAbierto(true);
  }

  function cerrarSheetProduccion(abierto) {
    setSheetProduccionAbierto(abierto);
    if (!abierto) {
      setProductoSeleccionado(null);
      setCantidadProduccion(1);
    }
  }

  function ajustarCantidadProduccion(delta) {
    setCantidadProduccion((c) => Math.max(1, Number(c) + delta));
  }

  async function registrarProduccion() {
    if (!productoSeleccionado) return;

    setEnviandoProduccion(true);
    setError(null);

    try {
      await registrarEntrada({
        producto_id: productoSeleccionado.id,
        cantidad: Number(cantidadProduccion),
        motivo: "produccion",
      });

      setMensaje(`Se agregaron ${cantidadProduccion} unidades de ${productoSeleccionado.nombre}`);
      cerrarSheetProduccion(false);
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo registrar la producción");
    } finally {
      setEnviandoProduccion(false);
    }
  }

  async function verProveedoresProducto(productoId) {
    if (expandidoProducto === productoId) {
      setExpandidoProducto(null);
      return;
    }
    setExpandidoProducto(productoId);
    if (!proveedoresPorProducto[productoId]) {
      try {
        const proveedores = await listarProveedoresDeProducto(productoId);
        setProveedoresPorProducto((prev) => ({ ...prev, [productoId]: proveedores }));
      } catch (err) {
        setError("No se pudieron cargar los proveedores");
      }
    }
  }

  // --- movimiento de insumo ---

  function abrirMovimientoInsumo() {
    setFormInsumo(formMovimientoInsumoVacio());
    setMensaje(null);
    setError(null);
    setSheetInsumoAbierto(true);
  }

  function cerrarSheetInsumo(abierto) {
    setSheetInsumoAbierto(abierto);
    if (!abierto) setFormInsumo(formMovimientoInsumoVacio());
  }

  function cambiarTipoInsumo(tipo) {
    setFormInsumo((f) => ({ ...f, tipo, motivo: tipo === "entrada" ? "compra" : "uso" }));
  }

  async function guardarMovimientoInsumo() {
    if (!formInsumo.insumo_id || !formInsumo.cantidad) {
      setError("Selecciona un insumo e ingresa la cantidad");
      return;
    }

    setEnviandoInsumo(true);
    setError(null);

    const payload = {
      insumo_id: Number(formInsumo.insumo_id),
      cantidad: Number(formInsumo.cantidad),
      motivo: formInsumo.motivo,
    };

    try {
      if (formInsumo.tipo === "entrada") {
        await registrarEntradaInsumo(payload);
      } else {
        await registrarSalidaInsumo(payload);
      }
      setMensaje("Movimiento de insumo registrado");
      cerrarSheetInsumo(false);
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo registrar el movimiento");
    } finally {
      setEnviandoInsumo(false);
    }
  }

  async function verProveedoresInsumo(insumoId) {
    if (expandidoInsumo === insumoId) {
      setExpandidoInsumo(null);
      return;
    }
    setExpandidoInsumo(insumoId);
    if (!proveedoresPorInsumo[insumoId]) {
      try {
        const proveedores = await listarProveedoresDeInsumo(insumoId);
        setProveedoresPorInsumo((prev) => ({ ...prev, [insumoId]: proveedores }));
      } catch (err) {
        setError("No se pudieron cargar los proveedores");
      }
    }
  }

  const motivosInsumoDisponibles =
    formInsumo.tipo === "entrada" ? MOTIVOS_ENTRADA_INSUMO : MOTIVOS_SALIDA_INSUMO;

  return (
    <div className="inv-container">
      <header className="inv-header">
        <h1>Inventario</h1>
        <p>Productos, insumos y qué se está acabando</p>
      </header>

      {mensaje && (
        <div className="inv-mensaje-exito">
          <CheckCircle2 size={16} /> {mensaje}
        </div>
      )}
      {error && !sheetProduccionAbierto && !sheetInsumoAbierto && (
        <div className="inv-mensaje-error">{error}</div>
      )}

      <section className="inv-seccion">
        <h2>
          <PackagePlus size={16} />
          Registrar producción
        </h2>

        <div className="inv-grid-productos">
          {productos.map((producto) => (
            <button key={producto.id} className="inv-prod-btn" onClick={() => abrirProduccion(producto)}>
              <span className="inv-prod-icono">
                <Package size={18} />
              </span>
              <span className="inv-prod-nombre">{producto.nombre}</span>
              <span className="inv-prod-stock">Stock: {producto.stock_actual}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="inv-seccion">
        <h2>
          <AlertTriangle size={16} />
          Productos por acabarse
        </h2>

        {bajoStockProductos.length === 0 ? (
          <div className="inv-sin-alertas">
            <CheckCircle2 size={18} />
            <span>Todo el stock está en buen nivel</span>
          </div>
        ) : (
          <div className="inv-lista-bajo-stock">
            {bajoStockProductos.map((producto) => (
              <div key={producto.id} className="inv-bajo-stock-card">
                <div className="inv-bajo-stock-info">
                  <span className="inv-prod-nombre">{producto.nombre}</span>
                  <span className="inv-badge-bajo">Quedan {producto.stock_actual}</span>
                </div>
                <button className="inv-btn-secundario" onClick={() => verProveedoresProducto(producto.id)}>
                  <Phone size={14} />
                  Ver proveedor
                </button>

                {expandidoProducto === producto.id && (
                  <div className="inv-proveedores-lista">
                    {(proveedoresPorProducto[producto.id] || []).length === 0 ? (
                      <p className="inv-sin-proveedor">No hay proveedores registrados para este producto</p>
                    ) : (
                      proveedoresPorProducto[producto.id].map((prov) => (
                        <a key={prov.id} href={`tel:${prov.celular}`} className="inv-proveedor-fila">
                          <span>{prov.nombre}</span>
                          <span className="inv-proveedor-numero">{prov.celular}</span>
                        </a>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="inv-seccion">
        <div className="inv-seccion-titulo-con-boton">
          <h2>
            <Wheat size={16} />
            Insumos
          </h2>
          <button className="inv-btn-insumo-movimiento" onClick={abrirMovimientoInsumo}>
            Registrar movimiento
          </button>
        </div>

        {bajoStockInsumos.length === 0 ? (
          <div className="inv-sin-alertas">
            <CheckCircle2 size={18} />
            <span>Todos los insumos están en buen nivel</span>
          </div>
        ) : (
          <div className="inv-lista-bajo-stock">
            {bajoStockInsumos.map((insumo) => (
              <div key={insumo.id} className="inv-bajo-stock-card">
                <div className="inv-bajo-stock-info">
                  <span className="inv-prod-nombre">{insumo.nombre}</span>
                  <span className="inv-badge-bajo">
                    Quedan {insumo.stock_actual} {insumo.unidad_medida}
                  </span>
                </div>
                <button className="inv-btn-secundario" onClick={() => verProveedoresInsumo(insumo.id)}>
                  <Phone size={14} />
                  Ver proveedor
                </button>

                {expandidoInsumo === insumo.id && (
                  <div className="inv-proveedores-lista">
                    {(proveedoresPorInsumo[insumo.id] || []).length === 0 ? (
                      <p className="inv-sin-proveedor">No hay proveedores registrados para este insumo</p>
                    ) : (
                      proveedoresPorInsumo[insumo.id].map((prov) => (
                        <a key={prov.id} href={`tel:${prov.celular}`} className="inv-proveedor-fila">
                          <span>{prov.nombre}</span>
                          <span className="inv-proveedor-numero">{prov.celular}</span>
                        </a>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <Sheet
        open={sheetProduccionAbierto}
        onOpenChange={cerrarSheetProduccion}
        title={productoSeleccionado ? productoSeleccionado.nombre : "Registrar producción"}
      >
        <div className="inv-sheet-body">
          {error && <div className="inv-mensaje-error">{error}</div>}

          <p className="inv-sheet-subtitulo">
            Stock actual: {productoSeleccionado?.stock_actual}
          </p>

          <label>¿Cuántas unidades se hicieron?</label>
          <div className="inv-stepper">
            <button type="button" className="inv-stepper-btn" onClick={() => ajustarCantidadProduccion(-1)}>
              <Minus size={16} />
            </button>
            <span className="inv-stepper-valor">{cantidadProduccion}</span>
            <button type="button" className="inv-stepper-btn" onClick={() => ajustarCantidadProduccion(1)}>
              <Plus size={16} />
            </button>
          </div>

          <button
            className="inv-btn-primario inv-btn-guardar-sheet"
            onClick={registrarProduccion}
            disabled={enviandoProduccion}
          >
            {enviandoProduccion ? "Registrando..." : "Registrar producción"}
          </button>
        </div>
      </Sheet>

      <Sheet open={sheetInsumoAbierto} onOpenChange={cerrarSheetInsumo} title="Movimiento de insumo">
        <div className="inv-sheet-body">
          {error && <div className="inv-mensaje-error">{error}</div>}

          <label>Tipo de movimiento</label>
          <div className="inv-tipos-insumo">
            <button
              type="button"
              className={`inv-tipo-btn entrada ${formInsumo.tipo === "entrada" ? "activo" : ""}`}
              onClick={() => cambiarTipoInsumo("entrada")}
            >
              <TrendingUp size={15} />
              Entrada
            </button>
            <button
              type="button"
              className={`inv-tipo-btn salida ${formInsumo.tipo === "salida" ? "activo" : ""}`}
              onClick={() => cambiarTipoInsumo("salida")}
            >
              <TrendingDown size={15} />
              Salida
            </button>
          </div>

          <label>Insumo</label>
          <select
            value={formInsumo.insumo_id}
            onChange={(e) => setFormInsumo((f) => ({ ...f, insumo_id: e.target.value }))}
          >
            <option value="">Selecciona...</option>
            {insumos.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre} (stock: {i.stock_actual} {i.unidad_medida})
              </option>
            ))}
          </select>

          <label>Cantidad</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={formInsumo.cantidad}
            onChange={(e) => setFormInsumo((f) => ({ ...f, cantidad: e.target.value }))}
          />

          <label>Motivo</label>
          <select
            value={formInsumo.motivo}
            onChange={(e) => setFormInsumo((f) => ({ ...f, motivo: e.target.value }))}
          >
            {motivosInsumoDisponibles.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.label}
              </option>
            ))}
          </select>

          <button
            className="inv-btn-primario inv-btn-guardar-sheet"
            onClick={guardarMovimientoInsumo}
            disabled={enviandoInsumo}
          >
            {enviandoInsumo ? "Guardando..." : "Guardar movimiento"}
          </button>
        </div>
      </Sheet>
    </div>
  );
}