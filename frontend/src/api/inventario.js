import apiClient from "./client";

export async function registrarEntrada(data) {
  const response = await apiClient.post("/inventario/entrada", data);
  return response.data;
}

export async function listarBajoStock() {
  const response = await apiClient.get("/inventario/bajo-stock");
  return response.data;
}