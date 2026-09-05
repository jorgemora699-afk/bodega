import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, rolPermitido }) {
  const { usuario } = useAuth();

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (rolPermitido && usuario.rol !== rolPermitido) {
    return <Navigate to={usuario.rol === "jefe" ? "/admin" : "/venta"} replace />;
  }

  return children;
}