import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Package2,
  Phone,
  MoreVertical,
  History,
  X,
} from "lucide-react";

import {
  listarInsumos,
  crearInsumo,
  actualizarInsumo,
  eliminarInsumo,
  listarMovimientosInsumo,
  registrarEntradaInsumo,
  registrarSalidaInsumo,
  listarProveedoresDeInsumo,
} from "../../../api/insumos";

import { listarTrabajadoras } from "../../../api/trabajadoras";
import Sheet from "../../../components/Sheet";
import "./Insumos.css";

const UNIDADES = ["unidad", "g", "kg", "ml", "l", "paquete"];

const CATEGORIAS = [
  { valor: "cocina", label: "Cocina" },
  { valor: "empaques_aseo", label: "Empaques y aseo" },
];

const MOTIVOS_ENTRADA = [
  { valor: "compra", label: "Compra" },
  { valor: "ajuste", label: "Ajuste de conteo" },
];

const MOTIVOS_SALIDA = [
  { valor: "uso", label: "Uso en cocina" },
  { valor: "merma", label: "Merma / dañado" },
  { valor: "ajuste", label: "Ajuste de conteo" },
];

function formCatalogoVacio() {
  return {
    nombre: "",
    categoria: "cocina",
    unidad_medida: "unidad",
    stock_minimo: "5",
    stock_actual: "",
  };
}

function formMovimientoVacio() {
  return {
    tipo: "entrada",
    insumo_id: "",
    cantidad: "",
    motivo: "compra",
    trabajadora_id: "",
  };
}

function formatearFecha(isoString) {
  return new Date(isoString).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Insumos() {
  const [insumos, setInsumos] = useState([]);
  const [trabajadoras, setTrabajadoras] = useState([]);
  const [proveedoresPorInsumo, setProveedoresPorInsumo] = useState({});
  const [verProveedoresId, setVerProveedoresId] = useState(null);

  const [movimientos, setMovimientos] = useState([]);

  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [soloBajoStock, setSoloBajoStock] = useState(false);

  const [sheetCatalogoAbierto, setSheetCatalogoAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formCatalogo, setFormCatalogo] = useState(
    formCatalogoVacio()
  );

  const [categoriasAbiertas, setCategoriasAbiertas] = useState({
    cocina: true,
    empaques_aseo: true,
  });

  const [sheetMovimientoAbierto, setSheetMovimientoAbierto] =
    useState(false);

  const [sheetMovimientosAbierto, setSheetMovimientosAbierto] =
    useState(false);

  const [formMovimiento, setFormMovimiento] = useState(
    formMovimientoVacio()
  );

  const [menuAbiertoId, setMenuAbiertoId] = useState(null);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(null);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setError(null);

    try {
      const [
        insumosData,
        trabajadorasData,
        movimientosData,
      ] = await Promise.all([
        listarInsumos(),
        listarTrabajadoras(),
        listarMovimientosInsumo(),
      ]);

      setInsumos(insumosData);
      setTrabajadoras(trabajadorasData);
      setMovimientos(movimientosData.slice(0, 15));
    } catch (err) {
      setError("No se pudieron cargar los insumos");
    }
  }

  // --------------------------------------------------
  // PROVEEDORES
  // --------------------------------------------------

  async function toggleProveedores(insumoId) {
    setMenuAbiertoId(null);

    if (verProveedoresId === insumoId) {
      setVerProveedoresId(null);
      return;
    }

    setVerProveedoresId(insumoId);

    if (!proveedoresPorInsumo[insumoId]) {
      try {
        const proveedores = await listarProveedoresDeInsumo(
          insumoId
        );

        setProveedoresPorInsumo((prev) => ({
          ...prev,
          [insumoId]: proveedores,
        }));
      } catch (err) {
        setError("No se pudieron cargar los proveedores");
      }
    }
  }

  // --------------------------------------------------
  // CATÁLOGO
  // --------------------------------------------------

  function iniciarCreacionCatalogo() {
    setEditandoId(null);
    setFormCatalogo(formCatalogoVacio());
    setMensaje(null);
    setError(null);
    setMenuAbiertoId(null);
    setSheetCatalogoAbierto(true);
  }

  function iniciarEdicionCatalogo(insumo) {
    setEditandoId(insumo.id);
    setMensaje(null);
    setError(null);
    setMenuAbiertoId(null);

    setFormCatalogo({
      nombre: insumo.nombre,
      categoria: insumo.categoria,
      unidad_medida: insumo.unidad_medida,
      stock_minimo: insumo.stock_minimo,
      stock_actual: "",
    });

    setSheetCatalogoAbierto(true);
  }

  function cerrarSheetCatalogo(abierto) {
    setSheetCatalogoAbierto(abierto);

    if (!abierto) {
      setEditandoId(null);
      setFormCatalogo(formCatalogoVacio());
    }
  }

  async function guardarCatalogo() {
    if (!formCatalogo.nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      if (editandoId) {
        await actualizarInsumo(editandoId, {
          nombre: formCatalogo.nombre,
          categoria: formCatalogo.categoria,
          unidad_medida: formCatalogo.unidad_medida,
          stock_minimo:
            Number(formCatalogo.stock_minimo) || 0,
        });

        setMensaje("Insumo actualizado");
      } else {
        await crearInsumo({
          nombre: formCatalogo.nombre,
          categoria: formCatalogo.categoria,
          unidad_medida: formCatalogo.unidad_medida,
          stock_minimo:
            Number(formCatalogo.stock_minimo) || 0,
          stock_actual:
            Number(formCatalogo.stock_actual) || 0,
        });

        setMensaje("Insumo creado");
      }

      cerrarSheetCatalogo(false);
      cargarDatos();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "No se pudo guardar el insumo"
      );
    } finally {
      setGuardando(false);
    }
  }

  // --------------------------------------------------
  // ELIMINAR / DESACTIVAR
  // --------------------------------------------------

  async function confirmarEliminar(insumoId) {
    setGuardando(true);
    setError(null);

    try {
      await eliminarInsumo(insumoId);

      setMensaje("Insumo desactivado");
      setConfirmandoEliminar(null);
      setMenuAbiertoId(null);

      cargarDatos();
    } catch (err) {
      setError("No se pudo desactivar el insumo");
    } finally {
      setGuardando(false);
    }
  }

  // --------------------------------------------------
  // MOVIMIENTOS
  // --------------------------------------------------

  function iniciarMovimiento() {
    setFormMovimiento(formMovimientoVacio());
    setMensaje(null);
    setError(null);
    setMenuAbiertoId(null);
    setSheetMovimientoAbierto(true);
  }

  function cerrarSheetMovimiento(abierto) {
    setSheetMovimientoAbierto(abierto);

    if (!abierto) {
      setFormMovimiento(formMovimientoVacio());
    }
  }

  function cambiarTipoMovimiento(tipo) {
    setFormMovimiento((f) => ({
      ...f,
      tipo,
      motivo:
        tipo === "entrada"
          ? "compra"
          : "uso",
    }));
  }

  async function guardarMovimiento() {
    if (
      !formMovimiento.insumo_id ||
      !formMovimiento.cantidad
    ) {
      setError(
        "Selecciona un insumo e ingresa la cantidad"
      );
      return;
    }

    setGuardando(true);
    setError(null);

    const payload = {
      insumo_id: Number(formMovimiento.insumo_id),
      cantidad: Number(formMovimiento.cantidad),
      motivo: formMovimiento.motivo,
      trabajadora_id:
        formMovimiento.trabajadora_id
          ? Number(formMovimiento.trabajadora_id)
          : null,
    };

    try {
      if (formMovimiento.tipo === "entrada") {
        await registrarEntradaInsumo(payload);
      } else {
        await registrarSalidaInsumo(payload);
      }

      setMensaje(
        "Movimiento registrado correctamente"
      );

      cerrarSheetMovimiento(false);
      cargarDatos();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "No se pudo registrar el movimiento"
      );
    } finally {
      setGuardando(false);
    }
  }

  const motivosDisponibles =
    formMovimiento.tipo === "entrada"
      ? MOTIVOS_ENTRADA
      : MOTIVOS_SALIDA;

  // --------------------------------------------------
  // FILTROS
  // --------------------------------------------------

  const insumosFiltrados = insumos.filter((i) => {
    const coincideBusqueda = i.nombre
      .toLowerCase()
      .includes(busqueda.toLowerCase());

    const coincideCategoria =
      !categoriaFiltro ||
      i.categoria === categoriaFiltro;

    const coincideStock =
      !soloBajoStock ||
      Number(i.stock_actual) <= Number(i.stock_minimo);

    return coincideBusqueda && coincideCategoria && coincideStock;
  });

  // --------------------------------------------------
  // CATEGORÍAS
  // --------------------------------------------------

  function toggleCategoria(categoria) {
    setCategoriasAbiertas((prev) => ({
      ...prev,
      [categoria]: !prev[categoria],
    }));
  }

  // --------------------------------------------------
  // STOCK
  // --------------------------------------------------

  function obtenerEstadoStock(insumo) {
    const actual = Number(insumo.stock_actual);
    const minimo = Number(insumo.stock_minimo);

    if (actual <= 0) {
      return {
        clase: "agotado",
        texto: "Agotado",
      };
    }

    if (actual <= minimo) {
      return {
        clase: "bajo",
        texto: "Stock bajo",
      };
    }

    return {
      clase: "normal",
      texto: "Disponible",
    };
  }

  // --------------------------------------------------
  // TARJETA
  // --------------------------------------------------

  function renderTarjeta(i) {
    const stock = obtenerEstadoStock(i);
    const proveedoresAbiertos =
      verProveedoresId === i.id;

    const menuAbierto =
      menuAbiertoId === i.id;

    const confirmando =
      confirmandoEliminar === i.id;

    return (
      <div
        key={i.id}
        className={`ins-tarjeta ins-tarjeta-${stock.clase}`}
      >
        <div className="ins-fila-principal">
          <div className="ins-info-principal">
            <span className="ins-nombre">
              {i.nombre}
            </span>

            <span className="ins-detalle-stock">
              {i.stock_actual} {i.unidad_medida}
            </span>
          </div>

          <div className="ins-stock-area">
            <span
              className={`ins-estado-stock ${stock.clase}`}
            >
              {stock.clase === "bajo" ||
              stock.clase === "agotado" ? (
                <AlertTriangle size={11} />
              ) : null}

              {stock.texto}
            </span>

            <button
              type="button"
              className="ins-menu-btn"
              onClick={() =>
                setMenuAbiertoId(
                  menuAbierto ? null : i.id
                )
              }
            >
              <MoreVertical size={17} />
            </button>

            {menuAbierto && (
              <div className="ins-menu">
                <button
                  type="button"
                  onClick={() =>
                    iniciarEdicionCatalogo(i)
                  }
                >
                  <Pencil size={14} />
                  Editar
                </button>

                <button
                  type="button"
                  onClick={() =>
                    toggleProveedores(i.id)
                  }
                >
                  <Phone size={14} />
                  {proveedoresAbiertos
                    ? "Ocultar proveedor"
                    : "Ver proveedor"}
                </button>

                <button
                  type="button"
                  className="peligro"
                  onClick={() => {
                    setConfirmandoEliminar(i.id);
                    setMenuAbiertoId(null);
                  }}
                >
                  <Trash2 size={14} />
                  Desactivar
                </button>
              </div>
            )}
          </div>
        </div>

        {proveedoresAbiertos && (
          <div className="ins-proveedores-lista ins-proveedores-lista-tarjeta">
            {(proveedoresPorInsumo[i.id] || [])
              .length === 0 ? (
              <p className="ins-sin-proveedor-tarjeta">
                Sin proveedores registrados
              </p>
            ) : (
              proveedoresPorInsumo[i.id].map(
                (prov) => (
                  <div
                    key={prov.id}
                    className="ins-proveedor-fila"
                  >
                    <span>{prov.nombre}</span>

                    <a
                      href={`tel:${prov.celular}`}
                    >
                      {prov.celular}
                    </a>
                  </div>
                )
              )
            )}
          </div>
        )}

        {confirmando && (
          <div className="ins-confirmar">
            <span>
              ¿Desactivar este insumo?
            </span>

            <div className="ins-botones">
              <button
                className="ins-btn-secundario"
                onClick={() =>
                  setConfirmandoEliminar(null)
                }
                disabled={guardando}
              >
                No
              </button>

              <button
                className="ins-btn-peligro"
                onClick={() =>
                  confirmarEliminar(i.id)
                }
                disabled={guardando}
              >
                {guardando
                  ? "Desactivando..."
                  : "Sí, desactivar"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div
      className="ins-container"
      onClick={() => {
        if (menuAbiertoId !== null) {
          setMenuAbiertoId(null);
        }
      }}
    >
      {/* HEADER */}

      <header className="ins-header">
        <div>
          <h1>Insumos</h1>
          <p>
            Ingredientes, empaques y aseo
          </p>
        </div>

        <div className="ins-header-botones">
          <button
            className="ins-btn-secundario"
            onClick={(e) => {
              e.stopPropagation();
              iniciarMovimiento();
            }}
          >
            <Package2 size={15} />
            Movimiento
          </button>

          <button
            className="ins-btn-nuevo"
            onClick={(e) => {
              e.stopPropagation();
              iniciarCreacionCatalogo();
            }}
          >
            <Plus size={16} />
            Nuevo
          </button>
        </div>
      </header>

      {/* MENSAJES */}

      {mensaje && (
        <div className="ins-mensaje-exito">
          {mensaje}
        </div>
      )}

      {error &&
        !sheetCatalogoAbierto &&
        !sheetMovimientoAbierto &&
        !sheetMovimientosAbierto && (
          <div className="ins-mensaje-error">
            {error}
          </div>
        )}

      {/* BUSCADOR */}

      {insumos.length > 0 && (
        <>
          <div className="ins-buscador">
            <Search size={16} />

            <input
              type="text"
              placeholder="Buscar insumo..."
              value={busqueda}
              onChange={(e) =>
                setBusqueda(e.target.value)
              }
            />

            {busqueda && (
              <button
                type="button"
                className="ins-buscador-limpiar"
                onClick={() => setBusqueda("")}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* FILTROS */}

          <div className="ins-filtros-categoria">
            <button
              type="button"
              className={`ins-chip ${
                categoriaFiltro === "" ? "activo" : ""
              }`}
              onClick={() => setCategoriaFiltro("")}
            >
              Todos
            </button>

            {CATEGORIAS.map((c) => (
              <button
                key={c.valor}
                type="button"
                className={`ins-chip ${
                  categoriaFiltro === c.valor ? "activo" : ""
                }`}
                onClick={() => setCategoriaFiltro(c.valor)}
              >
                {c.label}
              </button>
            ))}

            <button
              type="button"
              className={`ins-chip ins-chip-alerta ${
                soloBajoStock ? "activo" : ""
              }`}
              onClick={() => setSoloBajoStock((v) => !v)}
            >
              <AlertTriangle size={12} />
              Por acabarse
            </button>
          </div>
        </>
      )}

      {/* CONTENIDO */}

      <section className="ins-seccion">
        {insumos.length === 0 && (
          <div className="ins-vacio">
            <Package2 size={30} />
            <p>
              Todavía no hay insumos registrados
            </p>

            <button
              className="ins-btn-nuevo"
              onClick={iniciarCreacionCatalogo}
            >
              <Plus size={15} />
              Crear primer insumo
            </button>
          </div>
        )}

        {insumos.length > 0 &&
          insumosFiltrados.length === 0 && (
            <p className="ins-sin-datos">
              Ningún insumo coincide con la búsqueda
            </p>
          )}

        {categoriaFiltro === ""
          ? CATEGORIAS.map((cat) => {
              const items =
                insumosFiltrados.filter(
                  (i) =>
                    i.categoria === cat.valor
                );

              if (items.length === 0) {
                return null;
              }

              const abierta =
                categoriasAbiertas[
                  cat.valor
                ];

              return (
                <div
                  key={cat.valor}
                  className="ins-grupo"
                >
                  <button
                    type="button"
                    className="ins-grupo-header"
                    onClick={() =>
                      toggleCategoria(
                        cat.valor
                      )
                    }
                  >
                    <div className="ins-grupo-info">
                      <span className="ins-grupo-titulo">
                        {cat.label}
                      </span>

                      <span className="ins-grupo-cantidad">
                        {items.length}{" "}
                        {items.length === 1
                          ? "insumo"
                          : "insumos"}
                      </span>
                    </div>

                    <span className="ins-grupo-flecha">
                      {abierta ? "⌃" : "⌄"}
                    </span>
                  </button>

                  {abierta && (
                    <div className="ins-lista">
                      {items.map(renderTarjeta)}
                    </div>
                  )}
                </div>
              );
            })
          : (
            <div className="ins-lista">
              {insumosFiltrados.map(
                renderTarjeta
              )}
            </div>
          )}
      </section>

      {/* ACCIONES INFERIORES */}

      {movimientos.length > 0 && (
        <div className="ins-acciones-secundarias">
          <button
            type="button"
            className="ins-btn-historial"
            onClick={() =>
              setSheetMovimientosAbierto(true)
            }
          >
            <History size={15} />
            Ver movimientos recientes
          </button>
        </div>
      )}

      {/* SHEET: CATÁLOGO */}

      <Sheet
        open={sheetCatalogoAbierto}
        onOpenChange={cerrarSheetCatalogo}
        title={
          editandoId
            ? "Editar insumo"
            : "Nuevo insumo"
        }
      >
        <div className="ins-form">
          {error && (
            <div className="ins-mensaje-error">
              {error}
            </div>
          )}

          <label>Nombre</label>

          <input
            type="text"
            value={formCatalogo.nombre}
            onChange={(e) =>
              setFormCatalogo((f) => ({
                ...f,
                nombre: e.target.value,
              }))
            }
            placeholder="Ej: Carne molida"
          />

          <label>Categoría</label>

          <div className="ins-categoria-toggle">
            {CATEGORIAS.map((c) => (
              <button
                key={c.valor}
                type="button"
                className={`ins-categoria-btn ${
                  formCatalogo.categoria ===
                  c.valor
                    ? "activo"
                    : ""
                }`}
                onClick={() =>
                  setFormCatalogo((f) => ({
                    ...f,
                    categoria: c.valor,
                  }))
                }
              >
                {c.label}
              </button>
            ))}
          </div>

          <label>Unidad de medida</label>

          <select
            value={
              formCatalogo.unidad_medida
            }
            onChange={(e) =>
              setFormCatalogo((f) => ({
                ...f,
                unidad_medida: e.target.value,
              }))
            }
          >
            {UNIDADES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>

          <label>
            Stock mínimo
          </label>

          <input
            type="number"
            min="0"
            step="0.01"
            value={
              formCatalogo.stock_minimo
            }
            onChange={(e) =>
              setFormCatalogo((f) => ({
                ...f,
                stock_minimo:
                  e.target.value,
              }))
            }
          />

          {!editandoId && (
            <>
              <label>
                Stock inicial
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  formCatalogo.stock_actual
                }
                onChange={(e) =>
                  setFormCatalogo((f) => ({
                    ...f,
                    stock_actual:
                      e.target.value,
                  }))
                }
              />
            </>
          )}

          {editandoId && (
            <p className="ins-nota-stock">
              Para cambiar el stock actual,
              usa "Movimiento".
            </p>
          )}

          <button
            className="ins-btn-primario ins-btn-guardar-sheet"
            onClick={guardarCatalogo}
            disabled={guardando}
          >
            {guardando
              ? "Guardando..."
              : "Guardar"}
          </button>
        </div>
      </Sheet>

      {/* SHEET: MOVIMIENTO */}

      <Sheet
        open={sheetMovimientoAbierto}
        onOpenChange={cerrarSheetMovimiento}
        title="Nuevo movimiento de insumo"
      >
        <div className="ins-form">
          {error && (
            <div className="ins-mensaje-error">
              {error}
            </div>
          )}

          <label>
            Tipo de movimiento
          </label>

          <div className="ins-tipos">
            <button
              type="button"
              className={`ins-tipo-btn entrada ${
                formMovimiento.tipo ===
                "entrada"
                  ? "activo"
                  : ""
              }`}
              onClick={() =>
                cambiarTipoMovimiento(
                  "entrada"
                )
              }
            >
              <TrendingUp size={15} />
              Entrada
            </button>

            <button
              type="button"
              className={`ins-tipo-btn salida ${
                formMovimiento.tipo ===
                "salida"
                  ? "activo"
                  : ""
              }`}
              onClick={() =>
                cambiarTipoMovimiento(
                  "salida"
                )
              }
            >
              <TrendingDown size={15} />
              Salida
            </button>
          </div>

          <label>Insumo</label>

          <select
            value={
              formMovimiento.insumo_id
            }
            onChange={(e) =>
              setFormMovimiento((f) => ({
                ...f,
                insumo_id:
                  e.target.value,
              }))
            }
          >
            <option value="">
              Selecciona...
            </option>

            {insumos.map((i) => (
              <option
                key={i.id}
                value={i.id}
              >
                {i.nombre} (stock:{" "}
                {i.stock_actual}{" "}
                {i.unidad_medida})
              </option>
            ))}
          </select>

          <label>Cantidad</label>

          <input
            type="number"
            min="0.01"
            step="0.01"
            value={
              formMovimiento.cantidad
            }
            onChange={(e) =>
              setFormMovimiento((f) => ({
                ...f,
                cantidad:
                  e.target.value,
              }))
            }
          />

          <label>Motivo</label>

          <select
            value={
              formMovimiento.motivo
            }
            onChange={(e) =>
              setFormMovimiento((f) => ({
                ...f,
                motivo:
                  e.target.value,
              }))
            }
          >
            {motivosDisponibles.map(
              (m) => (
                <option
                  key={m.valor}
                  value={m.valor}
                >
                  {m.label}
                </option>
              )
            )}
          </select>

          <label>
            ¿Quién lo registra? (opcional)
          </label>

          <select
            value={
              formMovimiento.trabajadora_id
            }
            onChange={(e) =>
              setFormMovimiento((f) => ({
                ...f,
                trabajadora_id:
                  e.target.value,
              }))
            }
          >
            <option value="">
              Sin especificar
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

          <button
            className="ins-btn-primario ins-btn-guardar-sheet"
            onClick={guardarMovimiento}
            disabled={guardando}
          >
            {guardando
              ? "Guardando..."
              : "Guardar movimiento"}
          </button>
        </div>
      </Sheet>

      {/* SHEET: MOVIMIENTOS */}

      <Sheet
        open={sheetMovimientosAbierto}
        onOpenChange={
          setSheetMovimientosAbierto
        }
        title="Movimientos recientes"
      >
        <div className="ins-historial">
          {movimientos.length === 0 ? (
            <p className="ins-sin-datos">
              No hay movimientos registrados.
            </p>
          ) : (
            movimientos.map((m) => (
              <div
                key={m.id}
                className="ins-mov-fila"
              >
                <span
                  className={`ins-mov-icono ${m.tipo}`}
                >
                  {m.tipo === "entrada" ? (
                    <TrendingUp size={14} />
                  ) : (
                    <TrendingDown size={14} />
                  )}
                </span>

                <div className="ins-mov-info">
                  <span className="ins-mov-nombre">
                    {m.insumo_nombre}
                  </span>

                  <span className="ins-mov-detalle">
                    {m.motivo} ·{" "}
                    {formatearFecha(
                      m.fecha
                    )}
                  </span>
                </div>

                <span
                  className={`ins-mov-cantidad ${m.tipo}`}
                >
                  {m.tipo === "entrada"
                    ? "+"
                    : "-"}
                  {m.cantidad}
                </span>
              </div>
            ))
          )}
        </div>
      </Sheet>
    </div>
  );
}