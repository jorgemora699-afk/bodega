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

// api/trabajadoras.js — agregar
export async function establecerCodigoTrabajadora(id, codigo) {
  const { data } = await api.put(`/trabajadoras/${id}/codigo`, { codigo });
  return data;
}

export async function eliminarCodigoTrabajadora(id) {
  const { data } = await api.delete(`/trabajadoras/${id}/codigo`);
  return data;
}

export async function verificarCodigoTrabajadora(id, codigo) {
  const { data } = await api.post(`/trabajadoras/${id}/verificar-codigo`, { codigo });
  return data;
}