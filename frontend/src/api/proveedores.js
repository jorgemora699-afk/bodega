import apiClient from "./client";

export async function listarProveedoresDeProducto(productoId) {
  const response = await apiClient.get(`/productos/${productoId}/proveedores`);
  return response.data;
}

export async function listarProveedores() {
  const response = await apiClient.get("/proveedores");
  return response.data;
}

export async function crearProveedor(data) {
  const response = await apiClient.post("/proveedores", data);
  return response.data;
}

export async function actualizarProveedor(proveedorId, data) {
  const response = await apiClient.put(`/proveedores/${proveedorId}`, data);
  return response.data;
}

export async function eliminarProveedor(proveedorId) {
  const response = await apiClient.delete(`/proveedores/${proveedorId}`);
  return response.data;
}