import apiClient from "./Client";

/* Avisa al botón de turno del layout para que se actualice al instante */
function avisarCambioCaja() {
  window.dispatchEvent(new Event("caja-cambio"));
}

export async function obtenerCajaActual() {
  const { data } = await apiClient.get("/caja/actual");
  return data;
}

export async function abrirCaja(payload) {
  const { data } = await apiClient.post("/caja/abrir", payload);
  avisarCambioCaja();
  return data;
}

export async function cerrarCaja(payload) {
  const { data } = await apiClient.post("/caja/cerrar", payload);
  avisarCambioCaja();
  return data;
}

export async function crearMovimientoCaja(payload) {
  const { data } = await apiClient.post("/caja/movimientos", payload);
  return data;
}

export async function eliminarMovimientoCaja(id) {
  const { data } = await apiClient.delete(`/caja/movimientos/${id}`);
  return data;
}

export async function listarTurnosCaja(params = {}) {
  const { data } = await apiClient.get("/caja/turnos", { params });
  return data;
}

export async function obtenerTurnoCaja(id) {
  const { data } = await apiClient.get(`/caja/turnos/${id}`);
  return data;
}