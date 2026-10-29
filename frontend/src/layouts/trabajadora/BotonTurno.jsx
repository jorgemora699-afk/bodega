import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { obtenerCajaActual } from "../../api/caja";
import "./BotonTurno.css";

const REFRESCO_MS = 5000;

function formatearHora(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BotonTurno() {
  const location = useLocation();

  const [cargado, setCargado] = useState(false);
  const [turno, setTurno] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const data = await obtenerCajaActual();
      setTurno(data.turno);
      setCargado(true);
    } catch (err) {
      // Se conserva el último estado conocido para no parpadear
    }
  }, []);

  /* Al cambiar de pantalla */
  useEffect(() => {
    cargar();
  }, [cargar, location.pathname]);

  /* Refresco periódico y aviso inmediato al abrir/cerrar caja */
  useEffect(() => {
    const intervalo = setInterval(cargar, REFRESCO_MS);
    window.addEventListener("caja-cambio", cargar);

    return () => {
      clearInterval(intervalo);
      window.removeEventListener("caja-cambio", cargar);
    };
  }, [cargar]);

  if (!cargado) {
    return <span className="turno-link-skeleton" aria-hidden="true" />;
  }

  const enCaja = location.pathname === "/caja";

  if (turno) {
    return (
      <Link
        to="/caja"
        className={`turno-link abierto ${enCaja ? "en-caja" : ""}`}
        title="Ver la caja o cerrar el turno"
        aria-label={`Turno abierto desde las ${formatearHora(turno.abierto_en)}. Ver la caja`}
      >
        <span className="turno-link-punto" />
        <span className="turno-link-titulo">Turno abierto</span>
        <span className="turno-link-hora">· desde las {formatearHora(turno.abierto_en)}</span>
      </Link>
    );
  }

  return (
    <Link
      to="/caja"
      className={`turno-link cerrado ${enCaja ? "en-caja" : ""}`}
      title="Abrir la caja para empezar"
      aria-label="Abrir turno"
    >
      <span className="turno-link-punto" />
      <span className="turno-link-titulo">Abrir turno</span>
      <span className="turno-link-hora">· caja cerrada</span>
    </Link>
  );
}