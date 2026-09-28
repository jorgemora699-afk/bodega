import apiClient from "./client";

export async function listarClientes(params = {}) {
  const response = await apiClient.get("/clientes", { params });
  return response.data;
}

export async function obtenerCliente(clienteId) {
  const response = await apiClient.get(`/clientes/${clienteId}`);
  return response.data;
}

export async function crearCliente(data) {
  const response = await apiClient.post("/clientes", data);
  return response.data;
}

export async function actualizarCliente(clienteId, data) {
  const response = await apiClient.put(`/clientes/${clienteId}`, data);
  return response.data;
}

export async function eliminarCliente(clienteId) {
  const response = await apiClient.delete(`/clientes/${clienteId}`);
  return response.data;
}

export async function listarPreciosEspeciales(clienteId) {
  const response = await apiClient.get(`/clientes/${clienteId}/precios-especiales`);
  return response.data;
}

export async function crearPrecioEspecial(clienteId, data) {
  const response = await apiClient.post(`/clientes/${clienteId}/precios-especiales`, data);
  return response.data;
}

export async function eliminarPrecioEspecial(precioEspecialId) {
  const response = await apiClient.delete(`/clientes/precios-especiales/${precioEspecialId}`);
  return response.data;
}