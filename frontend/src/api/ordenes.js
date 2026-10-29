import apiClient from "./client";

export async function crearOrden(data) {
  const response = await apiClient.post("/ordenes", data);
  return response.data;
}

export async function listarOrdenes() {
  const response = await apiClient.get("/ordenes");
  return response.data;
}

export async function listarOrdenesPendientes() {
  const response = await apiClient.get("/ordenes/pendientes");
  return response.data;
}

export async function actualizarOrden(ordenId, data) {
  const response = await apiClient.put(`/ordenes/${ordenId}`, data);
  return response.data;
}

/* Sin metodoCobro, la cuenta queda pagada con metodo_cobro "credito" y NO
   suma al efectivo esperado de la caja. Si se envía "efectivo", el cobro
   entra a la caja del turno abierto (hoy ninguna pantalla lo usa). */
export async function marcarOrdenPagada(ordenId, metodoCobro) {
  const response = await apiClient.put(
    `/ordenes/${ordenId}/marcar-pagada`,
    metodoCobro ? { metodo_cobro: metodoCobro } : {}
  );
  return response.data;
}

export async function anularOrden(ordenId) {
  const response = await apiClient.delete(`/ordenes/${ordenId}`);
  return response.data;
}