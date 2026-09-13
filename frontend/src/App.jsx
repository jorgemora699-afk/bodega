import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import TrabajadoraLayout from "./layouts/trabajadora/TrabajadoraLayout";
import AdminLayout from "./layouts/admin/AdminLayout";

import Login from "./pages/login/Login";
import RegistrarVenta from "./pages/trabajadoras/venta/RegistrarVenta";
import Inventariotrabajadora from "./pages/trabajadoras/inventario/Inventario";
import Horario from "./pages/trabajadoras/horario/Horario";
import RecetasTrabajadora from "./pages/trabajadoras/recetas/Recetas";

import Dashboard from "./pages/admin/dashboard/Dashboard";
import Ventas from "./pages/admin/ventas/Ventas";
import Reportes from "./pages/admin/reportes/Reportes";
import Salarios from "./pages/admin/salarios/Salarios";
import Inventario from "./pages/admin/inventario/Inventario";
import IngresosEgresos from "./pages/admin/ingresosegresos/IngresosEgresos";
import Proveedores from "./pages/admin/proveedores/Proveedores";
import Productos from "./pages/admin/productos/Productos";
import Trabajadoras from "./pages/admin/trabajadoras/Trabajadoras";
import RecetasAdmin from "./pages/admin/recetas/Recetas";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<TrabajadoraLayout />}>
            <Route path="/venta" element={<RegistrarVenta />} />
            <Route path="/inventario" element={<Inventariotrabajadora />} />
            <Route path="/horario" element={<Horario />} />
            <Route path="/recetas" element={<RecetasTrabajadora />} />
          </Route>

          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/ventas" element={<Ventas />} />
            <Route path="/admin/reportes" element={<Reportes />} />
            <Route path="/admin/salarios" element={<Salarios />} />
            <Route path="/admin/ingresos-egresos" element={<IngresosEgresos />} />
            <Route path="/admin/proveedores" element={<Proveedores />} />
            <Route path="/admin/productos" element={<Productos />} />
            <Route path="/admin/inventario" element={<Inventario/>}/>
            <Route path="/admin/trabajadoras" element={<Trabajadoras />} />
            <Route path="/admin/recetas" element={<RecetasAdmin />} />
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}