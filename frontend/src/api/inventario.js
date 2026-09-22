import apiClient from "./client";

export async function registrarEntrada(data) {
  const response = await apiClient.post("/inventario/entrada", data);
  return response.data;
}

export async function registrarSalida(data) {
  const response = await apiClient.post("/inventario/salida", data);
  return response.data;
}

export async function listarBajoStock() {
  const response = await apiClient.get("/inventario/bajo-stock");
  return response.data;
}

export async function listarMovimientos(params = {}) {
  const response = await apiClient.get("/inventario/movimientos", { params });
  return response.data;
}

export async function registrarSalida(data) {
  const response = await apiClient.post("/inventario/salida", data);
  return response.data;
}