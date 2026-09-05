import apiClient from "./client";

export async function crearVenta(data) {
  const response = await apiClient.post("/ventas", data);
  return response.data;
}

export async function listarVentas() {
  const response = await apiClient.get("/ventas");
  return response.data;
}

export async function actualizarVenta(ventaId, data) {
  const response = await apiClient.put(`/ventas/${ventaId}`, data);
  return response.data;
}

export async function eliminarVenta(ventaId) {
  const response = await apiClient.delete(`/ventas/${ventaId}`);
  return response.data;
}