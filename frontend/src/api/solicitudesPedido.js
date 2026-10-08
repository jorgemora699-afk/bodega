import apiClient from "./client";

export async function crearSolicitud(data) {
  const response = await apiClient.post("/solicitudes-pedido", data);
  return response.data;
}

export async function listarSolicitudes() {
  const response = await apiClient.get("/solicitudes-pedido");
  return response.data;
}

export async function listarSolicitudesPendientes() {
  const response = await apiClient.get("/solicitudes-pedido/pendientes");
  return response.data;
}

export async function contarSolicitudesPendientes() {
  const response = await apiClient.get("/solicitudes-pedido/pendientes/conteo");
  return response.data;
}

export async function obtenerSolicitud(solicitudId) {
  const response = await apiClient.get(`/solicitudes-pedido/${solicitudId}`);
  return response.data;
}

export async function atenderSolicitud(solicitudId, ordenId) {
  const response = await apiClient.put(`/solicitudes-pedido/${solicitudId}/atender`, {
    orden_id: ordenId,
  });
  return response.data;
}

export async function rechazarSolicitud(solicitudId, motivo) {
  const response = await apiClient.put(`/solicitudes-pedido/${solicitudId}/rechazar`, {
    motivo,
  });
  return response.data;
}

export async function listarMisSolicitudes(incluirOcultas = false) {
  const response = await apiClient.get("/solicitudes-pedido/mis-solicitudes", {
    params: incluirOcultas ? { incluir_ocultas: 1 } : {},
  });
  return response.data;
}

export async function ocultarSolicitud(solicitudId) {
  const response = await apiClient.put(`/solicitudes-pedido/${solicitudId}/ocultar`);
  return response.data;
}

export async function mostrarSolicitud(solicitudId) {
  const response = await apiClient.put(`/solicitudes-pedido/${solicitudId}/mostrar`);
  return response.data;
}