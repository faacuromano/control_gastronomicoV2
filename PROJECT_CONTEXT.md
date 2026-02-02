# PentiumPOS - Project Context & Architecture Reference

**System:** PentiumPOS Multi-Tenant SaaS Gastronomy POS
**Last Updated:** 2026-02-02
**Purpose:** Single source of truth for audits, security reviews, and production planning.

---

## 1. TECHNOLOGY STACK

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20 LTS | Runtime |
| Express | 5.2.1 | HTTP framework (RC, not stable) |
| TypeScript | ~5.9.3 | Language (strict mode enabled) |
| Prisma ORM | 6.19.2 | Database ORM with type-safe queries |
| MySQL | 8.0 | Primary database |
| Redis | 7 (Alpine) | Queue backend, Socket.IO adapter, idempotency cache |
| BullMQ | 5.66.5 | Async job processing (webhook queue) |
| Socket.IO | 4.8.3 | Real-time WebSocket (KDS, table updates, stock alerts) |
| Zod | 4.3.5 | Runtime input validation on all controllers |
| jsonwebtoken | 9.0.3 | JWT auth (HS256) |
| bcryptjs | 3.0.3 | Password hashing |
| Helmet | 8.1.0 | Security headers (CSP, HSTS) |
| express-rate-limit | 8.2.1 | Rate limiting |
| node-thermal-printer | 4.5.0 | ESC/POS thermal printer support |
| Jest + Vitest | | Testing (Jest for unit/integration, Vitest for forensic) |

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.2.0 | UI framework |
| TypeScript | ~5.9.3 | Language |
| Vite | 7.2.4 | Build tool + dev server |
| Zustand | 5.0.10 | State management (4 stores: auth, pos, kitchen, cash) |
| React Router | 7.12.0 | Client-side routing |
| TailwindCSS | 3.4.19 | Utility-first CSS |
| Dexie | 4.2.1 | IndexedDB wrapper (offline queue) |
| socket.io-client | 4.8.3 | WebSocket client |
| @dnd-kit | 6.3.1 | Drag & drop (table layout editor) |
| Radix UI | various | Accessible UI primitives |
| Lucide React | 0.562.0 | Icon library |
| vite-plugin-pwa | 1.2.0 | PWA/Service Worker generation |
| Cypress | 15.9.0 | E2E testing |
| Axios | 1.13.2 | HTTP client |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| Docker Compose | Local development orchestration |
| MySQL 8.0 container | `pentiumpos-db-dev` on port 3307 |
| Redis 7 container | `pentiumpos-redis-dev` on port 6379 |
| Dockerfile.prod | Multi-stage production build (non-root, tini, healthcheck) |
| docker-compose.prod.yml | Production overlay with Nginx + SSL |

---

## 2. ARCHITECTURE

### 2.1 Multi-Tenant Model

All data is isolated by `tenantId Int` (NOT NULL) on every Prisma model (31 models). The `Tenant` model is the root entity. Every authenticated request carries `tenantId` in the JWT payload. All database queries MUST filter by `tenantId`.

**Tenant resolution:** Frontend sends `businessCode` at login -> backend resolves to `tenantId` via `GET /auth/tenant/:code` -> JWT issued with `{ id, tenantId, role, permissions }`.

### 2.2 Backend Architecture (MVC + Service Layer)

```
src/
├── app.ts                    # Express config, middleware chain, route mounting
├── server.ts                 # HTTP server, Socket.IO init, graceful shutdown
├── config/                   # Environment validation
├── controllers/ (26 files)   # HTTP request handling, Zod validation, response
├── services/ (37 files)      # Business logic, Prisma queries, transactions
├── routes/ (25 files)        # Express Router definitions, middleware chains
├── middleware/ (9 files)     # Auth, RBAC, rate limit, validation, error handler
├── integrations/delivery/    # Delivery platform adapters (Rappi, PedidosYa, Glovo)
├── jobs/                     # BullMQ job definitions
├── lib/                      # Prisma client, Socket.IO, queue service
├── types/                    # TypeScript type extensions
└── utils/                    # Logger, errors, response helpers, business date
```

**Middleware chain order:** `helmet` -> `cors` -> `compression` -> `cookieParser` -> `express.json({limit:'1mb'})` -> `sanitizeBody` -> `correlationId` -> `morgan` -> routes -> `errorHandler`

**Auth flow:** `extractToken(cookie/header)` -> `jwt.verify(HS256)` -> `req.user = { id, tenantId, role, permissions }` -> `requirePermission(resource, action)` for RBAC

### 2.3 Frontend Architecture (Feature-First Modules)

```
src/
├── modules/
│   ├── admin/                # Back-office: products, categories, users, roles,
│   │   │                     # ingredients, suppliers, printers, settings, etc.
│   │   ├── products/         # ProductList, CategoryList, ProductForm
│   │   ├── tables/           # TablesAdminPage, DraggableTable
│   │   ├── users/            # UsersPage
│   │   ├── cash/             # CashShiftHistoryPage
│   │   └── pages/            # Dashboard, Settings, Ingredients, Suppliers,
│   │                         # Modifiers, Clients, Printers, PrintRouting,
│   │                         # PaymentMethods, PurchaseOrders, Roles, BulkPriceUpdate
│   ├── orders/
│   │   ├── pos/              # POSPage, POSLayout, ProductGrid, ShoppingCart,
│   │   │                     # CheckoutModal, Receipt, ClientLookup, DeliveryModal
│   │   ├── tables/           # TablePage, TableMap, FloorPlanEditor, TableDetailModal
│   │   └── delivery/         # DeliveryDashboard
│   ├── kitchen/              # KitchenPage, TicketCard, KitchenTimer
│   └── core/ui/              # Layout
├── pages/                    # Top-level: Home, Login, Register, Cash, QR Admin,
│                             # MenuPublic, DeliveryDrivers, DeliveryPlatforms
├── store/                    # Zustand stores: auth, pos, kitchen, cash
├── services/ (25 files)      # API service layer (Axios wrappers per domain)
├── hooks/                    # Custom React hooks
├── components/               # Shared UI components
├── lib/                      # Utility libraries
└── config/                   # App configuration
```

### 2.4 API Structure

All API routes are mounted under `/api/v1/`. Public routes: `/api/v1/auth/*`, `/api/v1/health`, `/api/v1/qr/*`, `/api/v1/menu/*`.

**25 route modules:**
| Module | Key Endpoints |
|--------|-------------|
| auth | login, register, refresh, PIN login, tenant lookup |
| order | CRUD, status transitions, add items, payments, void, transfer |
| table | CRUD areas/tables, open/close with order, positions |
| cashShift | open/close shift, reports, expected cash calculation |
| product | CRUD with modifiers, ingredients, channel pricing |
| category | CRUD product categories |
| modifier | CRUD modifier groups and options |
| ingredient | CRUD ingredients (inventory) |
| inventory | Stock movement registration, history |
| analytics | Revenue, top products, hourly sales, category breakdown |
| invoice | Fiscal invoice generation and listing |
| client | Search, create/upsert clients |
| supplier | CRUD suppliers |
| purchaseOrder | CRUD purchase orders with lifecycle |
| printer | CRUD thermal printers |
| printRouting | Category-to-printer routing, area overrides |
| delivery | Platform config, order management, driver assignment |
| discount | Apply/remove discounts on orders |
| loyalty | Points management, rewards |
| user | CRUD users with roles |
| role | CRUD roles with granular permissions |
| config | Tenant configuration |
| qr | QR code generation for tables |
| menu | Public menu for QR access |
| sync | Offline data sync (Dexie queue reconciliation) |
| paymentMethod | Dynamic payment method configuration |
| bulkPriceUpdate | Batch price changes across products |
| stockAlert | Low stock alert configuration and WebSocket notifications |

### 2.5 Database Schema (33 Prisma Models)

**Core Business Models:**
- `Tenant` (root), `TenantConfig`, `TenantPlatformConfig`
- `User`, `Role`, `RefreshToken`
- `Category`, `Product` (types: SIMPLE, COMBO, RECIPE), `ProductChannelPrice`
- `ModifierGroup`, `ModifierOption`, `ProductModifierGroup`
- `Ingredient`, `ProductIngredient`, `StockMovement`
- `Order` (channels: POS, WAITER_APP, QR_MENU, DELIVERY_APP)
- `OrderItem`, `OrderItemModifier`, `OrderSequence`
- `Payment`, `PaymentMethodConfig`
- `Area`, `Table`, `AreaPrinterOverride`
- `Client`, `CashShift`, `Invoice`, `TaxRate`
- `AuditLog` (40+ action types)
- `QrCode`, `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`
- `DeliveryPlatform`, `DeliveryDriver`

**Key Enums:** OrderStatus (7 states), ItemStatus (4 states), PaymentStatus (4 states), OrderChannel (4), PaymentMethod (5), FulfillmentType (4), TableStatus (4), StockMoveType (4), QrMenuMode (2), VehicleType (4)

### 2.6 Real-Time Communication (Socket.IO)

**Tenant-scoped rooms:** `tenant:${tenantId}:kitchen`, `tenant:${tenantId}:tables`, `tenant:${tenantId}:stock`

**Events:** Order status changes (KDS), table status updates, stock alerts (throttled), new order notifications.

**Auth:** JWT middleware on WebSocket connection (cookie + header fallback). Redis adapter supported when `REDIS_HOST` is set for horizontal scaling.

### 2.7 Delivery Integration Layer

**Adapter pattern:** `AbstractDeliveryAdapter` -> `RappiAdapter`, `PedidosYaAdapter` (Glovo, UberEats planned).

**Webhook flow:** `POST /api/v1/webhooks/:platform` -> `express.raw()` -> HMAC validation -> BullMQ queue -> async processor -> order creation/status update.

**Sync services:** `menuSync` (push menu to platforms), `stockSync` (push availability), `statusUpdate` (push order status changes).

### 2.8 Async Job Processing (BullMQ)

**Queue:** `webhooks` queue backed by Redis. Worker processes delivery webhooks asynchronously with retry logic.

**Initialization:** Conditional — only starts if `REDIS_HOST` or `ENABLE_QUEUE_WORKERS=true` is set. App functions without Redis for basic POS.

---

## 3. SECURITY PATTERNS IMPLEMENTED

### Authentication & Authorization
- JWT in HttpOnly cookies (primary) + Authorization header (fallback for API)
- HS256 algorithm with explicit `algorithms: ['HS256']` to prevent `alg: none` attacks
- Refresh token rotation (7-day, SHA-256 hashed in DB)
- PIN login for quick POS access (bcrypt-hashed)
- Account lockout: 5 failed attempts -> 15min lock
- RBAC: `requirePermission(resource, action)` middleware
- ADMIN role bypass (full access)

### Input Validation
- Zod schemas on all controller endpoints
- `express.json({ limit: '1mb' })` body size limit
- `sanitizeBody` middleware (prototype pollution prevention)
- `validateId` middleware (rejects NaN, negative, non-integer route params)
- JSON depth limiting on webhook payloads (max 10 levels)

### Multi-Tenant Isolation
- All Prisma models have `tenantId Int` (NOT NULL)
- Defense-in-depth: `updateMany/deleteMany` with `tenantId` filter (~45 instances)
- `findFirst` with `tenantId` before mutations (ownership verification)
- No `findUnique` without tenant scoping on user-facing endpoints
- Tenant-scoped WebSocket rooms

### Rate Limiting
- Auth endpoints: dedicated rate limiter
- Webhook endpoints: dedicated rate limiter
- User management: rate limited

### Security Headers
- Helmet with CSP, HSTS, X-Frame-Options
- CORS configured via `CORS_ORIGINS` env var
- Correlation IDs on all requests

### Audit Trail
- `AuditLog` model with 40+ action types
- Captures: userId, tenantId, action, targetType, targetId, metadata, IP, userAgent

---

## 4. KEY BUSINESS FLOWS

### Order Lifecycle
1. `createOrder` (OPEN) -> items with modifiers, optional payment
2. `updateStatus` -> CONFIRMED -> IN_PREPARATION (KDS picks up)
3. `updateItemStatus` -> PENDING -> COOKING -> READY -> SERVED (per item)
4. `addPayments` -> supports split payments, multiple methods
5. When fully paid -> CONFIRMED, `closedAt` set, table freed if applicable
6. `voidItem` -> cancels item with audit trail (reason required)
7. `transferItems` -> moves items between tables

### Table Flow
1. `openTableWithOrder` -> verifies FREE status, creates empty order, marks OCCUPIED
2. Waiter adds items via `addItemsToOrder`
3. `closeTableWithPayment` -> processes payments, frees table if fully paid

### Cash Shift
1. `openShift` -> creates CashShift with opening amount
2. Payments during shift are tracked
3. `closeShift` -> calculates expected cash, records closing amount, variance

### Business Date
- Gastronomy business day runs until 6:00 AM next day
- Orders at 2 AM belong to the previous calendar day's business date
- Implemented in `businessDate.service.ts` and `businessDate.ts` utility

### Order Numbering
- Atomic sequence generation per tenant per business date
- `OrderSequence` model with hourly sharding for concurrency
- Retry logic for P2002 unique constraint violations

---

## 5. INFRASTRUCTURE & DEPLOYMENT

### Docker Services
| Service | Container | Port | Details |
|---------|-----------|------|---------|
| MySQL 8.0 | pentiumpos-db-dev | 3307:3306 | max_connections=300, innodb_buffer_pool=256M |
| Redis 7 | pentiumpos-redis-dev | 6379:6379 | appendonly, maxmemory 256mb, password required |
| Backend | pentiumpos-backend-dev | 3001:3001 | Node.js, hot-reload via volume mounts |
| Frontend | pentiumpos-frontend-dev | 5173:5173 | Vite dev server |

### Production Deployment
- `Dockerfile.prod`: Multi-stage build, non-root user (UID 1001), tini for PID 1, healthcheck
- `docker-compose.prod.yml`: Nginx reverse proxy with SSL (certbot), `restart: always`
- Command: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`

### Environment Variables (Required)
- `DATABASE_URL` (MySQL connection string with pool params)
- `JWT_SECRET` (min 32 chars)
- `JWT_REFRESH_SECRET`
- `NODE_ENV` (production)
- `CORS_ORIGINS`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- `MYSQL_ROOT_PASSWORD`, `MYSQL_USER`, `MYSQL_PASSWORD`

### Graceful Shutdown
`server.ts` handles SIGTERM/SIGINT:
1. Stop accepting new HTTP connections
2. Close WebSocket server
3. Close BullMQ workers (wait for in-progress jobs)
4. Disconnect Prisma client
5. Exit process

---

## 6. TESTING STATUS

| Suite | Framework | Status |
|-------|-----------|--------|
| TypeScript compilation (`tsc --noEmit`) | TypeScript | 0 errors (strict mode + noImplicitReturns) |
| Tenant isolation integration | Jest | 13/13 PASS |
| OrderNumber forensic spec | Vitest | 17/17 PASS |
| Auth service unit tests | Jest | 25/25 PASS |
| Feature flags unit tests | Jest | PASS |
| Order service unit tests | Jest | 7/7 PASS |
| E2E tests | Cypress | Not implemented |
| Performance/load tests | - | Stress test scripts exist, not executed |

### TypeScript Strict Flags
- `strict: true` (includes noImplicitAny, strictNullChecks, etc.)
- `noImplicitReturns: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `noImplicitOverride: true`
- `noFallthroughCasesInSwitch: true`
- `isolatedModules: true`
- **NOT enabled:** `noUnusedLocals`, `noUnusedParameters` (~68 errors pending cleanup)

---

## 7. KNOWN LIMITATIONS & TECHNICAL DEBT

| Area | Issue |
|------|-------|
| Express 5 RC | Using Release Candidate, not stable release |
| bcryptjs | Package last published 2016, functional but unmaintained |
| Pagination | Not implemented on most list endpoints (uses `take` limits: 200-500) |
| File uploads | Not implemented; product images are URL strings |
| Soft delete | Only on Product, Supplier, User, DeliveryDriver; missing on Client, Area, Table |
| N+1 queries | Stock updates, bulk price operations still sequential |
| OpenAPI/Swagger | No API documentation generated |
| Frontend `alert()` | 5 instances in POSPage need toast notification system |
| Frontend `any` types | ~48 instances need elimination |
| Offline sync | Dexie queue exists but no conflict resolution strategy documented |
| APM/Monitoring | No Sentry, Datadog, or metrics endpoint |
| CI/CD | No pipeline defined |
| JWT rotation | No secret rotation strategy |
| `noUnusedLocals` | ~68 unused variable warnings across src and tests |

---

## 8. FILE INVENTORY (Production Code)

### Backend (131 production .ts files)
- **Controllers:** 26 files (analytics, auth, bulkPriceUpdate, cashShift, category, client, delivery, discount, ingredient, invoice, loyalty, modifier, order, paymentMethod, printer, printRouting, product, purchaseOrder, qr, role, stockAlert, stockMovement, supplier, sync, table, user)
- **Services:** 37 files (analytics, audit, auth, bulkPriceUpdate, businessDate, cashShift, category, client, delivery, discount, featureFlags, ingredient, invoice, kds, loyalty, marginConsent, modifier, order, orderDelivery, orderItem, orderKitchen, orderNumber, orderStatus, orderTransfer, orderVoid, payment, paymentMethod, printer, printRouting, product, purchaseOrder, qr, stockAlert, stockMovement, supplier, sync, table)
- **Routes:** 25 files (all domains listed above)
- **Middleware:** 9 files (asyncHandler, auth, correlationId, csrf, error, idempotency, rateLimit, sanitize-body, validateId)
- **Integrations:** 17 files (delivery adapters, webhook processing, sync services)
- **Lib:** 3 files (prisma, prisma-extensions, socket) + queue/ (BullMQ service, types)
- **Utils:** 6 files (businessDate, errors, logger, response, paymentMethod + test)
- **Types:** 3 files (express-extensions, order.types, sync.types)
- **Jobs:** 1 file (scheduled jobs index)

### Frontend (~70 .tsx/.ts source files)
- **Modules:** 41 .tsx components across admin, orders, kitchen, core
- **Pages:** 8 top-level page components
- **Stores:** 4 Zustand stores (auth, pos, kitchen, cash)
- **Services:** 25 API service files
- **Config, hooks, components, lib:** additional shared files

---

*This document is the single source of truth for performing audits on this codebase. All previous audit reports, fix tracking documents, and session-specific markdown files have been archived.*
