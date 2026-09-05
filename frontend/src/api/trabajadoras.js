import apiClient from "./client";

export async function listarTrabajadoras() {
  const response = await apiClient.get("/trabajadoras");
  return response.data;
}

export async function crearTrabajadora(data) {
  const response = await apiClient.post("/trabajadoras", data);
  return response.data;
}

export async function actualizarTrabajadora(trabajadoraId, data) {
  const response = await apiClient.put(`/trabajadoras/${trabajadoraId}`, data);
  return response.data;
}

export async function eliminarTrabajadora(trabajadoraId) {
  const response = await apiClient.delete(`/trabajadoras/${trabajadoraId}`);
  return response.data;
}