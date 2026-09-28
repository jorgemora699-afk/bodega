import apiClient from "./client";

export async function listarNotas() {
  const response = await apiClient.get("/notas");
  return response.data;
}

export async function crearNota(data) {
  const response = await apiClient.post("/notas", data);
  return response.data;
}

export async function resolverNota(notaId, trabajadoraId = null) {
  const response = await apiClient.put(`/notas/${notaId}/resolver`, {
    trabajadora_id: trabajadoraId,
  });
  return response.data;
}

export async function eliminarNota(notaId) {
  const response = await apiClient.delete(`/notas/${notaId}`);
  return response.data;
}