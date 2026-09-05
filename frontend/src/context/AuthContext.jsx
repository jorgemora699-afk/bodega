import { createContext, useContext, useState } from "react";
import apiClient from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    const rol = localStorage.getItem("rol");
    const username = localStorage.getItem("username");
    return rol && username ? { rol, username } : null;
  });

  async function login(username, password) {
    const response = await apiClient.post("/auth/login", { username, password });
    const { access_token, rol, username: nombreUsuario } = response.data;

    localStorage.setItem("access_token", access_token);
    localStorage.setItem("rol", rol);
    localStorage.setItem("username", nombreUsuario);

    setUsuario({ rol, username: nombreUsuario });
    return rol;
  }

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("rol");
    localStorage.removeItem("username");
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return context;
}