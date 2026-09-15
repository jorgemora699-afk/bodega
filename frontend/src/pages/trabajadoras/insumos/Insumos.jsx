import { useEffect, useState } from "react";
import { Wheat, Phone, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown } from "lucide-react";
import {
  listarInsumos,
  registrarEntradaInsumo,
  registrarSalidaInsumo,
  listarBajoStockInsumo,
  listarProveedoresDeInsumo,
} from "../../../api/insumos";
import Sheet from "../../../components/Sheet";
import "./Insumos.css";

const MOTIVOS_ENTRADA = [
  { valor: "compra", label: "Compra" },
  { valor: "ajuste", label: "Ajuste de conteo" },
];
const MOTIVOS_SALIDA = [
  { valor: "uso", label: "Uso en cocina" },
  { valor: "merma", label: "Merma / dañado" },
  { valor: "ajuste", label: "Ajuste de conteo" },
];

function formVacio() {
  return { tipo: "entrada", insumo_id: "", cantidad: "", motivo: "compra" };
}

export default function Insumos() {
  const [insumos, setInsumos] = useState([]);
  const [bajoStock, setBajoStock] = useState([]);

  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [form, setForm] = useState(formVacio());
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  const [proveedoresPorInsumo, setProveedoresPorInsumo] = useState({});
  const [expandido, setExpandido] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    try {
      const [insumosData, bajoStockData] = await Promise.all([
        listarInsumos(),
        listarBajoStockInsumo(),
      ]);
      setInsumos(insumosData);
      setBajoStock(bajoStockData);
    } catch (err) {
      setError("No se pudieron cargar los insumos");
    }
  }

  function abrirMovimiento() {
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
    setForm((f) => ({ ...f, tipo, motivo: tipo === "entrada" ? "compra" : "uso" }));
  }

  async function guardar() {
    if (!form.insumo_id || !form.cantidad) {
      setError("Selecciona un insumo e ingresa la cantidad");
      return;
    }

    setEnviando(true);
    setError(null);

    const payload = {
      insumo_id: Number(form.insumo_id),
      cantidad: Number(form.cantidad),
      motivo: form.motivo,
    };

    try {
      if (form.tipo === "entrada") {
        await registrarEntradaInsumo(payload);
      } else {
        await registrarSalidaInsumo(payload);
      }
      setMensaje("Movimiento registrado correctamente");
      cerrarSheet(false);
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo registrar el movimiento");
    } finally {
      setEnviando(false);
    }
  }

  async function verProveedores(insumoId) {
    if (expandido === insumoId) {
      setExpandido(null);
      return;
    }
    setExpandido(insumoId);
    if (!proveedoresPorInsumo[insumoId]) {
      try {
        const proveedores = await listarProveedoresDeInsumo(insumoId);
        setProveedoresPorInsumo((prev) => ({ ...prev, [insumoId]: proveedores }));
      } catch (err) {
        setError("No se pudieron cargar los proveedores");
      }
    }
  }

  const motivosDisponibles = form.tipo === "entrada" ? MOTIVOS_ENTRADA : MOTIVOS_SALIDA;

  return (
    <div className="tins-container">
      <header className="tins-header">
        <div>
          <h1>Insumos</h1>
          <p>Ingredientes, empaques y aseo</p>
        </div>
        <button className="tins-btn-nuevo" onClick={abrirMovimiento}>
          Registrar movimiento
        </button>
      </header>

      {mensaje && (
        <div className="tins-mensaje-exito">
          <CheckCircle2 size={16} /> {mensaje}
        </div>
      )}
      {error && !sheetAbierto && <div className="tins-mensaje-error">{error}</div>}

      <section className="tins-seccion">
        <h2>
          <AlertTriangle size={16} />
          Insumos por acabarse
        </h2>

        {bajoStock.length === 0 ? (
          <div className="tins-sin-alertas">
            <CheckCircle2 size={18} />
            <span>Todos los insumos están en buen nivel</span>
          </div>
        ) : (
          <div className="tins-lista-bajo-stock">
            {bajoStock.map((i) => (
              <div key={i.id} className="tins-bajo-stock-card">
                <div className="tins-bajo-stock-info">
                  <span className="tins-nombre">{i.nombre}</span>
                  <span className="tins-badge-bajo">
                    Quedan {i.stock_actual} {i.unidad_medida}
                  </span>
                </div>
                <button className="tins-btn-secundario" onClick={() => verProveedores(i.id)}>
                  <Phone size={14} />
                  Ver proveedor
                </button>

                {expandido === i.id && (
                  <div className="tins-proveedores-lista">
                    {(proveedoresPorInsumo[i.id] || []).length === 0 ? (
                      <p className="tins-sin-proveedor">No hay proveedores registrados para este insumo</p>
                    ) : (
                      proveedoresPorInsumo[i.id].map((prov) => (
                        <a key={prov.id} href={`tel:${prov.celular}`} className="tins-proveedor-fila">
                          <span>{prov.nombre}</span>
                          <span className="tins-proveedor-numero">{prov.celular}</span>
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

      <section className="tins-seccion">
        <h2>
          <Wheat size={16} />
          Catálogo
        </h2>
        <div className="tins-lista-catalogo">
          {insumos.map((i) => (
            <div key={i.id} className="tins-catalogo-fila">
              <span>{i.nombre}</span>
              <span className="tins-catalogo-stock">
                {i.stock_actual} {i.unidad_medida}
              </span>
            </div>
          ))}
        </div>
      </section>

      <Sheet open={sheetAbierto} onOpenChange={cerrarSheet} title="Movimiento de insumo">
        <div className="tins-sheet-body">
          {error && <div className="tins-mensaje-error">{error}</div>}

          <label>Tipo de movimiento</label>
          <div className="tins-tipos">
            <button
              type="button"
              className={`tins-tipo-btn entrada ${form.tipo === "entrada" ? "activo" : ""}`}
              onClick={() => cambiarTipo("entrada")}
            >
              <TrendingUp size={15} />
              Entrada
            </button>
            <button
              type="button"
              className={`tins-tipo-btn salida ${form.tipo === "salida" ? "activo" : ""}`}
              onClick={() => cambiarTipo("salida")}
            >
              <TrendingDown size={15} />
              Salida
            </button>
          </div>

          <label>Insumo</label>
          <select
            value={form.insumo_id}
            onChange={(e) => setForm((f) => ({ ...f, insumo_id: e.target.value }))}
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
            value={form.cantidad}
            onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))}
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

          <button className="tins-btn-primario tins-btn-guardar-sheet" onClick={guardar} disabled={enviando}>
            {enviando ? "Guardando..." : "Guardar movimiento"}
          </button>
        </div>
      </Sheet>
    </div>
  );
}