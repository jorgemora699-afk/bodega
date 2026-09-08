import apiClient from "./client";

export async function crearOrden(data) {
  const response = await apiClient.post("/ordenes", data);
  return response.data;
}

export async function listarOrdenes() {
  const response = await apiClient.get("/ordenes");
  return response.data;
}

export async function anularOrden(ordenId) {
  const response = await apiClient.delete(`/ordenes/${ordenId}`);
  return response.data;
}