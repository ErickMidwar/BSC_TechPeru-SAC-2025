# BSC TechPeru SAC — Sistema de Gestión Estratégica

Prototipo interactivo de Balanced Scorecard con backend completo en Node.js/Express y base de datos SQLite.

---

## 🚀 Cómo ejecutar

### Requisitos
- **Node.js v22 o superior** (el proyecto usa `node:sqlite` incorporado en Node ≥ 22)
- No requiere Python, compiladores ni dependencias nativas

### Pasos

```bash
# 1. Instalar dependencias (desde la carpeta backend/)
cd backend
npm install

# 2. Iniciar el servidor
node server.js
```

Abre tu navegador en **http://localhost:3000**

> La base de datos se crea y puebla automáticamente al primer inicio.

---

## 🔐 Credenciales de demostración

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Administrador | `admin@techperu.com` | `admin123` |
| Gerente | `carlos.ruiz@techperu.com` | `BSC2026!` |
| Responsable | `maria.torres@techperu.com` | `BSC2026!` |

---

## 📁 Estructura del proyecto

```
BSC_Prototipo/
├── index.html              ← Punto de entrada frontend
├── css/styles.css          ← Estilos
├── js/app.js               ← Frontend SPA (consume la API REST)
├── html/                   ← Vistas HTML adicionales
└── backend/
    ├── server.js           ← Servidor Express (puerto 3000)
    ├── .env                ← Configuración (JWT_SECRET, PORT)
    ├── package.json
    ├── config/
    │   └── database.js     ← SQLite via node:sqlite (built-in)
    ├── controllers/        ← Lógica de negocio (MVC)
    │   ├── authController.js
    │   ├── usersController.js
    │   ├── trabajadoresController.js
    │   ├── recursosController.js
    │   ├── objetivosController.js
    │   ├── kpisController.js
    │   ├── medicionesController.js
    │   ├── iniciativasController.js
    │   └── dashboardController.js
    ├── routes/             ← Rutas Express
    ├── middleware/
    │   └── auth.js         ← Verificación JWT
    ├── seed/
    │   └── seed.js         ← Datos iniciales de demostración
    └── data/
        └── bsc.db          ← Base de datos SQLite (auto-generada)
```

---

## 🔌 API REST — Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login, retorna JWT |
| POST | `/api/auth/register` | Registrar usuario (admin) |
| GET | `/api/auth/me` | Perfil del usuario actual |
| GET/POST/PUT/DELETE | `/api/objetivos` | CRUD Objetivos estratégicos |
| GET/POST/PUT/DELETE | `/api/kpis` | CRUD KPIs con cálculo de cumplimiento |
| GET/POST/PUT/DELETE | `/api/mediciones` | Registro de resultados (auto-recalcula KPI) |
| GET/POST/PUT/DELETE | `/api/iniciativas` | CRUD Iniciativas estratégicas |
| GET/POST/PUT/DELETE | `/api/trabajadores` | CRUD Mantenimiento de personal |
| GET/POST/PUT/DELETE | `/api/recursos` | CRUD Recursos y presupuestos |
| POST | `/api/recursos/asignaciones` | Asignar recursos a iniciativas |
| GET | `/api/dashboard/summary` | Resumen ejecutivo BSC |
| GET | `/api/dashboard/audit` | Registro de auditoría |
| GET | `/api/health` | Estado del servidor |

Todos los endpoints (excepto `/api/auth/login`) requieren el header:
```
Authorization: Bearer <token>
```

---

## 📊 Módulos implementados

1. **Dashboard ejecutivo** — Cumplimiento global, tendencia, indicadores críticos
2. **Mapa estratégico** — 4 perspectivas con objetivos y estado visual
3. **Objetivos estratégicos** — CRUD con perspectiva, peso, responsable y trabajador asignado
4. **Indicadores (KPI)** — CRUD con lógica de semáforo (mayor/menor/rango), umbrales configurables
5. **Registro de resultados** — Mediciones con recálculo automático del KPI
6. **Iniciativas estratégicas** — Portafolio con avance, presupuesto ejecutado, trabajador y recursos asignados
7. **Trabajadores** *(nuevo)* — CRUD completo del personal (DNI, cargo, área, estado)
8. **Recursos** *(nuevo)* — Gestión de presupuestos, equipos y software
9. **Reportes** — Vista previa y exportación CSV
10. **Administración** — Usuarios del sistema, recursos y auditoría

---

## 🗄️ Datos iniciales (Seed)

- 5 usuarios del sistema
- **12 trabajadores** del equipo TechPeru
- 12 objetivos estratégicos (4 perspectivas)
- 16 KPIs con mediciones históricas (6 meses)
- 8 iniciativas estratégicas
- 8 recursos (presupuestos, software, equipos)
- 11 asignaciones recurso-iniciativa

---

## ⚙️ Variables de entorno (`.env`)

```env
PORT=3000
JWT_SECRET=bsc_techperu_jwt_super_secreto_2025
JWT_EXPIRES=8h
CORS_ORIGIN=*
```

---

## 📝 Notas técnicas

- Autenticación con **JWT** (8h de expiración) y contraseñas con **bcryptjs**
- Base de datos **SQLite** usando `node:sqlite` (built-in desde Node 22, sin dependencias nativas)
- Arquitectura **MVC**: controllers, routes, middleware
- **Semáforo automático**: Logrado ≥ 100%, En riesgo ≥ umbral de alerta, Crítico < umbral crítico
- KPIs **inversos** soportados (menor es mejor: costos, tiempos, errores)
- **Auditoría automática** de todas las operaciones CRUD
- El seed se ejecuta automáticamente si la DB está vacía al arrancar el servidor
