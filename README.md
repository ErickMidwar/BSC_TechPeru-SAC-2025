# BSC TechPeru SAC — Sistema de Gestión Estratégica

Balanced Scorecard con backend Node.js/Express/SQLite y frontend SPA modular.

---

## Cómo ejecutar

### Requisitos
- **Node.js v22+** (`node:sqlite` built-in)
- Copiar variables de entorno:

```bash
cd backend
cp .env.example .env
# Edita JWT_SECRET con un valor largo y aleatorio
npm install
npm start
```

Abre **http://localhost:3000**

> La base de datos se crea y puebla automáticamente si está vacía.

```bash
npm test          # tests de cumplimiento KPI y RBAC
npm run reset-db  # recrear SQLite + seed
```

---

## Credenciales de demostración

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Administrador | `admin@techperu.com` | `admin123` |
| Gerente | `carlos.ruiz@techperu.com` | `BSC2026!` |
| Responsable | `maria.torres@techperu.com` | `BSC2026!` |

Los campos del login **no** vienen prellenados. El rol **Responsable** puede registrar mediciones (quedan pendientes de aprobación); Gerente/Admin aprueban.

---

## Estructura

```
├── index.html
├── css/styles.css
├── js/
│   ├── app.js              ← bootstrap SPA
│   ├── pages.js            ← renderers de páginas
│   ├── forms.js            ← formularios y acciones
│   └── lib/                ← api, auth, ui, format, constants
├── shared/compliance.js    ← motor de semáforo (front + back)
├── vendor/chart.umd.min.js ← Chart.js local + SRI
├── html/                   ← solo redirects a la SPA
└── backend/
    ├── server.js           ← Helmet, rate-limit, static seguro
    ├── .env.example
    ├── config/database.js  ← SQLite + FKs (schema v2)
    ├── controllers/
    ├── routes/
    ├── middleware/auth.js
    ├── utils/              ← ids (UUID), audit, validate (Zod)
    ├── services/           ← (extensible)
    ├── seed/seed.js
    └── tests/
```

---

## Seguridad

- `backend/.env` **no** se versiona; usa `.env.example`
- JWT sin secreto hardcodeado (falla al arrancar si falta `JWT_SECRET`)
- Helmet + rate-limit en login/API
- CORS acotado (`CORS_ORIGIN`)
- Estáticos limitados a `css/`, `js/`, `shared/`, `vendor/`, `html/` (no se sirve `backend/`)
- API relativa: el frontend llama a `/api` (sin `localhost` fijo)
- Token revalida usuario activo en cada request

---

## API (resumen)

| Método | Ruta | Notas |
|--------|------|-------|
| POST | `/api/auth/login` | rate-limited |
| GET | `/api/dashboard/summary?year=2026` | filtro por período |
| GET | `/api/dashboard/alertas` | notificaciones |
| GET | `/api/objetivos/relaciones/all` | causa-efecto |
| POST | `/api/mediciones` | Responsable+ |
| POST | `/api/mediciones/:id/approve` | Gerente/Admin |

Autenticación: `Authorization: Bearer <token>`

---

## Módulos

1. Dashboard con filtro de año y alertas  
2. Mapa estratégico + relaciones causa-efecto  
3. Objetivos / KPIs / Iniciativas / Trabajadores / Recursos  
4. Mediciones con workflow pendiente → aprobado/rechazado  
5. Reportes CSV  
6. Administración y auditoría  
