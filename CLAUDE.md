# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PentiumPOS is a multi-tenant POS (Point of Sale) system for restaurants. It features real-time kitchen display (KDS), table management, delivery integration, inventory control, and cash register operations.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS + Zustand (state) + Socket.IO client
- **Backend**: Express 5 + TypeScript + Prisma ORM + Socket.IO
- **Database**: MySQL 8 (multi-tenant with `tenantId` on every table)
- **Queue**: BullMQ + Redis (optional, for delivery webhooks)
- **Auth**: JWT in HttpOnly cookies + PIN-based login

## Common Commands

### Backend (`cd backend`)
```bash
npm run dev              # Start with hot-reload (nodemon)
npm run build            # Compile TypeScript
npm test                 # Run all Jest tests
npm run test:unit        # Run only unit tests (tests/unit)
npm run test:integration # Run only integration tests (tests/integration)
npm run test:coverage    # Run tests with coverage report
npx prisma migrate dev   # Create/apply migrations in development
npx prisma migrate deploy # Apply migrations in production
npx prisma db seed       # Seed database with sample data
npx prisma generate      # Regenerate Prisma client after schema changes
```

### Frontend (`cd frontend`)
```bash
npm run dev      # Start Vite dev server (port 5173)
npm run build    # Production build (runs tsc first)
npm run lint     # ESLint check
npm run cy:open  # Open Cypress for interactive E2E testing
npm run cy:run   # Run Cypress E2E tests headless
```

## Architecture

### Multi-Tenancy
Every database record belongs to a `Tenant`. All queries must be scoped by `tenantId` which is extracted from the JWT token. The `tenantId` is injected into `req.tenantId` by the auth middleware.

### Backend Structure
```
backend/src/
├── controllers/     # Request handlers (thin, delegate to services)
├── services/        # Business logic layer
├── routes/          # Express route definitions with auth/permission middleware
├── middleware/      # auth.ts, error.ts, rateLimit.ts, csrf.ts, sanitize-body
├── lib/             # prisma.ts, socket.ts, queue/BullMQService.ts
├── integrations/    # Delivery platforms (Rappi, PedidosYa adapters)
└── utils/           # logger.ts, errors.ts (ApiError classes)
```

### Frontend Structure
```
frontend/src/
├── modules/         # Feature modules (admin, kitchen, orders)
│   ├── admin/       # Admin pages: users, products, settings
│   ├── kitchen/     # KDS (Kitchen Display System)
│   └── orders/      # POS, tables, delivery dashboard
├── store/           # Zustand stores (auth, pos, cash, kitchen)
├── services/        # API client functions (one per domain)
├── context/         # SocketContext for real-time updates
├── components/      # Shared UI components
└── lib/             # api.ts (axios instance), offlineDb.ts (Dexie)
```

### Real-Time Communication
Socket.IO is used for:
- KDS updates (new orders, item status changes)
- Table status changes
- Stock alerts
- Order notifications

The frontend connects via `SocketContext`. Events are emitted from services using `getIO().to(room).emit()`.

### API Versioning
All endpoints are under `/api/v1/`. Key route groups:
- `/api/v1/auth` - Login (PIN or password), logout, refresh
- `/api/v1/orders` - Order CRUD, payments, status updates
- `/api/v1/delivery` - Delivery platforms, drivers
- `/api/v1/cash-shifts` - Cash register open/close
- `/api/v1/webhooks` - External platform webhooks (HMAC verified)

### Authentication Flow
1. User logs in with PIN (6 digits) or email/password
2. Server sets `auth_token` HttpOnly cookie with JWT
3. Frontend axios uses `withCredentials: true`
4. Auth middleware reads cookie, validates JWT, sets `req.userId` and `req.tenantId`

### RBAC (Role-Based Access Control)
Permissions are stored as JSON in the `Role` model. Use the `authorize()` middleware:
```typescript
router.post('/', authenticate, authorize('orders', 'create'), controller.create);
```

### Feature Flags
Tenant-specific feature toggles in `TenantConfig`: `enableStock`, `enableDelivery`, `enableKDS`, etc. Frontend uses `RouteGuard` component with `flag` prop.

## Testing

### Backend Tests
- **Unit tests**: `tests/unit/` - Mock Prisma and test services in isolation
- **Integration tests**: `tests/integration/` - Test with real database queries
- Test files must end in `.test.ts`
- Uses Jest with ts-jest preset

### Frontend E2E Tests
- Located in `frontend/cypress/e2e/`
- Key flows: `sanity.cy.ts`, `cash_shift.cy.ts`, `kds_workflow.cy.ts`

## Key Patterns

### Error Handling
Backend uses custom `ApiError` classes (`NotFoundError`, `UnauthorizedError`, etc.) that are caught by the global error handler and returned as:
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "..." } }
```

### Decimal Handling
Use `Decimal` type from Prisma for money fields. Convert to number only for display.

### Business Date
Orders use `businessDate` (date without time) for daily numbering. The sequence resets each day per tenant.

### Soft Deletes
Critical entities (orders, clients, tables) use `isActive` or `deletedAt` instead of hard deletes to preserve audit history.

## Environment Variables

### Backend (`.env`)
- `DATABASE_URL` - MySQL connection string (required)
- `JWT_SECRET` - Secret for token signing (required, min 32 chars)
- `PORT` - Server port (default: 3001)
- `CORS_ORIGINS` - Comma-separated allowed origins (required in production)
- `REDIS_HOST`, `REDIS_PASSWORD` - For BullMQ queue (optional)

### Frontend (`.env`)
- `VITE_API_URL` - Backend URL (default: `http://localhost:3001/api/v1`)

## Default Credentials (with seed)
- Admin PIN: `999999`
