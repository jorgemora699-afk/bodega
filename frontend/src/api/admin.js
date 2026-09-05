import apiClient from "./client";

export async function resumenVentas(periodo = "dia") {
  const response = await apiClient.get("/admin/resumen-ventas", { params: { periodo } });
  return response.data;
}

export async function productosMasVendidos(periodo = "dia", limite = 10) {
  const response = await apiClient.get("/admin/productos-mas-vendidos", {
    params: { periodo, limite },
  });
  return response.data;
}

export async function ventasPorTrabajadora(periodo) {
  const response = await apiClient.get("/admin/ventas-por-trabajadora", { params: { periodo } });
  return response.data;
}

export async function ventasPorDia(periodo) {
  const response = await apiClient.get("/admin/ventas-por-dia", { params: { periodo } });
  return response.data;
}

export async function tendenciaMensual(meses = 6) {
  const response = await apiClient.get("/admin/tendencia-mensual", { params: { meses } });
  return response.data;
}

export async function calcularSalarios(desde, hasta) {
  const response = await apiClient.get("/admin/salarios", { params: { desde, hasta } });
  return response.data;
}

export async function obtenerBalance(periodo = "mes") {
  const response = await apiClient.get("/admin/balance", { params: { periodo } });
  return response.data;
}

export async function calcularSalario(trabajadoraId, desde, hasta) {
  const response = await apiClient.get("/admin/salario", {
    params: { trabajadora_id: trabajadoraId, desde, hasta },
  });
  return response.data;
}