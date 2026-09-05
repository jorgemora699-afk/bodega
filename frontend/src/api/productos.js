import apiClient from "./client";

export async function listarProductos() {
  const response = await apiClient.get("/productos");
  return response.data;
}

export async function crearProducto(data) {
  const response = await apiClient.post("/productos", data);
  return response.data;
}

export async function actualizarProducto(productoId, data) {
  const response = await apiClient.put(`/productos/${productoId}`, data);
  return response.data;
}

export async function eliminarProducto(productoId) {
  const response = await apiClient.delete(`/productos/${productoId}`);
  return response.data;
}