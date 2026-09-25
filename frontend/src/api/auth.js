import apiClient from "./client";

export async function cambiarCredenciales(data) {
  const response = await apiClient.put("/auth/credenciales", data);
  return response.data;
}

export async function resetearPasswordTrabajadora(data) {
  const response = await apiClient.put("/auth/trabajadora/password", data);
  return response.data;
}