# Punto Amarillo 🟡

Plataforma web de ventas, inventario y analítica para un negocio de alimentos. Registra cada venta, descuenta el stock automáticamente y le da al administrador reportes de ingresos, productos más vendidos y costos de personal.

Proyecto desarrollado para un cliente real


## Problema

El negocio llevaba ventas, producción, horarios y gastos de forma manual, lo que dificultaba saber cuánto se vendía, qué producto rotaba más, cuándo reponer con el proveedor y cuánto pagar a cada empleada.

## Funcionalidades

**Trabajadoras** (usuario compartido)
- Registro de ventas con producto, cantidad, método de pago y quién vendió, con confirmación y opción de editar o anular.
- Calculadora de efectivo con cambio y carrito persistente.
- Registro de producción en el inventario y alerta de stock bajo.
- Consulta de proveedores por producto cuando algo se agota.
- Marcación de entrada y salida con historial reciente.
- Consulta de recetas (solo lectura).

**Administrador**
- Dashboard con ingresos diarios, semanales y mensuales, productos más vendidos y unidades vendidas por día.
- Reportes con gráficas interactivas (Recharts).
- Registro de ingresos y egresos con filtro por periodo y fecha editable; las compras pueden registrar la entrada al inventario en el mismo formulario.
- Cálculo automático de salarios por horas trabajadas.
- Gestión de productos, proveedores, recetas y trabajadoras.
- Ventas a crédito (cuentas por cobrar) asociadas a clientes: no suman en los reportes hasta marcarse como pagadas.
- Cierre de sesión en todos los dispositivos del usuario compartido.

## Modelo de datos

- Relación **muchos a muchos** entre proveedores y productos.
- **Paquetes:** al vender un paquete (x12), el stock se descuenta del producto base, y se revierte igual al editar o anular la venta.
- Control de inventario de productos e insumos, con movimientos de entrada vinculados a los egresos.
- Roles `trabajadora` y `jefe` con autenticación JWT y rutas protegidas por rol.
- Migraciones versionadas con Flask-Migrate.


## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React, Vite, Recharts |
| Backend | Flask, SQLAlchemy, Flask-Migrate |
| Base de datos | PostgreSQL |
| Autenticación | JWT con roles |
| Despliegue | Railway |

## Estructura del proyecto

punto-amarillo/
├── backend/        # API REST en Flask
│   ├── app/
│   │   ├── models/
│   │   ├── services/
│   │   └── routes/
│   └── migrations/
├── frontend/       # Aplicación React + Vite
│   └── src/
│       ├── pages/
│       └── components/
└── docs/           # Capturas y diagrama ER


## Instalación local

**Requisitos:** Python 3.10+, Node 18+ y PostgreSQL.

### Backend
bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
flask db upgrade
flask run

### Frontend
bash
cd frontend
npm install
cp .env.example .env
npm run dev


## Autor

**Jorge Alejandro Mora**
