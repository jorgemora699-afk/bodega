import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import TrabajadoraLayout from "./layouts/trabajadora/TrabajadoraLayout";
import AdminLayout from "./layouts/admin/AdminLayout";
import ArteFrioLayout from "./layouts/arte_frio/ArteFrioLayout";

import Login from "./pages/login/Login";
import RegistrarVenta from "./pages/trabajadoras/venta/RegistrarVenta";
import Inventariotrabajadora from "./pages/trabajadoras/inventario/Inventario";
import Horario from "./pages/trabajadoras/horario/Horario";
import RecetasTrabajadora from "./pages/trabajadoras/recetas/Recetas";
import SolicitudesPedido from "./pages/trabajadoras/solicitudes/SolicitudesPedido";
import Caja from "./pages/trabajadoras/caja/Caja";

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
import Insumos from "./pages/admin/insumos/Insumos";
import InsumosTrabajadora from "./pages/trabajadoras/insumos/Insumos";
import MiCuenta from "./pages/admin/cuenta/MiCuenta";
import VentasTrabajadora from "./pages/trabajadoras/venta/Ventas";
import CuentasPorCobrar from "./pages/admin/cuentascobrar/CuentasPorCobrar";
import Notas from "./pages/trabajadoras/notas/Notas";
import HistorialCaja from "./pages/admin/caja/HistorialCaja";
import Clientes from "./pages/admin/clientes/Clientes";

import PedidoArteFrio from "./pages/arte_frio/pedido/PedidoArteFrio";
import MisPedidos from "./pages/arte_frio/mispedidos/MisPedidos";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<TrabajadoraLayout />}>
            <Route path="/venta" element={<RegistrarVenta />} />
            <Route path="/caja" element={<Caja />} />
            <Route path="/ventas-hoy" element={<VentasTrabajadora />} />
            <Route path="/inventario" element={<Inventariotrabajadora />} />
            <Route path="/insumos" element={<InsumosTrabajadora />} />
            <Route path="/horario" element={<Horario />} />
            <Route path="/recetas" element={<RecetasTrabajadora />} />
            <Route path="/solicitudes-pedido" element={<SolicitudesPedido />} />
            <Route path="/notas" element={<Notas />} />
          </Route>

          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/notas" element={<Notas />} />
            <Route path="/admin/ventas" element={<Ventas />} />
            <Route path="/admin/ventas/registrar" element={<RegistrarVenta />} />
            <Route path="/admin/caja" element={<HistorialCaja />} />
            <Route path="/admin/reportes" element={<Reportes />} />
            <Route path="/admin/clientes" element={<Clientes />} />
            <Route path="/admin/cuentas-cobrar" element={<CuentasPorCobrar />} />
            <Route path="/admin/solicitudes-pedido" element={<SolicitudesPedido />} />
            <Route path="/admin/salarios" element={<Salarios />} />
            <Route path="/admin/ingresos-egresos" element={<IngresosEgresos />} />
            <Route path="/admin/proveedores" element={<Proveedores />} />
            <Route path="/admin/productos" element={<Productos />} />
            <Route path="/admin/inventario" element={<Inventario/>}/>
            <Route path="/admin/trabajadoras" element={<Trabajadoras />} />
            <Route path="/admin/insumos" element={<Insumos />} />
            <Route path="/admin/recetas" element={<RecetasAdmin />} />
            <Route path="/admin/mi-cuenta" element={<MiCuenta />} />
          </Route>

          <Route element={<ArteFrioLayout />}>
            <Route path="/pedido" element={<PedidoArteFrio />} />
            <Route path="/pedido/mis-pedidos" element={<MisPedidos />} />
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}