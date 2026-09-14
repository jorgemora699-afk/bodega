import apiClient from "./client";

export async function listarInsumos() {
  const response = await apiClient.get("/insumos");
  return response.data;
}

export async function crearInsumo(data) {
  const response = await apiClient.post("/insumos", data);
  return response.data;
}

export async function actualizarInsumo(insumoId, data) {
  const response = await apiClient.put(`/insumos/${insumoId}`, data);
  return response.data;
}

export async function eliminarInsumo(insumoId) {
  const response = await apiClient.delete(`/insumos/${insumoId}`);
  return response.data;
}

export async function listarMovimientosInsumo(params = {}) {
  const response = await apiClient.get("/insumos/movimientos", { params });
  return response.data;
}

export async function registrarEntradaInsumo(data) {
  const response = await apiClient.post("/insumos/entrada", data);
  return response.data;
}

export async function registrarSalidaInsumo(data) {
  const response = await apiClient.post("/insumos/salida", data);
  return response.data;
}

export async function listarBajoStockInsumo() {
  const response = await apiClient.get("/insumos/bajo-stock");
  return response.data;
}

export async function listarProveedoresDeInsumo(insumoId) {
  const response = await apiClient.get(`/insumos/${insumoId}/proveedores`);
  return response.data;
}