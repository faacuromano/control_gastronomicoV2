# ARCHITECTURE — PentiumPOS

## System Overview

PentiumPOS is a multi-tenant, real-time restaurant Point of Sale system designed for Argentine gastronomy businesses. It manages the full restaurant lifecycle: order taking (POS, tables, QR self-ordering, delivery platforms), kitchen display & preparation, cash register shifts, inventory tracking, printing, invoicing, and analytics. Every data record is scoped by `tenantId` to guarantee isolation between restaurants.

---

## Module Map & Boundaries

```
┌──────────────────────────────────────────────────────────────────────┐
│                          CLIENT (React 19 SPA)                       │
│                                                                      │
│  Pages ─→ Components ─→ Hooks ─→ Zustand Stores ─→ Services ─→ API  │
│                                                                      │
│  SocketProvider (Socket.IO client, withCredentials)                   │
│  OfflineDB (Dexie/IndexedDB) ←→ SyncManager                        │
└────────────────────────┬─────────────────────────────────────────────┘
                         │ HTTP REST (JSON) + WebSocket (Socket.IO)
                         │ Auth: HttpOnly cookie `auth_token` (JWT HS256)
┌────────────────────────▼─────────────────────────────────────────────┐
│                          SERVER (Express 5)                           │
│                                                                      │
│  Middleware Chain:                                                    │
│    body-parse → cookie-parse → sanitize-body → CORS → helmet →      │
│    correlationId → requestLogger → compression → CSRF                │
│                                                                      │
│  Routes ─→ [authenticate → requirePermission] ─→ Controllers         │
│  Controllers ─→ Services (business logic) ─→ Prisma ORM              │
│  Services ─→ getIO() for real-time events                            │
│  Services ─→ BullMQ (optional, for webhook processing)               │
└────────────────────────┬─────────────────────────────────────────────┘
                         │ Prisma Client (connection pool)
┌────────────────────────▼─────────────────────────────────────────────┐
│                          DATABASE (MySQL 8)                           │
│  33 models, all with tenantId FK → Tenant                            │
│  Soft deletes on Order, Client, Table, Area (deletedAt / isActive)   │
└──────────────────────────────────────────────────────────────────────┘

Optional:
┌──────────────────────────────────────────────────────────────────────┐
│  Redis — BullMQ job queue (delivery webhooks) + Socket.IO adapter    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Module Specifications

### Module: Authentication
- **Responsibility:** User identity verification (PIN or password), JWT issuance/refresh, session management, account lockout
- **Location:** `backend/src/services/auth.service.ts`, `backend/src/controllers/auth.controller.ts`, `backend/src/routes/auth.routes.ts`, `backend/src/middleware/auth.ts`
- **Key files:**
  - `middleware/auth.ts` — `authenticateToken`, `authorize`, `requirePermission`
  - `services/auth.service.ts` — `loginWithPin()`, `loginWithPassword()`, `register()`, `refreshToken()`
  - `types/express-extensions.ts` — `JwtPayload`, `Permissions`, `AuthenticatedUser`
- **Input contract:** PIN (6-digit string) or email+password+tenantId
- **Output contract:** Sets `auth_token` HttpOnly cookie (JWT HS256, 15min), `refresh_token` cookie (7d). Returns `{ user: { id, name, role, permissions, tenantId } }`
- **Internal patterns:**
  - JWT token extracted from cookie first, then `Authorization: Bearer` header as fallback
  - Algorithm locked to `HS256` to prevent `alg:none` attack
  - PIN lookup uses SHA-256 `pinLookup` column for O(1) lookup, then bcrypt verification
  - Lockout after 5 failed attempts for 15 minutes
  - Refresh tokens are SHA-256 hashed, rotated on use, max 5 per user
- **Constraints:** ADMIN role bypasses all permission checks. `tenantId` required in every JWT.
- **Current state:** 95% complete. Minor: no email verification.

### Module: Orders / POS
- **Responsibility:** Order lifecycle (create → items → payment → close), cart management, multi-channel support
- **Location:** `backend/src/services/order.service.ts`, `orderItem.service.ts`, `orderStatus.service.ts`, `orderVoid.service.ts`, `orderTransfer.service.ts`, `payment.service.ts`; `frontend/src/modules/orders/pos/`
- **Key files:**
  - `services/order.service.ts` — `createOrder()`, `getOrders()`, `closeOrder()`
  - `services/orderItem.service.ts` — `addItems()`, `markAllServed()`
  - `services/payment.service.ts` — `addPayments()` (partial payment support)
  - `services/orderNumber.service.ts` — daily sequence with hourly sharding
  - `controllers/order.controller.ts` — route handlers
  - `frontend/src/store/pos.store.ts` — cart state (Zustand)
  - `frontend/src/modules/orders/pos/pages/POSPage.tsx` — main POS interface
- **Input contract:** `{ items: [{productId, quantity, notes?, modifiers?}], tableId?, clientId?, channel }` from controller
- **Output contract:** Order object with items, payments, totals. Socket events: `order:new`, `order:status-changed`
- **Internal patterns:**
  - `orderNumber` is unique per tenant per business date (daily reset, hourly-sharded sequence)
  - `businessDate` computed from `businessDate.service.ts`
  - Idempotency middleware on order creation and payments
  - Stock deduction on order creation if `enableStock` is true
  - `validateId()` middleware on all URL params
  - Void requires `orders:delete` permission (manager-level)
- **Constraints:** All order queries scoped by `tenantId`. Soft-delete via `deletedAt`.
- **Current state:** 90% complete. Minor debt in discount application.

### Module: Tables
- **Responsibility:** Floor plan management, table status (FREE/OCCUPIED/RESERVED/CLEANING), area organization, drag-and-drop positioning
- **Location:** `backend/src/services/table.service.ts`, `backend/src/controllers/table.controller.ts`; `frontend/src/modules/orders/tables/`, `frontend/src/modules/admin/tables/`
- **Key files:**
  - `services/table.service.ts` — `openTable()`, `closeTable()`, `getTables()`, `createArea()`, `updateTable()`
  - `frontend/src/modules/orders/tables/pages/TablePage.tsx` — interactive floor map
  - `frontend/src/modules/admin/tables/TablesAdminPage.tsx` — admin drag-and-drop editor
- **Input contract:** Area CRUD: `{ name }`. Table CRUD: `{ name, areaId, x?, y? }`. Close: `{ payments: [{method, amount}] }`
- **Output contract:** Table with area, status, currentOrder. Socket events for table status changes.
- **Internal patterns:**
  - `currentOrderId` is a unique FK on Table for one-to-one active order relationship
  - Table position stored as `x`, `y` integers for floor plan rendering
  - @dnd-kit used for drag-and-drop in admin editor
  - Areas and tables use `isActive` soft-delete
- **Constraints:** Table name unique per tenant.
- **Current state:** 85% complete. Position validation debt.

### Module: Kitchen Display System (KDS)
- **Responsibility:** Kitchen order display, item status tracking (PENDING→COOKING→READY→SERVED), station routing, timer display
- **Location:** `backend/src/services/kds.service.ts`, `orderKitchen.service.ts`, `kdsStation.service.ts`; `frontend/src/modules/kitchen/`
- **Key files:**
  - `services/kds.service.ts` — item status updates, station-based filtering
  - `services/kdsStation.service.ts` — KDS station CRUD
  - `frontend/src/modules/kitchen/pages/KitchenPage.tsx` — kitchen display
  - `frontend/src/modules/kitchen/pages/components/TicketCard.tsx` — order ticket
  - `frontend/src/store/kitchen.store.ts` — kitchen state
- **Input contract:** Item status updates from kitchen staff. Station filter from `kdsStationId`.
- **Output contract:** Socket events: `kitchen:new-order`, `kitchen:item-status`, `kitchen:order-ready`
- **Internal patterns:**
  - Products inherit KDS station from their category (`category.kdsStationId`), with product-level override (`product.kdsStationId`)
  - Default station (per tenant) catches items without explicit station
  - Kitchen timer displays elapsed time since order creation
  - Socket rooms: `tenant:{id}:kitchen`, `tenant:{id}:kitchen:station:{code}`
- **Constraints:** Feature-flagged via `enableKDS` in TenantConfig.
- **Current state:** 90% backend, 85% frontend.

### Module: Cash Shifts
- **Responsibility:** Cash register open/close lifecycle, blind count verification, shift reports
- **Location:** `backend/src/services/cashShift.service.ts`, `backend/src/controllers/cashShift.controller.ts`; `frontend/src/store/cash.store.ts`
- **Key files:**
  - `services/cashShift.service.ts` — `openShift()`, `closeShift()`, `getShiftReport()`
  - `frontend/src/store/cash.store.ts` — cash shift Zustand store
  - `frontend/src/services/cashShiftService.ts` — API calls
- **Input contract:** Open: `{ startAmount }`. Close: `{ endAmount }` (blind count).
- **Output contract:** Shift with payments summary by method. Audit log entries.
- **Internal patterns:**
  - Only one active shift per user at a time
  - `businessDate` on CashShift for day-end reconciliation
  - Payments are linked to shifts via `shiftId` FK
  - Blind count: user declares expected amount (`endAmount`), compared to calculated total
- **Current state:** 90% complete.

### Module: Menu / Catalog
- **Responsibility:** Product and category CRUD, modifier groups/options, product types (SIMPLE, COMBO, RECIPE)
- **Location:** `backend/src/services/category.service.ts`, `product.service.ts`, `modifier.service.ts`; `frontend/src/modules/admin/products/`
- **Key files:**
  - `services/product.service.ts` — product CRUD with ingredient/modifier relations
  - `services/category.service.ts` — category CRUD with printer/KDS station assignment
  - `services/modifier.service.ts` — modifier group/option CRUD
  - `frontend/src/modules/admin/products/ProductList.tsx`, `CategoryList.tsx`, `ProductForm.tsx`
- **Input contract:** Product: `{ name, price, categoryId, productType, isStockable, ingredients[], modifierGroupIds[] }`. Category: `{ name, printerId?, kdsStationId? }`
- **Output contract:** Product with relations (category, ingredients, modifiers, channel prices)
- **Internal patterns:**
  - Product-Category is many-to-one
  - ProductModifierGroup is junction table
  - ProductIngredient with quantity for stock deduction
  - Modifier options can have price overlay and ingredient link
- **Current state:** 85% complete. Modifier UX debt.

### Module: Inventory
- **Responsibility:** Ingredient stock tracking, stock movements (PURCHASE/SALE/WASTE/ADJUSTMENT), purchase orders, suppliers
- **Location:** `backend/src/services/ingredient.service.ts`, `stockMovement.service.ts`, `supplier.service.ts`, `purchaseOrder.service.ts`, `stockAlert.service.ts`
- **Key files:**
  - `services/stockMovement.service.ts` — movement recording
  - `services/stockAlert.service.ts` — low stock alerts via Socket.IO
  - `services/purchaseOrder.service.ts` — PO workflow (PENDING→ORDERED→RECEIVED)
- **Input contract:** Stock movement: `{ ingredientId, type, quantity, reason? }`. PO: `{ supplierId, items: [{ingredientId, quantity, unitCost}] }`
- **Output contract:** Updated stock levels. Socket events: `stock:alert` to `admin:stock` room
- **Internal patterns:**
  - Stock auto-decremented on order creation (via ProductIngredient quantities)
  - Alert threshold: `ingredient.minStock`
  - PO reception auto-creates PURCHASE stock movements
- **Constraints:** Feature-flagged via `enableStock`.
- **Current state:** 80% complete. PO workflow debt.

### Module: Delivery
- **Responsibility:** External delivery platform integration (Rappi, PedidosYa, Glovo), driver management, multi-channel pricing, webhook processing
- **Location:** `backend/src/services/delivery.service.ts`, `orderDelivery.service.ts`, `marginConsent.service.ts`; `backend/src/integrations/delivery/`
- **Key files:**
  - `services/delivery.service.ts` — platform/driver CRUD
  - `integrations/delivery/` — platform adapters, webhook handlers, BullMQ processor
  - `services/marginConsent.service.ts` — safety lock for delivery pricing margins
- **Input contract:** Webhooks: platform-specific payloads with HMAC signature. Driver: `{ name, phone, vehicleType }`
- **Output contract:** Orders created via `QR_MENU` or `DELIVERY_APP` channel. ProductChannelPrice for per-platform pricing.
- **Internal patterns:**
  - Webhook HMAC verification with `crypto.timingSafeEqual`
  - BullMQ queue for async webhook processing (requires Redis)
  - FulfillmentType enum: DINE_IN, TAKEAWAY, PLATFORM_DELIVERY, SELF_DELIVERY
  - Margin consent system for delivery platform pricing safety
- **Constraints:** Feature-flagged via `enableDelivery`. Redis required for queue.
- **Current state:** 75% backend, 70% frontend. Webhook handlers incomplete.

### Module: QR Menu
- **Responsibility:** Public QR-based menu display, self-ordering, QR code generation/management
- **Location:** `backend/src/services/qr.service.ts`, `qrOrder.service.ts`, `backend/src/controllers/qr.controller.ts`; `frontend/src/pages/MenuPublicPage.tsx`, `QrAdminPage.tsx`
- **Key files:**
  - `services/qr.service.ts` — QR code CRUD, menu retrieval
  - `services/qrOrder.service.ts` — self-order placement
  - `routes/qr.routes.ts` — split into `qrPublicRouter` (unauthenticated) and `qrAdminRouter` (authenticated)
- **Input contract:** Public: GET `/api/v1/qr/:code` (menu), POST `/api/v1/qr/:code/order` (order). Admin: CRUD for QR codes
- **Output contract:** Public menu with categories/products/modifiers. Orders created with `QR_MENU` channel.
- **Internal patterns:**
  - QR codes have unique 12-char short code
  - Can be linked to a table or generic (no table)
  - Rate limited: 5 orders/minute per IP
  - Two modes: INTERACTIVE (DB-driven) and STATIC (PDF URL)
  - Config in TenantConfig: `qrMenuEnabled`, `qrSelfOrderEnabled`, `qrMenuMode`
- **Current state:** 85% backend, 80% frontend.

### Module: Invoicing
- **Responsibility:** Receipt generation, fiscal invoice support (Argentina: Factura B)
- **Location:** `backend/src/services/invoice.service.ts`, `backend/src/controllers/invoice.controller.ts`
- **Input contract:** `{ orderId, type: 'RECEIPT' | 'INVOICE_B', clientName?, clientTaxId? }`
- **Output contract:** Invoice with number, subtotal, tax, total
- **Internal patterns:**
  - Invoice number unique per tenant
  - Tax rates configurable via TaxRate model
  - Invoice linked 1:1 with Order (cascade protection via `onDelete: Restrict`)
- **Current state:** 70% backend, 60% frontend. No AFIP fiscal integration.

### Module: Analytics
- **Responsibility:** Sales dashboard, reports (daily sales, top products, payment method breakdown)
- **Location:** `backend/src/services/analytics.service.ts`, `backend/src/controllers/analytics.controller.ts`; `frontend/src/modules/admin/pages/DashboardPage.tsx`
- **Current state:** 70% backend, 60% frontend. Partially implemented.

### Module: Clients / Loyalty
- **Responsibility:** Customer database, loyalty points, wallet balance
- **Location:** `backend/src/services/client.service.ts`, `loyalty.service.ts`; `frontend/src/modules/admin/pages/ClientsPage.tsx`
- **Internal patterns:**
  - Client has `points` (Int) and `walletBalance` (Decimal)
  - Orders linked to clients via `clientId` FK
- **Current state:** 60% backend, 50% frontend. Wallet system skeletal.

### Module: Config / Settings
- **Responsibility:** Tenant configuration, feature flags, business name, currency, tax defaults
- **Location:** `backend/src/services/featureFlags.service.ts`, `backend/src/routes/config.routes.ts`; `frontend/src/modules/admin/pages/SettingsPage.tsx`, `frontend/src/hooks/useFeatureFlags.ts`
- **Key files:**
  - `services/featureFlags.service.ts` — feature flag CRUD
  - `frontend/src/hooks/useFeatureFlags.ts` — cached flag fetching
  - `frontend/src/components/auth/RouteGuard.tsx` — UI flag enforcement
- **Internal patterns:**
  - Feature flags stored in `TenantConfig`: `enableStock`, `enableDelivery`, `enableKDS`, `enableFiscal`, `enableDigital`, `enableBlindCount`
  - Frontend `RouteGuard` component checks both RBAC permissions and feature flags
  - Feature flags cached on frontend with background refresh
- **Current state:** 90% backend, 85% frontend.

### Module: Printing
- **Responsibility:** Thermal printer management, category-to-printer routing, area-specific overrides
- **Location:** `backend/src/services/printer.service.ts`, `printRouting.service.ts`; `frontend/src/modules/admin/pages/PrintersPage.tsx`, `PrintRoutingPage.tsx`
- **Internal patterns:**
  - Printer connection types: NETWORK (TCP/IP) or USB (Windows printer name)
  - Category → Printer default routing
  - AreaPrinterOverride: area-specific routing (e.g., "Terraza" sends all drinks to "Terraza Printer")
  - Uses `node-thermal-printer` library
- **Current state:** 80% complete.

### Module: Audit
- **Responsibility:** Logging critical business operations with user, entity, action, and details
- **Location:** `backend/src/services/audit.service.ts`
- **Internal patterns:**
  - AuditLog model with 30+ action types (LOGIN, ORDER_CREATED, PAYMENT_RECEIVED, SHIFT_CLOSED, etc.)
  - Captures userId, entity name, entityId, details (JSON), ipAddress, userAgent
  - Indexed by `[tenantId, createdAt]` and `[tenantId, entity, entityId]`
- **Current state:** 90% backend, 0% frontend (backend-only service).

### Module: Sync / Offline
- **Responsibility:** Offline-first POS operation via IndexedDB, sync manager for push/pull
- **Location:** `frontend/src/lib/offlineDb.ts`, `frontend/src/lib/syncManager.ts`, `frontend/src/lib/swBridge.ts`, `frontend/src/sw.ts`; `backend/src/services/sync.service.ts`
- **Key files:**
  - `offlineDb.ts` — Dexie database: cached products/categories, pending orders/payments, sync metadata
  - `syncManager.ts` — push pending operations, pull catalog updates
  - `sw.ts` — service worker for PWA
- **Internal patterns:**
  - Pending orders stored locally with `tempId` and status (pending → syncing → synced → error)
  - Full sync on app startup: push pending then pull catalog
  - Sync token for incremental updates
  - Cleanup: synced records deleted after 24h
- **Current state:** 70% complete. Conflict resolution rudimentary.

### Module: Roles / Users
- **Responsibility:** User CRUD, role management, RBAC permission assignment
- **Location:** `backend/src/controllers/user.controller.ts`, `role.controller.ts`; `frontend/src/modules/admin/users/UsersPage.tsx`, `frontend/src/modules/admin/pages/RolesPage.tsx`
- **Internal patterns:**
  - Permissions stored as JSON in Role model: `{ resource: [actions] }`
  - Registration requires authentication (only existing authenticated users can register new users)
  - Users can authenticate via PIN or email/password
- **Current state:** 90% backend, 85% frontend.

### Module: Discounts
- **Responsibility:** Discount application to orders
- **Location:** `backend/src/services/discount.service.ts`, `backend/src/controllers/discount.controller.ts`
- **Current state:** 60% backend, 50% frontend. Manual only, no rule engine.

### Module: Bulk Pricing
- **Responsibility:** Mass price updates for products
- **Location:** `backend/src/services/bulkPriceUpdate.service.ts`, `backend/src/controllers/bulkPriceUpdate.controller.ts`; `frontend/src/modules/admin/pages/BulkPriceUpdatePage.tsx`
- **Current state:** 75% complete.

---

## Data Contracts Between Modules

| From → To | Interface | Data Shape | Protocol |
|-----------|-----------|------------|----------|
| Client → Server | REST API | JSON | HTTP with `auth_token` HttpOnly cookie |
| Client → Server | WebSocket | Events with JSON payload | Socket.IO with cookie auth |
| Routes → Controllers | `authenticate` + `requirePermission` middleware chain | `req.user: JwtPayload` injected | Direct |
| Controllers → Services | Function calls | Domain-specific params + `tenantId` from `req.user` | Direct |
| Services → Prisma | Prisma Client queries | All queries include `where: { tenantId }` | Prisma Client |
| Services → Socket.IO | `getIO().to(room).emit()` | Tenant-scoped rooms: `tenant:{id}:{suffix}` | Socket.IO |
| Services → Queue | BullMQ job enqueue | JSON payload in Redis | BullMQ |
| Frontend → Zustand | Store actions | TypeScript interfaces | Direct |
| Frontend → API | Axios `api` instance | JSON request/response | HTTP |
| Frontend → IndexedDB | Dexie ORM | `OfflineProduct`, `PendingOrder`, etc. | IndexedDB |

### Key Type Definitions

| Type | Location | Description |
|------|----------|-------------|
| `JwtPayload` | `backend/src/types/express-extensions.ts` | JWT token contents: `{ id, role, name, permissions?, tenantId }` |
| `Permissions` | `backend/src/types/express-extensions.ts` | `Record<string, string[]>` — resource to actions map |
| `AuthenticatedUser` | `backend/src/types/express-extensions.ts` | Extends JwtPayload on `req.user` |
| `ApiResponse<T>` | `backend/src/utils/response.ts` | `{ success, data?, error?, meta? }` |
| `ApiError` hierarchy | `backend/src/utils/errors.ts` | `ValidationError(400)`, `NotFoundError(404)`, `UnauthorizedError(401)`, etc. |
| `User` | `frontend/src/store/auth.store.ts` | `{ id, name, role, permissions, tenantId }` |
| `RolePermissions` | `frontend/src/store/auth.store.ts` | `{ [resource]: ('access'|'create'|'read'|'update'|'delete')[] }` |
| `OfflineProduct` | `frontend/src/lib/offlineDb.ts` | Cached product for offline POS |
| `PendingOrder` | `frontend/src/lib/offlineDb.ts` | Offline order queued for sync |

---

## Design Decisions (decided)

| # | Decision | Chosen | Rationale | Alternatives Rejected |
|---|----------|--------|-----------|----------------------|
| 1 | ORM | Prisma 6 | Already in use, typed schema, MySQL support | TypeORM, Drizzle |
| 2 | Auth mechanism | JWT in HttpOnly cookies | XSS-resistant, no localStorage tokens | Session-based, localStorage JWT |
| 3 | Auth algorithm | HS256 (symmetric) | Single-server deployment, simpler key management | RS256 |
| 4 | State management | Zustand with persist middleware | Lightweight, no boilerplate, persists to localStorage | Redux, Jotai, Context API |
| 5 | Multi-tenancy | Row-level (tenantId on every table) | Simple, proven, no schema-per-tenant overhead | Schema-per-tenant, DB-per-tenant |
| 6 | Real-time | Socket.IO | Bidirectional, room-based, cookie auth support | WebSockets raw, SSE |
| 7 | Offline storage | Dexie (IndexedDB) | Browser-native, async, structured queries | localForage, direct IDB API |
| 8 | Frontend routing | react-router-dom 7 | Standard React router, already in use | TanStack Router, Next.js |
| 9 | Validation | Zod | Runtime + TypeScript inference, composable | Joi, Yup, class-validator |
| 10 | Queue system | BullMQ + Redis | Reliable, retries, concurrency control | RabbitMQ, in-process queue |
| 11 | Error classes | Custom ApiError hierarchy | Typed HTTP codes, caught by global handler | Plain Error + status codes |
| 12 | API versioning | URL prefix `/api/v1/` | Simple, explicit, easy to manage | Header-based, query param |
| 13 | UI components | Radix UI primitives + TailwindCSS | Accessible, unstyled, composable | shadcn/ui, MUI, Ant Design |
| 14 | RBAC model | JSON permissions in Role model | Flexible, no join tables, easy to extend | Separate Permission table, Casbin |
| 15 | Order numbering | Daily reset, hourly-sharded sequence | Human-friendly numbers, reduced lock contention | UUID, global auto-increment |
| 16 | Soft deletes | `isActive` / `deletedAt` fields | Preserve audit trail, fiscal compliance | Hard deletes |
| 17 | CSRF protection | `X-Requested-With` header check | Simple, works with SPA + cookies | CSRF token, double-submit cookie |
| 18 | Code splitting | `React.lazy()` per page | Built-in, no library needed | Route-based with loadable-components |

---

## Design Decisions (pending — require user input)

No pending architectural decisions. All technology and pattern choices are determined by the existing codebase.

---

## Code Standards (discovered from this project)

### Naming
- **Files:** `camelCase.service.ts`, `camelCase.controller.ts`, `camelCase.routes.ts` (backend); `PascalCase.tsx` for components, `camelCase.ts` for services/stores (frontend)
- **Functions:** `camelCase` — service functions are verbs: `createOrder`, `getProducts`, `closeShift`
- **Variables:** `camelCase`
- **API routes:** `kebab-case` — `/api/v1/cash-shifts`, `/api/v1/kds-stations`, `/api/v1/bulk-prices`
- **Database:** `PascalCase` for models, `camelCase` for fields
- **Enums:** `UPPER_SNAKE_CASE` values: `OrderStatus.IN_PREPARATION`, `PaymentMethod.QR_INTEGRATED`
- **Socket rooms:** `tenant:{tenantId}:{suffix}` — e.g., `tenant:1:kitchen`, `tenant:1:table:5`

### Error Handling
- **Backend:** Services throw `ApiError` subclasses (`NotFoundError`, `ValidationError`, `BadRequestError`, etc.). Global `errorHandler` middleware in `middleware/error.ts` catches all errors and returns standardized JSON. Also handles `ZodError`, `PrismaClientKnownRequestError`, and `SyntaxError`. Stack traces hidden in production.
- **Frontend:** Axios response interceptor in `lib/api.ts` handles 401 (auto-logout), 403, 429. `hasUserMessage()` type guard for extracting friendly messages. `ErrorBoundary` component wraps the app.

### Validation
- **Backend:** Zod schemas defined inline in controllers (not separate schema files). `z.object({...}).strict()` with `.transform()` to strip undefined values for `exactOptionalPropertyTypes` compatibility.
- **Frontend:** Form validation via controlled components, no schema library on frontend.

### API Response Shape
```
Success: { success: true, data: T, meta?: { page, limit, total, totalPages } }
Error:   { success: false, error: { code: string, message: string, details?: unknown } }
```
Helpers: `sendSuccess(res, data, meta?, statusCode?)` and `sendError(res, code, message, details?, statusCode?)` in `utils/response.ts`.

### Testing
- **Backend:** Jest + ts-jest + supertest. Unit tests in `backend/tests/unit/`, integration in `backend/tests/integration/`. Pattern: describe blocks per function, mock Prisma client.
- **Frontend:** Cypress E2E in `frontend/cypress/e2e/`. Key flows: `sanity.cy.ts`, `cash_shift.cy.ts`, `kds_workflow.cy.ts`.

### Route Pattern
Every route file follows:
```typescript
const router = Router();
router.use(authenticate);  // Auth on all routes
router.post('/', requirePermission('resource', 'create'), controller.create);
router.get('/', requirePermission('resource', 'read'), controller.getAll);
router.patch('/:id', validateId(), requirePermission('resource', 'update'), controller.update);
router.delete('/:id', validateId(), requirePermission('resource', 'delete'), controller.delete);
export default router;
```

### Controller Pattern
Thin controllers: validate input (Zod), extract `tenantId` from `req.user`, delegate to service, return `sendSuccess()`.

### Service Pattern
Services accept `tenantId` as explicit parameter. All Prisma queries include `where: { tenantId }`. Services may call `getIO()` to emit Socket.IO events. Services throw `ApiError` subclasses on failure.

---

## Design Principles

1. **Tenant isolation is non-negotiable** — Every database query MUST include `tenantId`. No exceptions. Cross-tenant access is a security incident.
2. **Thin controllers, fat services** — Controllers handle HTTP concerns (request parsing, response formatting). Business logic lives in services.
3. **Security by default** — HttpOnly cookies, explicit CORS origins, CSRF headers, prototype pollution prevention, rate limiting, HMAC on webhooks. No security shortcuts.
4. **Feature flags gate modules** — Optional features (KDS, stock, delivery, fiscal) are gated by TenantConfig flags. Both frontend (RouteGuard) and backend (featureFlags.service) enforce them.
5. **Real-time via tenant-scoped rooms** — All Socket.IO events are emitted to rooms prefixed with `tenant:{id}:`. Direct room joins are rejected; clients use specific handlers (`join:kitchen`, `join:table`).
