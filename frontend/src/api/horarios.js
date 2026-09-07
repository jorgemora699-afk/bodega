import apiClient from "./client";

export async function listarHorarios(params = {}) {
  const response = await apiClient.get("/horarios", { params });
  return response.data;
}

export async function marcarEntrada(trabajadoraId) {
  const response = await apiClient.post("/horarios/entrada", {
    trabajadora_id: trabajadoraId,
  });
  return response.data;
}

export async function marcarSalida(trabajadoraId) {
  const response = await apiClient.post("/horarios/salida", {
    trabajadora_id: trabajadoraId,
  });
  return response.data;
}

export async function actualizarHorario(horarioId, data) {
  const response = await apiClient.put(`/horarios/${horarioId}`, data);
  return response.data;
}