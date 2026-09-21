import apiClient from "./client";

export async function cambiarCredenciales(data) {
  const response = await apiClient.put("/auth/credenciales", data);
  return response.data;
}