import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Adjunta el token guardado a cada petición, si existe
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Si el backend responde 401 (token vencido o inválido), cierra sesión automáticamente.
// Excepción: un 401 en el propio login no debe disparar este comportamiento,
// porque es simplemente "usuario o contraseña incorrectos", no una sesión vencida.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const esPeticionDeLogin = error.config?.url?.includes("/auth/login");

    if (error.response?.status === 401 && !esPeticionDeLogin) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("rol");
      localStorage.removeItem("username");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default apiClient;