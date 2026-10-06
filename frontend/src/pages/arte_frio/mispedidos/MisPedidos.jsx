import { useEffect, useState } from "react";
import { Clock3, Check, X, RefreshCw } from "lucide-react";
import { obtenerMiCliente } from "../../../api/clientes";
import { listarSolicitudes } from "../../../api/solicitudesPedido";
import "./MisPedidos.css";

function formatearFecha(isoString) {
  return new Date(isoString).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function etiquetaEstado(estado) {
  if (estado === "pendiente") return { texto: "Pendiente", clase: "pendiente", Icon: Clock3 };
  if (estado === "atendida") return { texto: "Atendido", clase: "atendida", Icon: Check };
  return { texto: "Rechazado", clase: "rechazada", Icon: X };
}

export default function MisPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    setError(null);

    try {
      const miCliente = await obtenerMiCliente();
      const todas = await listarSolicitudes();
      setPedidos(todas.filter((s) => s.cliente_id === miCliente.id));
    } catch (err) {
      setError("No se pudo cargar tu historial de pedidos");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="mp-container">
      <header className="mp-header">
        <h1>Mis pedidos</h1>
        <p>Historial de lo que has pedido a Punto Amarillo</p>
      </header>

      {error && (
        <div className="mp-mensaje-error">
          <span>{error}</span>
          <button onClick={cargar}>
            <RefreshCw size={13} />
            Reintentar
          </button>
        </div>
      )}

      {cargando ? (
        <p className="mp-cargando">Cargando...</p>
      ) : (
        <div className="mp-lista">
          {pedidos.map((pedido) => {
            const estado = etiquetaEstado(pedido.estado);

            return (
              <div key={pedido.id} className="mp-tarjeta">
                <div className="mp-fila-principal">
                  <span className={`mp-badge ${estado.clase}`}>
                    <estado.Icon size={11} />
                    {estado.texto}
                  </span>
                  <span className="mp-fecha">{formatearFecha(pedido.fecha)}</span>
                </div>

                <div className="mp-items">
                  {pedido.items.map((item) => (
                    <span key={item.id}>
                      {item.cantidad} × {item.producto_nombre}
                    </span>
                  ))}
                </div>

                {pedido.nota && <p className="mp-nota">"{pedido.nota}"</p>}

                {pedido.estado === "rechazada" && pedido.motivo_rechazo && (
                  <p className="mp-motivo-rechazo">
                    Motivo: {pedido.motivo_rechazo}
                  </p>
                )}
              </div>
            );
          })}

          {pedidos.length === 0 && !error && (
            <p className="mp-sin-pedidos">Todavía no has hecho ningún pedido</p>
          )}
        </div>
      )}
    </div>
  );
}