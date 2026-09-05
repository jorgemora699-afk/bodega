import { useEffect, useState } from "react";
import { listarTrabajadoras } from "../../../api/trabajadoras";
import { calcularSalario } from "../../../api/admin";
import "./Salarios.css";

function primerDiaDelMes() {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatearMoneda(valor) {
  return `$${Number(valor).toLocaleString("es-CO")}`;
}

export default function Salarios() {
  const [trabajadoras, setTrabajadoras] = useState([]);
  const [trabajadoraId, setTrabajadoraId] = useState("");
  const [desde, setDesde] = useState(primerDiaDelMes());
  const [hasta, setHasta] = useState(hoyISO());

  const [resultado, setResultado] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    listarTrabajadoras()
      .then(setTrabajadoras)
      .catch(() => setError("No se pudieron cargar las trabajadoras"));
  }, []);

  async function handleCalcular() {
    if (!trabajadoraId) {
      setError("Selecciona una trabajadora");
      return;
    }
    if (!desde || !hasta) {
      setError("Selecciona el rango de fechas");
      return;
    }

    setCalculando(true);
    setError(null);
    setResultado(null);

    try {
      const data = await calcularSalario(Number(trabajadoraId), desde, hasta);
      setResultado(data);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo calcular el salario");
    } finally {
      setCalculando(false);
    }
  }

  return (
    <div className="sal-container">
      <h1>Salarios</h1>

      <div className="sal-form">
        <label>Trabajadora</label>
        <select value={trabajadoraId} onChange={(e) => setTrabajadoraId(e.target.value)}>
          <option value="">Selecciona...</option>
          {trabajadoras.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>

        <div className="sal-fechas">
          <div>
            <label>Desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <label>Hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>

        <button className="sal-btn-calcular" onClick={handleCalcular} disabled={calculando}>
          {calculando ? "Calculando..." : "Calcular"}
        </button>
      </div>

      {error && <div className="sal-mensaje-error">{error}</div>}

      {resultado && (
        <div className="sal-resultado">
          <h2>{resultado.trabajadora_nombre}</h2>
          <p className="sal-rango">
            {resultado.desde} — {resultado.hasta}
          </p>

          <div className="sal-fila">
            <span>Horas trabajadas</span>
            <span className="sal-valor">{resultado.total_horas} h</span>
          </div>

          <div className="sal-fila">
            <span>Valor por hora</span>
            <span className="sal-valor">
              {resultado.valor_hora != null ? formatearMoneda(resultado.valor_hora) : "No configurado"}
            </span>
          </div>

          <div className="sal-fila sal-fila-total">
            <span>Salario a pagar</span>
            <span className="sal-valor sal-valor-total">
              {resultado.salario_calculado != null
                ? formatearMoneda(resultado.salario_calculado)
                : "—"}
            </span>
          </div>

          {resultado.nota && <p className="sal-nota">{resultado.nota}</p>}
        </div>
      )}
    </div>
  );
}