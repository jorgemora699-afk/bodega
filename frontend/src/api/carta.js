import apiClient from "./client";

const SUBIDA = { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 };

function formConImagen(archivo) {
  const fd = new FormData();
  fd.append("imagen", archivo);
  return fd;
}

export async function obtenerCartaPublica() {
  const { data } = await apiClient.get("/carta");
  return data;
}

export async function obtenerCartaAdmin() {
  const { data } = await apiClient.get("/carta-admin");
  return data;
}

export async function actualizarConfigCarta(payload) {
  const { data } = await apiClient.put("/carta-admin/config", payload);
  return data;
}

export async function subirImagenConfig(tipo, archivo) {
  const { data } = await apiClient.post(
    `/carta-admin/config/imagen/${tipo}`,
    formConImagen(archivo),
    SUBIDA
  );
  return data;
}

export async function quitarImagenConfig(tipo) {
  const { data } = await apiClient.delete(`/carta-admin/config/imagen/${tipo}`);
  return data;
}

export async function actualizarProductoCarta(id, payload) {
  const { data } = await apiClient.put(`/carta-admin/productos/${id}`, payload);
  return data;
}

export async function ordenarProductosCarta(ids) {
  const { data } = await apiClient.put("/carta-admin/productos/orden", { ids });
  return data;
}

export async function subirImagenProducto(id, archivo) {
  const { data } = await apiClient.post(
    `/carta-admin/productos/${id}/imagen`,
    formConImagen(archivo),
    SUBIDA
  );
  return data;
}

export async function quitarImagenProducto(id) {
  const { data } = await apiClient.delete(`/carta-admin/productos/${id}/imagen`);
  return data;
}

/* Categorías: estas tres devuelven la vista completa del admin */

export async function renombrarCategoriaCarta(actual, nuevo) {
  const { data } = await apiClient.put("/carta-admin/categorias/renombrar", { actual, nuevo });
  return data;
}

export async function subirImagenCategoria(nombre, archivo) {
  const fd = formConImagen(archivo);
  fd.append("nombre", nombre);
  const { data } = await apiClient.post("/carta-admin/categorias/imagen", fd, SUBIDA);
  return data;
}

export async function quitarImagenCategoria(nombre) {
  const { data } = await apiClient.delete("/carta-admin/categorias/imagen", {
    params: { nombre },
  });
  return data;
}