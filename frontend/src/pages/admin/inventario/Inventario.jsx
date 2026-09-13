import { useEffect, useState } from "react";
import { Boxes, Plus, Phone, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { listarProductos } from "../../../api/productos";
import { listarTrabajadoras } from "../../../api/trabajadoras";
import { listarProveedoresDeProducto } from "../../../api/proveedores";
import {
  registrarEntrada,
  registrarSalida,
  listarBajoStock,
  listarMovimientos,
} from "../../../api/inventario";
import Sheet from "../../../components/Sheet";
import "./Inventario.css";

const MOTIVOS_ENTRADA = [
  { valor: "produccion", label: "Producción" },
  { valor: "compra", label: "Compra" },
  { valor: "ajuste", label: "Ajuste de conteo" },
];

const MOTIVOS_SALIDA = [
  { valor: "merma", label: "Merma / dañado" },
  { valor: "ajuste", label: "Ajuste de conteo" },
];

function formVacio() {
  return { tipo: "entrada", producto_id: "", cantidad: "", motivo: "produccion", trabajadora_id: "" };
}

function formatearFecha(isoString) {
  return new Date(isoString).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Inventario() {
  const [productos, setProductos] = useState([]);
  const [trabajadoras, setTrabajadoras] = useState([]);
  const [bajoStock, setBajoStock] = useState([]);
  const [movimientos, setMovimientos] = useState([]);

  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [form, setForm] = useState(formVacio());
  const [proveedoresPorProducto, setProveedoresPorProducto] = useState({});
  const [verProveedoresId, setVerProveedoresId] = useState(null);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setError(null);
    try {
      const [productosData, trabajadorasData, bajoStockData, movimientosData] = await Promise.all([
        listarProductos(),
        listarTrabajadoras(),
        listarBajoStock(),
        listarMovimientos(),
      ]);
      setProductos(productosData);
      setTrabajadoras(trabajadorasData);
      setBajoStock(bajoStockData);
      setMovimientos(movimientosData.slice(0, 15));
    } catch (err) {
      setError("No se pudieron cargar los datos de inventario");
    }
  }

  function iniciarCreacion() {
    setForm(formVacio());
    setMensaje(null);
    setError(null);
    setSheetAbierto(true);
  }

  function cerrarSheet(abierto) {
    setSheetAbierto(abierto);
    if (!abierto) setForm(formVacio());
  }

  function cambiarTipo(tipo) {
    setForm((f) => ({
      ...f,
      tipo,
      motivo: tipo === "entrada" ? "produccion" : "merma",
    }));
  }

  async function guardar() {
    if (!form.producto_id || !form.cantidad) {
      setError("Selecciona un producto e ingresa la cantidad");
      return;
    }

    setGuardando(true);
    setError(null);

    const payload = {
      producto_id: Number(form.producto_id),
      cantidad: Number(form.cantidad),
      motivo: form.motivo,
      trabajadora_id: form.trabajadora_id ? Number(form.trabajadora_id) : null,
    };

    try {
      if (form.tipo === "entrada") {
        await registrarEntrada(payload);
      } else {
        await registrarSalida(payload);
      }
      setMensaje("Movimiento registrado correctamente");
      cerrarSheet(false);
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo registrar el movimiento");
    } finally {
      setGuardando(false);
    }
  }

  async function toggleProveedores(productoId) {
    if (verProveedoresId === productoId) {
      setVerProveedoresId(null);
      return;
    }
    setVerProveedoresId(productoId);
    if (!proveedoresPorProducto[productoId]) {
      try {
        const proveedores = await listarProveedoresDeProducto(productoId);
        setProveedoresPorProducto((prev) => ({ ...prev, [productoId]: proveedores }));
      } catch (err) {
        setError("No se pudieron cargar los proveedores");
      }
    }
  }

  const motivosDisponibles = form.tipo === "entrada" ? MOTIVOS_ENTRADA : MOTIVOS_SALIDA;

  return (
    <div className="admin-inv-container">
      <header className="admin-inv-header">
        <div>
          <h1>Inventario</h1>
          <p>Ajustes de stock, producción y mermas</p>
        </div>
        <button className="admin-inv-btn-nuevo" onClick={iniciarCreacion}>
          <Plus size={16} />
          Nuevo movimiento
        </button>
      </header>

      {mensaje && <div className="admin-inv-mensaje-exito">{mensaje}</div>}
      {error && !sheetAbierto && <div className="admin-inv-mensaje-error">{error}</div>}

      <section className="admin-inv-seccion">
        <h2>Productos por acabarse</h2>
        {bajoStock.length === 0 ? (
          <p className="admin-inv-sin-alertas">Todo el stock está en buen nivel</p>
        ) : (
          <div className="admin-inv-lista-stock">
            {bajoStock.map((p) => (
              <div key={p.id} className="admin-inv-stock-card">
                <div className="admin-inv-stock-info">
                  <span>{p.nombre}</span>
                  <span className="admin-inv-badge-bajo">
                    <AlertTriangle size={11} />
                    Quedan {p.stock_actual}
                  </span>
                </div>
                <button className="admin-inv-btn-proveedor" onClick={() => toggleProveedores(p.id)}>
                  <Phone size={13} />
                  Ver proveedor
                </button>

                {verProveedoresId === p.id && (
                  <div className="admin-inv-proveedores-lista">
                    {(proveedoresPorProducto[p.id] || []).length === 0 ? (
                      <p className="admin-inv-sin-proveedor">Sin proveedores registrados</p>
                    ) : (
                      proveedoresPorProducto[p.id].map((prov) => (
                        <div key={prov.id} className="admin-inv-proveedor-fila">
                          <span>{prov.nombre}</span>
                          <a href={`tel:${prov.celular}`}>{prov.celular}</a>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="admin-inv-seccion">
        <h2>Movimientos recientes</h2>
        {movimientos.length === 0 ? (
          <p className="admin-inv-sin-alertas">Todavía no hay movimientos registrados</p>
        ) : (
          <div className="admin-inv-lista-movimientos">
            {movimientos.map((m) => (
              <div key={m.id} className="admin-inv-mov-fila">
                <span className={`admin-inv-mov-icono ${m.tipo}`}>
                  {m.tipo === "entrada" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                </span>
                <div className="admin-inv-mov-info">
                  <span className="admin-inv-mov-producto">
                    {productos.find((p) => p.id === m.producto_id)?.nombre || `Producto #${m.producto_id}`}
                  </span>
                  <span className="admin-inv-mov-detalle">
                    {m.motivo} · {formatearFecha(m.fecha)}
                  </span>
                </div>
                <span className={`admin-inv-mov-cantidad ${m.tipo}`}>
                  {m.tipo === "entrada" ? "+" : "-"}
                  {m.cantidad}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <Sheet open={sheetAbierto} onOpenChange={cerrarSheet} title="Nuevo movimiento de inventario">
        <div className="admin-inv-form">
          {error && <div className="admin-inv-mensaje-error">{error}</div>}

          <label>Tipo de movimiento</label>
          <div className="admin-inv-tipos">
            <button
              type="button"
              className={`admin-inv-tipo-btn entrada ${form.tipo === "entrada" ? "activo" : ""}`}
              onClick={() => cambiarTipo("entrada")}
            >
              <TrendingUp size={15} />
              Entrada
            </button>
            <button
              type="button"
              className={`admin-inv-tipo-btn salida ${form.tipo === "salida" ? "activo" : ""}`}
              onClick={() => cambiarTipo("salida")}
            >
              <TrendingDown size={15} />
              Salida
            </button>
          </div>

          <label>Producto</label>
          <select
            value={form.producto_id}
            onChange={(e) => setForm((f) => ({ ...f, producto_id: e.target.value }))}
          >
            <option value="">Selecciona...</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} (stock: {p.stock_actual})
              </option>
            ))}
          </select>

          <label>Cantidad</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={form.cantidad}
            onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))}
            placeholder="Ej: 50"
          />

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

          <label>¿Quién lo registra? (opcional)</label>
          <select
            value={form.trabajadora_id}
            onChange={(e) => setForm((f) => ({ ...f, trabajadora_id: e.target.value }))}
          >
            <option value="">Sin especificar</option>
            {trabajadoras.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>

          <button
            className="admin-inv-btn-primario admin-inv-btn-guardar-sheet"
            onClick={guardar}
            disabled={guardando}
          >
            {guardando ? "Guardando..." : "Guardar movimiento"}
          </button>
        </div>
      </Sheet>
    </div>
  );
}