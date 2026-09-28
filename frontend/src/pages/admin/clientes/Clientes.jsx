import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search, User, Building2, Tag, X } from "lucide-react";
import {
  listarClientes,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
  listarPreciosEspeciales,
  crearPrecioEspecial,
  eliminarPrecioEspecial,
} from "../../../api/clientes";
import { listarProductos } from "../../../api/productos";
import Sheet from "../../../components/Sheet";
import CampoMoneda from "../../../components/CampoMoneda";
import "./Clientes.css";

function formVacio() {
  return {
    tipo: "natural",
    nombre: "",
    documento: "",
    contacto: "",
    celular: "",
    direccion: "",
  };
}

function formatearMoneda(valor) {
  return `$${Number(valor).toLocaleString("es-CO")}`;
}

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState("");

  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(formVacio());
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(null);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  /* Precios especiales */
  const [precioSheetAbierto, setPrecioSheetAbierto] = useState(false);
  const [clienteParaPrecios, setClienteParaPrecios] = useState(null);
  const [preciosEspeciales, setPreciosEspeciales] = useState([]);
  const [cargandoPrecios, setCargandoPrecios] = useState(false);
  const [categoriaFiltroPrecio, setCategoriaFiltroPrecio] = useState("");

  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [sugerenciasAbiertas, setSugerenciasAbiertas] = useState(false);
  const [productoElegido, setProductoElegido] = useState(null);
  const [precioNuevo, setPrecioNuevo] = useState("");
  const [guardandoPrecio, setGuardandoPrecio] = useState(false);
  const [errorPrecio, setErrorPrecio] = useState(null);

  useEffect(() => {
    cargarDatos();
    listarProductos().then(setProductos).catch(() => setProductos([]));
  }, []);

  async function cargarDatos() {
    setError(null);
    try {
      setClientes(await listarClientes());
    } catch (err) {
      setError("No se pudieron cargar los clientes");
    }
  }

  function iniciarCreacion() {
    setEditandoId(null);
    setForm(formVacio());
    setMensaje(null);
    setError(null);
    setSheetAbierto(true);
  }

  function iniciarEdicion(cliente) {
    setEditandoId(cliente.id);
    setMensaje(null);
    setError(null);
    setForm({
      tipo: cliente.tipo,
      nombre: cliente.nombre,
      documento: cliente.documento,
      contacto: cliente.contacto || "",
      celular: cliente.celular || "",
      direccion: cliente.direccion || "",
    });
    setSheetAbierto(true);
  }

  function cerrarSheet(abierto) {
    setSheetAbierto(abierto);
    if (!abierto) {
      setEditandoId(null);
      setForm(formVacio());
    }
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.documento.trim()) {
      setError(
        form.tipo === "juridica"
          ? "Razón social y NIT son obligatorios"
          : "Nombre y cédula son obligatorios"
      );
      return;
    }

    setGuardando(true);
    setError(null);

    const payload = {
      tipo: form.tipo,
      nombre: form.nombre.trim(),
      documento: form.documento.trim(),
      contacto: form.tipo === "juridica" ? form.contacto.trim() || null : null,
      celular: form.celular.trim() || null,
      direccion: form.direccion.trim() || null,
    };

    try {
      if (editandoId) {
        await actualizarCliente(editandoId, payload);
        setMensaje("Cliente actualizado");
      } else {
        await crearCliente(payload);
        setMensaje("Cliente creado");
      }
      cerrarSheet(false);
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar el cliente");
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminar(clienteId) {
    setGuardando(true);
    setError(null);
    try {
      await eliminarCliente(clienteId);
      setMensaje("Cliente desactivado");
      setConfirmandoEliminar(null);
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo desactivar el cliente");
    } finally {
      setGuardando(false);
    }
  }

  /* ---------- Precios especiales ---------- */

  function abrirPrecios(cliente) {
  setClienteParaPrecios(cliente);
  setPrecioSheetAbierto(true);
  setBusquedaProducto("");
  setCategoriaFiltroPrecio("");
  setProductoElegido(null);
  setPrecioNuevo("");
  setErrorPrecio(null);
  cargarPreciosDeCliente(cliente.id);
}

  async function cargarPreciosDeCliente(clienteId) {
    setCargandoPrecios(true);
    try {
      setPreciosEspeciales(await listarPreciosEspeciales(clienteId));
    } catch (err) {
      setPreciosEspeciales([]);
    } finally {
      setCargandoPrecios(false);
    }
  }

  function cerrarPrecioSheet(abierto) {
    setPrecioSheetAbierto(abierto);
    if (!abierto) {
      setClienteParaPrecios(null);
      setPreciosEspeciales([]);
    }
  }

  async function handleAgregarPrecio() {
    if (!productoElegido) {
      setErrorPrecio("Selecciona un producto");
      return;
    }
    if (!precioNuevo || Number(precioNuevo) <= 0) {
      setErrorPrecio("Ingresa un precio válido");
      return;
    }

    setGuardandoPrecio(true);
    setErrorPrecio(null);
    try {
      await crearPrecioEspecial(clienteParaPrecios.id, {
        producto_id: productoElegido.id,
        precio: Number(precioNuevo),
      });
      setBusquedaProducto("");
      setProductoElegido(null);
      setPrecioNuevo("");
      cargarPreciosDeCliente(clienteParaPrecios.id);
    } catch (err) {
      setErrorPrecio(err.response?.data?.error || "No se pudo guardar el precio especial");
    } finally {
      setGuardandoPrecio(false);
    }
  }

  async function handleEliminarPrecio(precioEspecialId) {
    try {
      await eliminarPrecioEspecial(precioEspecialId);
      cargarPreciosDeCliente(clienteParaPrecios.id);
    } catch (err) {
      setErrorPrecio("No se pudo eliminar el precio especial");
    }
  }

  const clientesFiltrados = clientes.filter(
    (c) =>
      c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.documento.toLowerCase().includes(busqueda.toLowerCase())
  );

  const categoriasDisponibles = [...new Set(productos.map((p) => p.categoria).filter(Boolean))].sort();

  const productosSugeridos = productos
    .filter((p) => p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()))
    .filter((p) => !categoriaFiltroPrecio || p.categoria === categoriaFiltroPrecio)
    .filter((p) => !preciosEspeciales.some((pe) => pe.producto_id === p.id))
    .slice(0, 30);

  return (
    <div className="cli-container">
      <header className="cli-header">
        <div>
          <h1>Clientes</h1>
          <p>Datos de clientes y precios especiales</p>
        </div>
        <button className="cli-btn-nuevo" onClick={iniciarCreacion}>
          <Plus size={16} />
          Nuevo
        </button>
      </header>

      {mensaje && <div className="cli-mensaje-exito">{mensaje}</div>}
      {error && !sheetAbierto && <div className="cli-mensaje-error">{error}</div>}

      <div className="cli-buscador">
        <Search size={16} />
        <input
          type="text"
          placeholder="Buscar por nombre o documento..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="cli-lista">
        {clientesFiltrados.map((c) => (
          <div key={c.id} className="cli-tarjeta">
            <div className="cli-fila-principal">
              <div className="cli-info">
                <span className="cli-icono">
                  {c.tipo === "juridica" ? <Building2 size={16} /> : <User size={16} />}
                </span>
                <div>
                  <span className="cli-nombre">
                    {c.nombre}
                    {c.es_predeterminado && <span className="cli-badge-predeterminado">Predeterminado</span>}
                  </span>
                  <span className="cli-documento">
                    {c.tipo === "juridica" ? "NIT" : "Cédula"}: {c.documento}
                  </span>
                </div>
              </div>
            </div>

            {(c.celular || c.direccion) && (
              <div className="cli-detalle">
                {c.celular && <span>{c.celular}</span>}
                {c.celular && c.direccion && <span>·</span>}
                {c.direccion && <span>{c.direccion}</span>}
              </div>
            )}

            {confirmandoEliminar === c.id ? (
              <div className="cli-confirmar">
                <span>¿Desactivar este cliente?</span>
                <div className="cli-botones">
                  <button
                    className="cli-btn-secundario"
                    onClick={() => setConfirmandoEliminar(null)}
                    disabled={guardando}
                  >
                    No
                  </button>
                  <button
                    className="cli-btn-peligro"
                    onClick={() => confirmarEliminar(c.id)}
                    disabled={guardando}
                  >
                    Sí, desactivar
                  </button>
                </div>
              </div>
            ) : (
              <div className="cli-acciones">
                <button className="cli-btn-secundario" onClick={() => abrirPrecios(c)}>
                  <Tag size={13} />
                  Precios especiales
                </button>
                <button className="cli-btn-secundario" onClick={() => iniciarEdicion(c)}>
                  <Pencil size={13} />
                  Editar
                </button>
                {!c.es_predeterminado && (
                  <button
                    className="cli-btn-peligro-outline"
                    onClick={() => setConfirmandoEliminar(c.id)}
                  >
                    <Trash2 size={13} />
                    Desactivar
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {clientes.length === 0 && (
          <p className="cli-sin-datos">Todavía no hay clientes registrados</p>
        )}
        {clientes.length > 0 && clientesFiltrados.length === 0 && (
          <p className="cli-sin-datos">Ningún cliente coincide con la búsqueda</p>
        )}
      </div>

      {/* ---------- Sheet: crear/editar cliente ---------- */}

      <Sheet
        open={sheetAbierto}
        onOpenChange={cerrarSheet}
        title={editandoId ? "Editar cliente" : "Nuevo cliente"}
      >
        <div className="cli-form">
          {error && <div className="cli-mensaje-error">{error}</div>}

          <label>Tipo</label>
          <div className="cli-tipos">
            <button
              type="button"
              className={`cli-tipo-btn ${form.tipo === "natural" ? "activo" : ""}`}
              onClick={() => setForm((f) => ({ ...f, tipo: "natural" }))}
            >
              <User size={15} />
              Persona natural
            </button>
            <button
              type="button"
              className={`cli-tipo-btn ${form.tipo === "juridica" ? "activo" : ""}`}
              onClick={() => setForm((f) => ({ ...f, tipo: "juridica" }))}
            >
              <Building2 size={15} />
              Persona jurídica
            </button>
          </div>

          <label>{form.tipo === "juridica" ? "Razón social" : "Nombre completo"}</label>
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            placeholder={form.tipo === "juridica" ? "Ej: Arte Frío" : "Ej: Juan Pérez"}
          />

          <label>{form.tipo === "juridica" ? "NIT" : "Cédula"}</label>
          <input
            type="text"
            value={form.documento}
            onChange={(e) => setForm((f) => ({ ...f, documento: e.target.value }))}
            placeholder={form.tipo === "juridica" ? "Ej: 900123456-1" : "Ej: 123456789"}
          />

          {form.tipo === "juridica" && (
            <>
              <label>Persona de contacto</label>
              <input
                type="text"
                value={form.contacto}
                onChange={(e) => setForm((f) => ({ ...f, contacto: e.target.value }))}
                placeholder="Ej: María Gómez"
              />
            </>
          )}

          <label>Celular (opcional)</label>
          <input
            type="text"
            inputMode="numeric"
            value={form.celular}
            onChange={(e) => setForm((f) => ({ ...f, celular: e.target.value }))}
            placeholder="Ej: 3001234567"
          />

          <label>Dirección (opcional)</label>
          <input
            type="text"
            value={form.direccion}
            onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
            placeholder="Ej: Cll 10 #5-20"
          />

          <button className="cli-btn-primario cli-btn-guardar-sheet" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </Sheet>

      {/* ---------- Sheet: precios especiales ---------- */}

      <Sheet
        open={precioSheetAbierto}
        onOpenChange={cerrarPrecioSheet}
        title="Precios especiales"
      >
        <div className="cli-precios-panel">
          {errorPrecio && <div className="cli-mensaje-error">{errorPrecio}</div>}

          <div className="cli-precios-cliente-header">
            <span className="cli-icono cli-icono-grande">
              {clienteParaPrecios?.tipo === "juridica" ? (
                <Building2 size={20} />
              ) : (
                <User size={20} />
              )}
            </span>
            <div>
              <strong>{clienteParaPrecios?.nombre}</strong>
              <span className="cli-precios-cliente-sub">
                Estos precios solo aplican al vender a este cliente. El stock sigue siendo el mismo producto.
              </span>
            </div>
          </div>

          {/* ---------- Agregar nuevo ---------- */}

          <div className="cli-precios-seccion">
            <p className="cli-precios-seccion-titulo">Agregar precio especial</p>

            <div className="cli-precio-combo">
              <Search size={15} className="cli-precio-combo-icono" />
              <input
                type="text"
                placeholder="Buscar producto por nombre..."
                value={productoElegido ? productoElegido.nombre : busquedaProducto}
                onChange={(e) => {
                  setBusquedaProducto(e.target.value);
                  setProductoElegido(null);
                }}
                onFocus={() => setSugerenciasAbiertas(true)}
                onBlur={() => setTimeout(() => setSugerenciasAbiertas(false), 150)}
                autoComplete="off"
              />

              {productoElegido && (
                <button
                  type="button"
                  className="cli-precio-quitar-seleccion"
                  onClick={() => setProductoElegido(null)}
                  aria-label="Quitar selección"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {sugerenciasAbiertas && !productoElegido && (
              <div className="cli-precio-panel-busqueda">
                {categoriasDisponibles.length > 0 && (
                  <div className="cli-precio-categorias">
                    <button
                      type="button"
                      className={`cli-precio-chip ${categoriaFiltroPrecio === "" ? "activo" : ""}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setCategoriaFiltroPrecio("")}
                    >
                      Todas
                    </button>
                    {categoriasDisponibles.map((c) => (
                      <button
                        type="button"
                        key={c}
                        className={`cli-precio-chip ${categoriaFiltroPrecio === c ? "activo" : ""}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setCategoriaFiltroPrecio(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}

                <div className="cli-precio-sugerencias">
                  {productosSugeridos.length > 0 ? (
                    productosSugeridos.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        className="cli-precio-sugerencia"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setProductoElegido(p);
                          setSugerenciasAbiertas(false);
                        }}
                      >
                        <span className="cli-precio-sugerencia-nombre">{p.nombre}</span>
                        <span className="cli-precio-sugerencia-normal">
                          {formatearMoneda(p.precio_unitario)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="cli-precio-sin-resultados">
                      {busquedaProducto || categoriaFiltroPrecio
                        ? "Ningún producto coincide"
                        : "Todos los productos ya tienen precio especial"}
                    </p>
                  )}
                </div>
              </div>
            )}

            {productoElegido && (
              <div className="cli-precio-nuevo-card">
                <div className="cli-precio-nuevo-info">
                  <span className="cli-precio-nuevo-nombre">{productoElegido.nombre}</span>
                  <span className="cli-precio-nuevo-normal">
                    Precio normal: {formatearMoneda(productoElegido.precio_unitario)}
                  </span>
                </div>

                <label className="cli-precios-label-inline">Precio especial</label>
                <CampoMoneda value={precioNuevo} onChange={setPrecioNuevo} />

                {precioNuevo > 0 && (
                  <span className="cli-precio-preview-descuento">
                    {Math.round(
                      (1 - Number(precioNuevo) / Number(productoElegido.precio_unitario)) * 100
                    )}
                    % menos que el precio normal
                  </span>
                )}

                <button
                  type="button"
                  className="cli-btn-primario cli-precio-btn-agregar"
                  onClick={handleAgregarPrecio}
                  disabled={guardandoPrecio}
                >
                  {guardandoPrecio ? "Guardando..." : "Agregar precio especial"}
                </button>
              </div>
            )}
          </div>

          {/* ---------- Ya configurados ---------- */}

          <div className="cli-precios-seccion">
            <p className="cli-precios-seccion-titulo">
              Configurados
              {preciosEspeciales.length > 0 && (
                <span className="cli-precios-contador">{preciosEspeciales.length}</span>
              )}
            </p>

            {cargandoPrecios && (
              <div className="cli-precios-skeleton">
                <div className="cli-sk-fila" />
                <div className="cli-sk-fila" />
              </div>
            )}

            {!cargandoPrecios && preciosEspeciales.length === 0 && (
              <div className="cli-precios-vacio">
                <Tag size={22} />
                <p>Este cliente no tiene precios especiales todavía</p>
              </div>
            )}

            {!cargandoPrecios && preciosEspeciales.length > 0 && (
              <div className="cli-precios-lista">
                {preciosEspeciales.map((pe, index) => {
                  const descuento = Math.round((1 - pe.precio / pe.precio_normal) * 100);
                  return (
                    <div
                      key={pe.id}
                      className="cli-precio-fila"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <div className="cli-precio-fila-info">
                        <span className="cli-precio-producto">{pe.producto_nombre}</span>
                        <span className="cli-precio-normal-tachado">
                          {formatearMoneda(pe.precio_normal)}
                        </span>
                      </div>

                      <div className="cli-precio-fila-derecha">
                        <span className="cli-precio-valor">{formatearMoneda(pe.precio)}</span>
                        {descuento > 0 && (
                          <span className="cli-precio-badge-descuento">-{descuento}%</span>
                        )}
                      </div>

                      <button
                        type="button"
                        className="cli-precio-eliminar"
                        onClick={() => handleEliminarPrecio(pe.id)}
                        aria-label="Eliminar precio especial"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Sheet>
    </div>
  );
}