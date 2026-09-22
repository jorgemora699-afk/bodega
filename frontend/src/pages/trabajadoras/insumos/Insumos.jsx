import { useEffect, useState } from "react";
import {
  Wheat,
  Phone,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Search,
} from "lucide-react";
import {
  listarInsumos,
  registrarEntradaInsumo,
  reportarNivelInsumo,
  listarBajoStockInsumo,
  listarProveedoresDeInsumo,
} from "../../../api/insumos";
import Sheet from "../../../components/Sheet";
import "./Insumos.css";
import VerificacionTrabajadora from "../../../components/VerificacionTrabajadora";

const MOTIVOS_ENTRADA = [
  { valor: "compra", label: "Compra" },
  { valor: "ajuste", label: "Ajuste de conteo" },
];

const MOTIVOS_SALIDA = [
  { valor: "uso", label: "Uso en cocina" },
  { valor: "merma", label: "Merma / dañado" },
];

function formVacio() {
  return {
    tipo: "entrada",
    insumo_id: "",
    cantidad: "",
    motivo: "compra",
  };
}

export default function Insumos() {
  const [insumos, setInsumos] = useState([]);
  const [bajoStock, setBajoStock] = useState([]);

  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [form, setForm] = useState(formVacio());
  const [enviando, setEnviando] = useState(false);
  const [trabajadoraVerificada, setTrabajadoraVerificada] = useState(null);

  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  const [proveedoresPorInsumo, setProveedoresPorInsumo] = useState({});
  const [expandido, setExpandido] = useState(null);
  const [categoriaActiva, setCategoriaActiva] = useState("cocina");
  const [busqueda, setBusqueda] = useState("");
  const [busquedaMovimiento, setBusquedaMovimiento] = useState("");

  const insumosParaMovimiento = insumos.filter((insumo) =>
    insumo.nombre
      .toLowerCase()
      .includes(busquedaMovimiento.toLowerCase())
  );

  const insumoSeleccionado = insumos.find(
    (i) => String(i.id) === String(form.insumo_id)
  );

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setError(null);

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
      motivo: tipo === "entrada" ? "compra" : "uso",
    }));
  }

  function ajustarCantidad(delta) {
    const minimo = form.tipo === "entrada" ? 0.01 : 0;

    setForm((f) => {
      const actual = Number(f.cantidad || 0);
      const siguiente = actual + delta;

      return {
        ...f,
        cantidad: Math.max(minimo, siguiente),
      };
    });
  }

  async function guardar() {
    if (!form.insumo_id || form.cantidad === "" || form.cantidad === null) {
      setError("Selecciona un insumo e ingresa la cantidad");
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
        await registrarEntradaInsumo({
          insumo_id: Number(form.insumo_id),
          cantidad: Number(form.cantidad),
          motivo: form.motivo,
          trabajadora_id: trabajadoraVerificada.id,
        });

        setMensaje("Entrada registrada correctamente");
      } else {
        const unidad = insumoSeleccionado?.unidad_medida || "";

        const resultado = await reportarNivelInsumo({
          insumo_id: Number(form.insumo_id),
          cantidad_restante: Number(form.cantidad),
          motivo: form.motivo,
          trabajadora_id: trabajadoraVerificada.id,
        });

        if (resultado.sin_cambios) {
          setMensaje("El nivel reportado coincide con el registrado, no hubo cambios");
        } else if (resultado.tipo === "entrada") {
          setMensaje(
            `Había menos registrado de lo real: se corrigió agregando ${resultado.cantidad} ${unidad}`
          );
        } else {
          setMensaje(
            `Salida registrada: se consumieron ${resultado.cantidad} ${unidad}`
          );
        }
      }

      cerrarSheet(false);
      cargarDatos();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "No se pudo registrar el movimiento"
      );
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

        setProveedoresPorInsumo((prev) => ({
          ...prev,
          [insumoId]: proveedores,
        }));
      } catch (err) {
        setError("No se pudieron cargar los proveedores");
      }
    }
  }

  const motivosDisponibles =
    form.tipo === "entrada" ? MOTIVOS_ENTRADA : MOTIVOS_SALIDA;

  /* Vista previa de lo que se va a registrar, antes de guardar */
  let previa = null;
  if (
    form.tipo === "salida" &&
    insumoSeleccionado &&
    form.cantidad !== "" &&
    form.cantidad !== null
  ) {
    const stockActual = Number(insumoSeleccionado.stock_actual);
    const restante = Number(form.cantidad);
    const diferencia = Math.round((stockActual - restante) * 100) / 100;
    const unidad = insumoSeleccionado.unidad_medida;

    if (diferencia > 0) {
      previa = {
        tipo: "salida",
        texto: `Se registrará una salida de ${diferencia} ${unidad}`,
      };
    } else if (diferencia < 0) {
      previa = {
        tipo: "entrada",
        texto: `Había menos registrado: se agregarán ${Math.abs(diferencia)} ${unidad}`,
      };
    } else {
      previa = {
        tipo: "igual",
        texto: "Sin cambios respecto al stock actual",
      };
    }
  }

  /*
   * Creamos un conjunto con los IDs que están bajo de stock.
   * Esto nos permite mostrar todos los insumos en una sola lista
   * y saber cuáles necesitan atención.
   */
  const idsBajoStock = new Set(
    bajoStock.map((insumo) => insumo.id)
  );

  /*
   * Los insumos con stock bajo aparecen primero.
   * Los demás aparecen después.
   */
  const insumosOrdenados = [...insumos].sort((a, b) => {
    const aBajo = idsBajoStock.has(a.id);
    const bBajo = idsBajoStock.has(b.id);

    if (aBajo && !bBajo) return -1;
    if (!aBajo && bBajo) return 1;

    return a.nombre.localeCompare(b.nombre);
  });

  const insumosFiltrados = insumosOrdenados.filter(
    (insumo) =>
      insumo.categoria === categoriaActiva &&
      insumo.nombre
        .toLowerCase()
        .includes(busqueda.toLowerCase())
  );

  return (
    <div className="tins-container">

      {/* =========================================
          HEADER
      ========================================= */}

      <header className="tins-header">
        <div>
          <h1>Insumos</h1>
          <p>
            {insumos.length} registrados
            {bajoStock.length > 0 &&
              ` · ${bajoStock.length} por acabarse`}
          </p>
        </div>

        <button
          className="tins-btn-nuevo"
          onClick={abrirMovimiento}
        >
          <TrendingUp size={15} />
          Registrar movimiento
        </button>
      </header>

      {/* =========================================
          MENSAJES
      ========================================= */}

      {mensaje && (
        <div className="tins-mensaje-exito">
          <CheckCircle2 size={16} />
          {mensaje}
        </div>
      )}

      {error && !sheetAbierto && (
        <div className="tins-mensaje-error">
          {error}
        </div>
      )}

      {/* =========================================
          LISTADO DE INSUMOS
      ========================================= */}

      <div className="tins-categorias">
        <button
          className={`tins-categoria-btn ${
            categoriaActiva === "cocina" ? "activo" : ""
          }`}
          onClick={() => {
            setCategoriaActiva("cocina");
            setExpandido(null);
          }}
        >
          🍳 Cocina
        </button>

        <button
          className={`tins-categoria-btn ${
            categoriaActiva === "empaques_aseo" ? "activo" : ""
          }`}
          onClick={() => {
            setCategoriaActiva("empaques_aseo");
            setExpandido(null);
          }}
        >
          📦 Empaques y aseo
        </button>
      </div>

      <div className="tins-buscador">
        <Search size={17} />

        <input
          type="text"
          placeholder="Buscar insumo..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <section className="tins-seccion">

        <h2>
          <Wheat size={16} />
          Mis insumos
        </h2>

        {insumosFiltrados.length === 0 ? (
          <div className="tins-sin-alertas">
            <CheckCircle2 size={18} />
            <span>
              {insumos.length === 0
                ? "No hay insumos registrados"
                : "Ningún insumo coincide con tu búsqueda"}
            </span>
          </div>
        ) : (
          <div className="tins-lista-insumos">

            {insumosFiltrados.map((insumo) => {
              const estaBajoStock = idsBajoStock.has(insumo.id);
              const proveedores =
                proveedoresPorInsumo[insumo.id] || [];

              return (
                <div
                  key={insumo.id}
                  className={`tins-insumo-card ${
                    estaBajoStock ? "stock-bajo" : ""
                  }`}
                >

                  {/* =====================================
                      INFORMACIÓN PRINCIPAL
                  ===================================== */}

                  <div className="tins-insumo-top">

                    <div className="tins-insumo-info">
                      <span className="tins-nombre">
                        {insumo.nombre}
                      </span>

                      <span className="tins-insumo-label">
                        Stock actual
                      </span>

                      <span className="tins-insumo-stock">
                        {insumo.stock_actual}{" "}
                        {insumo.unidad_medida}
                      </span>
                    </div>

                    <div className="tins-insumo-estado">

                      {estaBajoStock ? (
                        <span className="tins-badge-bajo">
                          <AlertTriangle size={12} />
                          Stock bajo
                        </span>
                      ) : (
                        <span className="tins-badge-ok">
                          <CheckCircle2 size={12} />
                          Disponible
                        </span>
                      )}

                    </div>

                  </div>

                  {/* =====================================
                      BOTÓN PROVEEDOR
                  ===================================== */}

                  <button
                    className={`tins-btn-secundario ${
                      expandido === insumo.id
                        ? "activo"
                        : ""
                    }`}
                    onClick={() =>
                      verProveedores(insumo.id)
                    }
                  >
                    <Phone size={14} />

                    {expandido === insumo.id
                      ? "Ocultar proveedores"
                      : "Ver proveedor"}
                  </button>

                  {/* =====================================
                      PROVEEDORES
                  ===================================== */}

                  {expandido === insumo.id && (
                    <div className="tins-proveedores-lista">

                      {proveedores.length === 0 ? (
                        <p className="tins-sin-proveedor">
                          No hay proveedores registrados
                          para este insumo
                        </p>
                      ) : (
                        proveedores.map((prov) => (
                          
                          <a
                            key={prov.id}
                            href={`tel:${prov.celular}`}
                            className="tins-proveedor-fila"
                          >
                            <span>
                              {prov.nombre}
                            </span>

                            <span className="tins-proveedor-numero">
                              {prov.celular}
                            </span>
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

      {/* =========================================
          SHEET - NUEVO MOVIMIENTO
      ========================================= */}

      <Sheet
        open={sheetAbierto}
        onOpenChange={cerrarSheet}
        title="Movimiento de insumo"
      >
        <div className="tins-sheet-body">

          {error && (
            <div className="tins-mensaje-error">
              {error}
            </div>
          )}

          {!trabajadoraVerificada ? (
            <VerificacionTrabajadora onVerificado={setTrabajadoraVerificada} />
          ) : (
            <>
              {/* TIPO */}

              <label>Tipo de movimiento</label>

              <div className="tins-tipos">

                <button
                  type="button"
                  className={`tins-tipo-btn entrada ${
                    form.tipo === "entrada" ? "activo" : ""
                  }`}
                  onClick={() => cambiarTipo("entrada")}
                >
                  <TrendingUp size={15} />
                  Entrada
                </button>

                <button
                  type="button"
                  className={`tins-tipo-btn salida ${
                    form.tipo === "salida" ? "activo" : ""
                  }`}
                  onClick={() => cambiarTipo("salida")}
                >
                  <TrendingDown size={15} />
                  Salida
                </button>

              </div>

              {/* INSUMO */}

              <label>Buscar insumo</label>

              <div className="tins-buscador-movimiento">
                <Search size={16} />

                <input
                  type="text"
                  placeholder="Escribe el nombre del insumo..."
                  value={busquedaMovimiento}
                  onChange={(e) => {
                    setBusquedaMovimiento(e.target.value);

                    setForm((f) => ({
                      ...f,
                      insumo_id: "",
                    }));
                  }}
                />
              </div>

              {busquedaMovimiento && !form.insumo_id && (
                <div className="tins-resultados-movimiento">
                  {insumosParaMovimiento.length === 0 ? (
                    <p className="tins-sin-resultados">
                      No se encontraron insumos
                    </p>
                  ) : (
                    insumosParaMovimiento.map((insumo) => (
                      <button
                        type="button"
                        key={insumo.id}
                        className="tins-resultado-movimiento"
                        onClick={() => {
                          setForm((f) => ({
                            ...f,
                            insumo_id: String(insumo.id),
                          }));

                          setBusquedaMovimiento(insumo.nombre);
                          setError(null);
                        }}
                      >
                        <div>
                          <strong>{insumo.nombre}</strong>

                          <span>
                            Stock actual: {insumo.stock_actual}{" "}
                            {insumo.unidad_medida}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* CANTIDAD */}

              <label>
                {form.tipo === "entrada"
                  ? "Cantidad"
                  : "¿Cuánto queda actualmente?"}
              </label>

              {form.tipo === "salida" && insumoSeleccionado && (
                <p className="tins-stock-referencia">
                  Stock registrado: {insumoSeleccionado.stock_actual}{" "}
                  {insumoSeleccionado.unidad_medida}
                </p>
              )}

              <div className="tins-stepper">
                <button
                  type="button"
                  className="tins-stepper-btn"
                  onClick={() => ajustarCantidad(-1)}
                >
                  −
                </button>

                <input
                  type="number"
                  min={form.tipo === "entrada" ? "0.01" : "0"}
                  step="0.01"
                  value={form.cantidad}
                  onChange={(e) => {
                    const valor = e.target.value;

                    setForm((f) => ({
                      ...f,
                      cantidad: valor,
                    }));
                  }}
                  placeholder={form.tipo === "entrada" ? "Ej: 5" : "Ej: 3"}
                  className="tins-stepper-input"
                />

                <button
                  type="button"
                  className="tins-stepper-btn"
                  onClick={() => ajustarCantidad(1)}
                >
                  +
                </button>
              </div>

              {previa && (
                <p className={`tins-previa tins-previa-${previa.tipo}`}>
                  {previa.texto}
                </p>
              )}

              {/* MOTIVO */}

              <label>Motivo</label>

              <select
                value={form.motivo}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    motivo: e.target.value,
                  }))
                }
              >
                {motivosDisponibles.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.label}
                  </option>
                ))}
              </select>

              {form.tipo === "salida" && (
                <p className="tins-hint-motivo">
                  Si resulta que había más stock del registrado, se corrige
                  automáticamente como un ajuste, sin importar el motivo elegido.
                </p>
              )}

              {/* GUARDAR */}

              <button
                className="tins-btn-primario tins-btn-guardar-sheet"
                onClick={guardar}
                disabled={enviando}
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