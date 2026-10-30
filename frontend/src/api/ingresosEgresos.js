import apiClient from "./client";

export async function listarIngresosEgresos(params = {}) {
  const response = await apiClient.get("/ingresos-egresos", { params });
  return response.data;
}

export async function crearIngresoEgreso(data) {
  const response = await apiClient.post("/ingresos-egresos", data);
  return response.data;
}

export async function actualizarIngresoEgreso(registroId, data) {
  const response = await apiClient.put(`/ingresos-egresos/${registroId}`, data);
  return response.data;
}

export async function eliminarIngresoEgreso(registroId) {
  const response = await apiClient.delete(`/ingresos-egresos/${registroId}`);
  return response.data;
}

export async function obtenerResumenMes(mes) {
  const response = await apiClient.get("/ingresos-egresos/resumen-mes", {
    params: { mes },
  });
  return response.data;
}