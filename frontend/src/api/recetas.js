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

export async function listarRecetas() {
  const response = await apiClient.get("/recetas");
  return response.data;
}

export async function crearRecetaStandalone(nombre, ingredientes) {
  const response = await apiClient.post("/recetas/standalone", { nombre, ingredientes });
  return response.data;
}

export async function obtenerRecetaPorId(recetaId) {
  const response = await apiClient.get(`/recetas/${recetaId}`);
  return response.data;
}

export async function actualizarRecetaPorId(recetaId, nombre, ingredientes) {
  const response = await apiClient.put(`/recetas/${recetaId}`, { nombre, ingredientes });
  return response.data;
}

export async function eliminarRecetaPorId(recetaId) {
  const response = await apiClient.delete(`/recetas/${recetaId}`);
  return response.data;
}