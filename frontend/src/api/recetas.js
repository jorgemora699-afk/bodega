import apiClient from "./client";

export async function obtenerReceta(productoId) {
  try {
    const response = await apiClient.get(`/recetas/producto/${productoId}`);
    return response.data;
  } catch (err) {
    if (err.response?.status === 404) {
      return null; // este producto todavía no tiene receta
    }
    throw err;
  }
}

export async function guardarReceta(productoId, ingredientes) {
  const response = await apiClient.post(`/recetas/producto/${productoId}`, { ingredientes });
  return response.data;
}

export async function eliminarReceta(productoId) {
  const response = await apiClient.delete(`/recetas/producto/${productoId}`);
  return response.data;
}