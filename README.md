# PentiumPOS

Sistema POS (Punto de Venta) modular para restaurantes y negocios gastronómicos.

## Stack Tecnológico

| Capa          | Tecnología                                 |
| ------------- | ------------------------------------------ |
| **Frontend**  | React 19 + TypeScript + Vite + TailwindCSS |
| **Backend**   | Express 5 + TypeScript + Prisma ORM        |
| **Database**  | MySQL 8                                    |
| **Real-time** | Socket.IO                                  |
| **Auth**      | JWT + bcrypt                               |

## Requisitos Previos

- **Node.js** v20 o superior
- **MySQL** 8.0 o superior
- **npm** v10 o superior

## Instalación Rápida

### 1. Clonar el repositorio

```bash
git clone <repo-url>
cd control_gastronomicoV2
```

### 2. Configurar Backend

```bash
cd backend

# Instalar dependencias
npm install

# Copiar archivo de configuración
cp .env.example .env

# Editar .env con tus valores (ver sección Variables de Entorno)
# IMPORTANTE: Cambiar JWT_SECRET por un valor seguro

# Crear base de datos y ejecutar migraciones
npx prisma migrate deploy

# (Opcional) Cargar datos de ejemplo
npx prisma db seed

# Iniciar servidor de desarrollo
npm run dev
```

### 3. Configurar Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Copiar archivo de configuración
cp .env.example .env

# Iniciar servidor de desarrollo
npm run dev
```

### 4. Acceder al sistema

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001
- **Health Check:** http://localhost:3001/health

**Credenciales por defecto (con seed):**

- PIN Admin: `999999`

## Variables de Entorno

### Backend (.env)

| Variable       | Requerida | Descripción                         | Ejemplo                                       |
| -------------- | --------- | ----------------------------------- | --------------------------------------------- |
| `DATABASE_URL` | ✅        | URL de conexión MySQL               | `mysql://root:pass@localhost:3306/pentiumpos` |
| `JWT_SECRET`   | ✅        | Secreto para tokens (mín 32 chars)  | Ver generación abajo                          |
| `PORT`         | ❌        | Puerto del servidor (default: 3001) | `3001`                                        |
| `CORS_ORIGINS` | ❌        | Orígenes permitidos                 | `http://localhost:5173`                       |
| `NODE_ENV`     | ❌        | Entorno de ejecución                | `development`                                 |
| `LOG_LEVEL`    | ❌        | Nivel de logging                    | `info`                                        |

**Generar JWT_SECRET seguro:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Frontend (.env)

| Variable       | Requerida | Descripción   | Ejemplo                        |
| -------------- | --------- | ------------- | ------------------------------ |
| `VITE_API_URL` | ❌        | URL de la API | `http://localhost:3001/api/v1` |

## Scripts Disponibles

### Backend

```bash
npm run dev          # Desarrollo con hot-reload
npm run build        # Compilar TypeScript
npm run start        # Ejecutar versión compilada
npm run test         # Ejecutar tests
npm run test:watch   # Tests en modo watch
```

### Frontend

```bash
npm run dev          # Desarrollo con hot-reload
npm run build        # Build de producción
npm run preview      # Preview del build
npm run cy:open      # Abrir Cypress para E2E
npm run cy:run       # Ejecutar E2E headless
```

## Estructura del Proyecto

```
control_gastronomicoV2/
├── backend/
│   ├── prisma/           # Schema y migraciones
│   ├── src/
│   │   ├── controllers/  # Request handlers
│   │   ├── services/     # Lógica de negocio
│   │   ├── routes/       # Definición de endpoints
│   │   ├── middleware/   # Auth, errors, rate limiting
│   │   ├── lib/          # Prisma, Socket.IO
│   │   └── utils/        # Helpers
│   └── tests/            # Unit e integration tests
│
├── frontend/
│   ├── src/
│   │   ├── components/   # Componentes reutilizables
│   │   ├── modules/      # Funcionalidades por dominio
│   │   ├── pages/        # Páginas principales
│   │   ├── services/     # API clients
│   │   ├── store/        # Zustand stores
│   │   └── hooks/        # Custom hooks
│   └── cypress/          # E2E tests
│
└── DOCS/                 # Documentación adicional
```

## Características Principales

- ✅ **POS completo** con carrito, checkout y pagos
- ✅ **KDS (Kitchen Display)** con WebSocket real-time
- ✅ **Gestión de mesas** con drag & drop
- ✅ **Control de caja** con arqueo ciego
- ✅ **Inventario** con recetas y alertas de stock
- ✅ **RBAC** - Control de acceso por roles y permisos
- ✅ **Feature Flags** - Módulos activables/desactivables
- ✅ **Delivery Dashboard** con asignación de drivers

## Testing

```bash
# Backend - Unit tests
cd backend && npm test

# Frontend - E2E tests
cd frontend && npm run cy:run

# Cobertura
cd backend && npm run test:coverage
```

## Troubleshooting

### Error: "CRITICAL: JWT_SECRET environment variable is not defined"

Asegúrate de tener un archivo `.env` en `/backend` con `JWT_SECRET` definido.

### Error: "Can't reach database server"

1. Verificar que MySQL esté corriendo
2. Verificar credenciales en `DATABASE_URL`
3. Verificar que la base de datos exista

### CORS errors en frontend

Verificar que `CORS_ORIGINS` en backend incluya la URL del frontend.

---

## Contribuir

Ver [DOCS/PROTOCOLO_PDS.md](DOCS/PROTOCOLO_PDS.md) para el protocolo de desarrollo.

## Licencia

Propietario - Todos los derechos reservados.
