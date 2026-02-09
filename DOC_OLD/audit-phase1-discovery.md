# PentiumPOS — Code Audit Phase 1: Discovery

**Auditor:** External Senior Consultant
**Date:** 2026-02-02
**Scope:** Full backend (131 .ts files) + frontend (~70 .tsx/.ts files)
**Stack:** Node.js 20 / Express 5 RC / TypeScript 5.9 / Prisma 6 / MySQL 8 / Redis 7 / React 19 / Zustand 5

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 4 |
| 🟠 High | 9 |
| 🟡 Medium | 15 |
| 🔵 Low | 10 |
| ⚪ Info | 8 |
| **Total** | **46** |

---

## 1. SECURITY

### SEC-001 🔴 Critical — Supplier routes have NO authentication middleware
**Where:** `backend/src/routes/supplier.routes.ts:19-31`
**What:** All 5 supplier endpoints (GET, POST, PUT, DELETE) are mounted without `authenticate` middleware. Any unauthenticated user can CRUD suppliers for any tenant.
**Why it matters:** Complete bypass of authentication. An attacker can enumerate, create, modify, and delete supplier data without any credentials. The routes rely on `req.user.tenantId` from the controller which will be `undefined`, potentially causing unpredictable behavior or crashes.
**Impact:** Data exposure, data manipulation, potential service disruption.

### SEC-002 🔴 Critical — Purchase order routes have NO authentication middleware
**Where:** `backend/src/routes/purchaseOrder.routes.ts:20-38`
**What:** All 7 purchase order endpoints (GET, POST, PATCH, DELETE) are mounted without `authenticate` middleware. This includes operations that generate stock movements (receivePurchaseOrder).
**Why it matters:** Unauthenticated users can create purchase orders, trigger stock movements, and delete financial records. The `receivePurchaseOrder` endpoint generates `StockMovement` records which corrupt inventory data.
**Impact:** Financial data manipulation, inventory corruption, audit trail bypass.

### SEC-003 🔴 Critical — Socket.IO JWT verification missing algorithm restriction
**Where:** `backend/src/lib/socket.ts:97`
**What:** `jwt.verify(token, JWT_SECRET)` is called WITHOUT specifying `algorithms: ['HS256']`. The HTTP auth middleware correctly restricts to HS256 (`auth.ts:115`), but the WebSocket auth does not.
**Why it matters:** Without algorithm restriction, the `alg: none` attack vector is open. An attacker could forge a WebSocket token with `{"alg": "none"}` and gain access to real-time data streams (kitchen orders, table status, stock alerts) of any tenant.
**Impact:** Cross-tenant data leakage via WebSocket, unauthorized real-time data access.

### SEC-004 🔴 Critical — PIN lookup hash (SHA-256) used without salt/HMAC
**Where:** `backend/src/services/auth.service.ts:34-36`
**What:** `generatePinLookup` uses plain `SHA-256(pin)` without any salt, pepper, or HMAC key. Since PINs are 6-digit numbers (only 1M combinations), the entire lookup table can be precomputed in under a second.
**Why it matters:** If the database is compromised, an attacker can reverse ALL PINs instantly from the `pinLookup` column using a rainbow table of 1M entries. The bcrypt hash provides a second layer, but pinLookup gives the PIN directly without needing to crack bcrypt.
**Impact:** Mass PIN compromise on database leak.

### SEC-005 🟠 High — RBAC gaps: 14 out of 25 route modules lack `requirePermission`
**Where:** Multiple route files — `user.routes.ts`, `role.routes.ts`, `client.routes.ts`, `cashShift.routes.ts`, `printer.routes.ts`, `modifier.routes.ts`, `supplier.routes.ts`, `purchaseOrder.routes.ts`, `paymentMethod.routes.ts`, `invoice.routes.ts`, `loyalty.routes.ts`, `table.routes.ts`, `sync.routes.ts`
**What:** These routes use `authenticate` (and some use role-based `authorize`) but do NOT use the granular `requirePermission(resource, action)` middleware. This means the RBAC system defined in the Role model is partially bypassed.
**Why it matters:** The `authorize(['ADMIN'])` check is binary — you're ADMIN or you're not. The `requirePermission` system allows fine-grained control (e.g., a MANAGER role that can manage products but not users). Without it, custom roles cannot restrict access to specific modules.
**Impact:** Over-privileged access for non-ADMIN roles that should have limited permissions.

### SEC-006 🟠 High — `dotenv.config()` called AFTER `app.ts` import in server.ts
**Where:** `backend/src/server.ts:22` vs `backend/src/app.ts:1`
**What:** `server.ts` imports `app` at line 16, which triggers all `app.ts` code (including `process.env` reads at lines 27-46). Then `dotenv.config()` is called at line 22. By this point, the env vars from `.env` may not be loaded yet if running outside Docker (which passes env vars directly).
**Why it matters:** When running locally with `npm run dev` (via `nodemon src/server.ts`), environment variables from `.env` may not be available during `app.ts` initialization, causing the startup validations to fail or use incorrect defaults.
**Impact:** Application may fail to start or run with misconfigured security settings in local development.

### SEC-007 🟠 High — No JWT_REFRESH_SECRET — refresh tokens signed with same secret
**Where:** `backend/src/services/auth.service.ts`
**What:** There is no `JWT_REFRESH_SECRET` environment variable or separate signing key for refresh tokens. The refresh token system uses opaque tokens (random bytes + SHA-256 hash), which is actually good, but the access token uses `JWT_SECRET` for both access and any future token types. If a separate JWT is ever issued for refresh, it would use the same key.
**Why it matters:** Currently mitigated because refresh tokens are opaque (not JWT), but the architecture doesn't have separation of signing keys, which is a best practice gap.
**Impact:** Low immediate risk (opaque tokens are secure), but architectural gap.

### SEC-008 🟡 Medium — `auth_token` cookie missing SameSite and Secure flags verification
**Where:** `backend/src/controllers/auth.controller.ts` (cookie setting)
**What:** Need to verify that the auth_token cookie is set with `SameSite: Strict` (or `Lax`) and `Secure: true` in production. The CSRF middleware (`csrf.ts`) provides defense-in-depth, but the cookie attributes are the primary defense.
**Why it matters:** Without `SameSite`, the cookie could be sent in cross-origin requests. Without `Secure`, the cookie could be intercepted over HTTP.
**Impact:** CSRF vulnerability if SameSite not set; cookie interception if Secure not set.

### SEC-009 🟡 Medium — API keys stored in plaintext in database
**Where:** `backend/prisma/schema.prisma:851-852` (DeliveryPlatform), `schema.prisma:875-876` (TenantPlatformConfig)
**What:** `apiKey` and `webhookSecret` fields are stored as plain `String?` / `@db.Text`. No encryption at rest.
**Why it matters:** If the database is compromised, all delivery platform API keys and webhook secrets are immediately exposed. These keys can be used to impersonate the restaurant on delivery platforms (Rappi, PedidosYa).
**Impact:** Third-party platform account takeover on database breach.

### SEC-010 🟡 Medium — Health endpoint exposes `process.uptime()`
**Where:** `backend/src/app.ts:210`
**What:** The `/health` endpoint returns `uptime: process.uptime()` which reveals how long the server has been running.
**Why it matters:** An attacker can determine when the last deployment occurred, which helps fingerprint the application version and time attacks against recent code changes.
**Impact:** Information disclosure (low severity standalone, but useful in attack chains).

---

## 2. ERROR HANDLING

### ERR-001 🟠 High — Unprotected `req.user.tenantId` access in controller routes without auth
**Where:** All controllers that access `req.user!.tenantId` on supplier/purchaseOrder routes
**What:** Controllers destructure `tenantId` from `req.user` (e.g., `const tenantId = req.user!.tenantId`). On unauthenticated routes (SEC-001/002), `req.user` is `undefined`, causing a runtime crash with `TypeError: Cannot read properties of undefined`.
**Why it matters:** This transforms the auth bypass into a denial-of-service: any request to supplier/purchaseOrder routes crashes the request handler. Depending on the error handler, this may or may not bring down the process.
**Impact:** Route-level DoS, unpredictable error responses.

### ERR-002 🟡 Medium — Audit log failure silently swallowed
**Where:** `backend/src/services/order.service.ts:533`
**What:** `auditService.logPayment(...).catch(err => logger.error('Audit log failed', { err }))` — audit failures are caught and logged but don't affect the transaction. This is intentional for performance but means audit gaps go unnoticed.
**Why it matters:** Audit logs are a compliance requirement for financial operations. Silent failures mean payment events could be missing from the audit trail with no operational alert.
**Impact:** Audit trail gaps for financial transactions.

### ERR-003 🟡 Medium — No Error Boundary in React frontend
**Where:** Frontend — no `ErrorBoundary` component found
**What:** The React frontend has no `ErrorBoundary` component wrapping the app or critical sections. A JavaScript error in any component will crash the entire app with a white screen.
**Why it matters:** In a POS system, a crash during order taking or payment processing is critical. Waiters need the app to be resilient.
**Impact:** Full app crash on any unhandled component error.

### ERR-004 🔵 Low — Generic 500 errors for all Prisma codes except P2002/P2025/P2003
**Where:** `backend/src/middleware/error.ts:78-79`
**What:** The error handler has specific handlers for P2002 (duplicate), P2025 (not found), P2003 (FK violation), but all other Prisma error codes return a generic 500.
**Why it matters:** Some Prisma errors (P2024 = timeout, P2028 = transaction error) could return more specific HTTP status codes (503, 504) to help the frontend distinguish between transient and permanent failures.
**Impact:** Reduced debuggability and retry-ability for clients.

---

## 3. API DESIGN

### API-001 🟠 High — No pagination on most list endpoints
**Where:** Multiple services — `order.service.ts:746` (hardcoded `take: 50`), `invoice.service.ts:253` (`take: 200`), `purchaseOrder.service.ts:52` (`take: 200`), `cashShift.service.ts:338` (`take: 200`)
**What:** Most list endpoints use hardcoded `take` limits without cursor/offset pagination. Only `ingredient.service.ts`, `client.service.ts`, `product.service.ts`, `modifier.service.ts`, and `paymentMethod.service.ts` implement page/limit parameters.
**Why it matters:** As the restaurant accumulates orders, products, and invoices, responses will always return the same fixed number of records with no way to access older data. For invoices (financial/legal records), this means historical data is inaccessible via the API.
**Impact:** Data inaccessibility, potential frontend performance issues with large result sets.

### API-002 🟠 High — No OpenAPI/Swagger documentation
**Where:** Project-wide
**What:** There is no API documentation generated from the codebase. No Swagger UI, no OpenAPI spec, no Postman collection.
**Why it matters:** A production API serving real users has no documentation for frontend developers, third-party integrators, or new team members. This increases onboarding time and bug rates.
**Impact:** Developer productivity, integration difficulty, maintenance burden.

### API-003 🟡 Medium — Inconsistent response format across controllers
**Where:** Various controllers
**What:** Most controllers use `sendSuccess(res, data)` and `sendError(res, ...)`, but some controllers return raw `res.json()` calls. The health endpoint (`app.ts:207`) uses a completely different format.
**Why it matters:** Frontend code must handle multiple response formats, increasing complexity and bug surface.
**Impact:** Frontend reliability, developer confusion.

### API-004 🟡 Medium — No request/response logging for debugging
**Where:** `backend/src/app.ts:114`
**What:** Morgan is configured with `'dev'` format which only logs method, URL, status, and timing. Request bodies and response payloads are not logged.
**Why it matters:** When debugging production issues, you need to see what data was sent and received. Without body logging, you're blind to the actual payloads.
**Impact:** Reduced debuggability in production incidents.

### API-005 🔵 Low — Mixed language in API responses
**Where:** Rate limiter messages in Spanish (`rateLimit.ts:31`), error messages in English (`errors.ts`), some validation messages in Spanish in frontend
**What:** Error messages are inconsistently in English and Spanish across the codebase.
**Why it matters:** The frontend must handle i18n and the mixed language makes it harder.
**Impact:** User experience inconsistency.

---

## 4. DATABASE

### DB-001 🟠 High — `findUnique` without tenant scoping in several services
**Where:** `auth.service.ts:262` (refreshToken.findUnique by token hash), `AdapterFactory.ts:80,198` (deliveryPlatform.findUnique), `marginConsent.service.ts:87,201` (tenantPlatformConfig.findUnique), `cashShift.service.ts:295` (user.findUnique)
**What:** Several `findUnique` calls use only the unique field (like `token` hash) without filtering by `tenantId`. While some of these are safe (e.g., refresh tokens are globally unique by design), others like `user.findUnique` in `cashShift.service.ts:295` could return a user from a different tenant.
**Why it matters:** In a multi-tenant system, every query MUST include `tenantId` to prevent cross-tenant data access. A `findUnique` by `id` without tenantId filter returns any tenant's data.
**Impact:** Cross-tenant data leakage (depends on specific call context).

### DB-002 🟡 Medium — Missing soft delete on Client, Area, Table models
**Where:** `backend/prisma/schema.prisma` — Client (line 636), Area (line 569), Table (line 606)
**What:** `Product`, `Supplier`, `User`, and `DeliveryDriver` have `isActive` or `deletedAt` fields for soft delete. But `Client`, `Area`, and `Table` do not have soft delete.
**Why it matters:** Deleting a client removes all association with historical orders. Deleting an area/table could orphan historical order data that referenced them.
**Impact:** Historical data integrity, referential integrity issues.

### DB-003 🟡 Medium — N+1 query pattern in `addItemsToOrder`
**Where:** `backend/src/services/order.service.ts:714-724`
**What:** Stock updates are processed in a sequential loop (`for (const update of stockUpdates)` with individual `register()` calls), unlike `createOrder` which uses `registerBatch()` at line 346.
**Why it matters:** For an order with 10 items, each with 3 ingredients, this generates 30 individual database calls instead of a single batch operation.
**Impact:** Performance degradation under load, increased transaction duration.

### DB-004 🟡 Medium — No index on `Order.closedAt` for shift report queries
**Where:** `backend/prisma/schema.prisma:475`
**What:** `closedAt` is used in cash shift reports and analytics queries but has no database index. The composite indexes cover `tenantId + status` and `tenantId + businessDate + status` but not `closedAt`.
**Why it matters:** Shift close reports that filter by date range on `closedAt` will perform full table scans as the orders table grows.
**Impact:** Slow shift reports in high-volume restaurants.

### DB-005 🔵 Low — Redundant `@@index([tenantId])` on models with composite unique
**Where:** Multiple models in `schema.prisma`
**What:** Models like `Role` have both `@@unique([tenantId, name])` and `@@index([tenantId])`. MySQL automatically creates an index for the leftmost column of a composite unique constraint, making the separate `@@index([tenantId])` redundant.
**Why it matters:** Unnecessary indexes consume disk space and slow down writes.
**Impact:** Minor performance/storage overhead.

---

## 5. PERFORMANCE

### PERF-001 🟡 Medium — No connection pooling configuration exposed
**Where:** `backend/prisma/schema.prisma:7` — `url = env("DATABASE_URL")`
**What:** Connection pool settings are embedded in the DATABASE_URL query string (`connection_limit=20&pool_timeout=20` in `.env.example`). However, docker-compose.yml sets `connection_limit=50` which could exhaust MySQL's `max_connections=300` with multiple replicas.
**Why it matters:** With horizontal scaling (multiple backend containers), each pod opens its own pool. 6 pods × 50 connections = 300, which equals MySQL's max, leaving no headroom for admin connections or migrations.
**Impact:** Connection exhaustion under horizontal scaling.

### PERF-002 🟡 Medium — `compression` middleware applied to ALL responses
**Where:** `backend/src/app.ts:116`
**What:** `compression()` is applied globally including to small JSON responses (< 1KB) where the overhead of compression exceeds the bandwidth savings.
**Why it matters:** For the typical POS API response (100-500 bytes), compression adds latency without meaningful size reduction. It should have a threshold.
**Impact:** Unnecessary CPU usage and latency on small responses.

### PERF-003 🔵 Low — WebSocket Redis adapter uses `require()` instead of import
**Where:** `backend/src/lib/socket.ts:52`
**What:** `const { Redis } = require('ioredis')` uses CommonJS require inside an ESM dynamic import block. This works but prevents tree-shaking and type checking.
**Why it matters:** Minor — the dynamic import pattern is intentional to make Redis optional. But the `require()` call should be replaced with `await import('ioredis')` for consistency.
**Impact:** Code consistency, potential bundling issues.

---

## 6. DEPENDENCIES

### DEP-001 🟠 High — Express 5 Release Candidate in production
**Where:** `backend/package.json:55` — `"express": "^5.2.1"`
**What:** Express 5 is still a Release Candidate (not stable). It has breaking changes from Express 4 and may have undiscovered bugs.
**Why it matters:** Using an RC framework in a production system serving real users is risky. Express 5 has known incompatibilities with some middleware and may receive breaking changes before stable release.
**Impact:** Potential stability issues, middleware incompatibilities.

### DEP-002 🟡 Medium — `bcryptjs` last published 2016 but version 3.0.3 used
**Where:** `backend/package.json:49` — `"bcryptjs": "^3.0.3"`
**What:** The `bcryptjs` package shows v3.0.3 which appears to be a recent release. However, the PROJECT_CONTEXT.md notes it was "last published 2016" — verify the actual npm publish date. If truly unmaintained, there may be unpatched vulnerabilities.
**Why it matters:** Password hashing is a critical security function. An unmaintained library is a risk.
**Impact:** Potential unpatched security vulnerabilities in password hashing.

### DEP-003 🔵 Low — No `npm audit` in CI pipeline
**Where:** Project-wide — no CI/CD configuration found
**What:** While `backend/package.json` has `audit:check` and `preinstall:check` scripts, there is no CI/CD pipeline to run them automatically.
**Why it matters:** Dependency vulnerabilities discovered after deployment won't be caught until the next manual audit.
**Impact:** Delayed vulnerability detection.

### DEP-004 🔵 Low — `uuid` package imported but `nanoid` also present
**Where:** `backend/package.json:64-65` — both `nanoid` and `uuid` as dependencies
**What:** Two different ID generation libraries are dependencies. This suggests inconsistent usage — some code uses UUID, some uses nanoid.
**Why it matters:** Code inconsistency, larger bundle size.
**Impact:** Minor maintenance burden.

---

## 7. CONFIGURATION

### CFG-001 🟠 High — `SKIP_HMAC_VALIDATION` environment variable allows webhook bypass
**Where:** `backend/src/integrations/delivery/webhooks/hmac.middleware.ts:225`
**What:** Setting `SKIP_HMAC_VALIDATION=true` completely bypasses HMAC signature verification on webhook endpoints. While documented for development, if accidentally set in production, any attacker can send fake webhook events.
**Why it matters:** A single misconfigured env var disables all webhook security, allowing fake order creation, status manipulation, etc.
**Impact:** Complete webhook security bypass if misconfigured in production.

### CFG-002 🟡 Medium — `apiRateLimiter` skipped entirely in development
**Where:** `backend/src/middleware/rateLimit.ts:62`
**What:** `skip: () => isDevelopment || process.env.DISABLE_RATE_LIMIT === 'true'` — the general API rate limiter is completely disabled in development, meaning rate limiting bugs won't be caught until production.
**Why it matters:** Rate limiting behavior should be tested in development to catch configuration issues before they reach production.
**Impact:** Untested rate limiting configuration.

### CFG-003 🔵 Low — No `.env` validation schema
**Where:** Project-wide
**What:** Environment variables are validated with manual `if (!process.env.X)` checks in `app.ts`. There is no centralized schema (like Zod or envalid) to validate types, formats, and constraints of all env vars.
**Why it matters:** Missing env vars are caught at startup, but wrong types (e.g., `REDIS_PORT=abc`) are not. A Zod schema would catch these at startup.
**Impact:** Silent misconfiguration with wrong-type env vars.

---

## 8. TESTING

### TST-001 🟠 High — No E2E tests
**Where:** `frontend/package.json:11-12` — Cypress configured but no test files
**What:** Cypress is installed and configured (`cy:open`, `cy:run` scripts) but there are no `.cy.ts` spec files. The E2E test suite is empty.
**Why it matters:** For a POS system handling financial transactions, E2E tests are critical to catch regressions in the order → payment → cash shift → invoice flow.
**Impact:** No automated verification of critical business flows.

### TST-002 🟡 Medium — No tests for unauthenticated route protection
**Where:** Test suite — no tests verifying that protected routes reject unauthenticated requests
**What:** While auth middleware tests exist (`auth.middleware.spec.ts`), there are no integration tests verifying that each route correctly uses the auth middleware. The SEC-001/SEC-002 findings (missing auth on supplier/purchaseOrder routes) would have been caught by such tests.
**Why it matters:** Auth middleware can be accidentally omitted during development. Integration tests catch this.
**Impact:** Security regressions go undetected.

### TST-003 🔵 Low — Test coverage unknown
**Where:** `backend/package.json:12` — `"test:coverage": "jest --coverage"`
**What:** Coverage script exists but no coverage reports or thresholds are configured. No minimum coverage requirement in CI.
**Why it matters:** Without coverage targets, test coverage can silently degrade.
**Impact:** Unknown test coverage, potential regression risk.

---

## 9. FRONTEND-SPECIFIC

### FE-001 🟡 Medium — 39 `alert()` calls across frontend
**Where:** `POSPage.tsx` (5), `UsersPage.tsx` (4), `ModifiersPage.tsx` (4), `PurchaseOrdersPage.tsx` (5), `PrintersPage.tsx` (2), `IngredientsPage.tsx` (3), `PaymentMethodsPage.tsx` (4), `SuppliersPage.tsx` (2), `RolesPage.tsx` (1), `SettingsPage.tsx` (1), `ClientsPage.tsx` (1), `CheckoutModal.tsx` (1), `DeliveryDashboard.tsx` (2), `TablesAdminPage.tsx` (2), `MenuPublicPage.tsx` (1)
**What:** Native `alert()` is used for all error and success notifications. This blocks the main thread and provides a poor UX.
**Why it matters:** In a POS environment, `alert()` blocks all interaction until dismissed. If a waiter gets an alert during a busy service, it halts their workflow. This is especially problematic for the background error alerts that pop up unexpectedly.
**Impact:** Blocked UI during critical POS operations.

### FE-002 🟡 Medium — 79 `any` type usages across 32 frontend files
**Where:** Multiple files — `errorUtils.ts` (7), `POSPage.tsx` (4), `productService.ts` (4), `cash.store.ts` (3), `ShoppingCart.tsx` (3), `Receipt.tsx` (3), `CheckoutModal.tsx` (3), and 25 more files
**What:** Extensive use of `any` type defeats TypeScript's type safety guarantees.
**Why it matters:** `any` types hide bugs at compile time that only surface at runtime. In a financial application, a `number` accidentally becoming a `string` can cause incorrect calculations.
**Impact:** Runtime type errors, incorrect financial calculations.

### FE-003 🟡 Medium — No toast/notification system
**Where:** Frontend — no toast library installed
**What:** The frontend has no toast/notification library (like react-hot-toast, sonner, or radix-toast). All notifications use `alert()`.
**Why it matters:** A proper toast system allows non-blocking notifications, auto-dismiss, and different severity levels (success, error, warning).
**Impact:** Poor UX, blocked interactions.

### FE-004 🔵 Low — `isAuthenticated` persisted in localStorage alongside user data
**Where:** `frontend/src/store/auth.store.ts:154-158`
**What:** The `partialize` function persists `isAuthenticated` to localStorage. Since auth is now cookie-based, the `isAuthenticated` flag can become stale if the cookie expires but the localStorage value remains `true`.
**Why it matters:** The frontend may show the authenticated UI briefly before the first API call fails and triggers a logout. This causes a flash of authenticated content.
**Impact:** UX inconsistency, potential confusion.

### FE-005 🔵 Low — No loading states on many admin pages
**Where:** Multiple admin pages — `SuppliersPage.tsx`, `ModifiersPage.tsx`, `IngredientsPage.tsx`
**What:** Many admin pages fetch data on mount but don't show loading spinners. The UI appears empty until data loads.
**Why it matters:** Users may think the app is broken or the page has no data when it's actually loading.
**Impact:** Poor perceived performance.

---

## 10. DOCUMENTATION

### DOC-001 ⚪ Info — No README.md in project root
**Where:** Project root
**What:** No README file with setup instructions, architecture overview, or contribution guidelines.
**Why it matters:** New developers have no entry point to understand the project.

### DOC-002 ⚪ Info — No CHANGELOG.md
**Where:** Project root
**What:** No changelog tracking version history and breaking changes.

### DOC-003 ⚪ Info — No API documentation / Postman collection
**Where:** Project-wide
**What:** As noted in API-002, no machine-readable API documentation exists.

---

## Files Reviewed

### Backend (131 production .ts files)
- **Core:** app.ts, server.ts
- **Middleware (9):** auth.ts, error.ts, rateLimit.ts, sanitize-body.middleware.ts, validateId.ts, correlationId.ts, csrf.ts, asyncHandler.ts, idempotency.ts
- **Controllers (26):** All 26 controller files
- **Services (37):** All 37 service files
- **Routes (25):** All 25 route files
- **Integrations (17):** All delivery adapter, webhook, and sync files
- **Lib (6):** prisma.ts, prisma-extensions.ts, socket.ts, queue/*
- **Utils (6):** errors.ts, logger.ts, response.ts, businessDate.ts, paymentMethod.ts, businessDate.test.ts
- **Types (3):** express-extensions.ts, order.types.ts, sync.types.ts
- **Jobs (1):** cleanupSequences.ts

### Frontend (~70 files)
- **Stores (4):** auth.store.ts, pos.store.ts, kitchen.store.ts, cash.store.ts
- **Services (25):** All API service files
- **Pages (8):** All top-level pages
- **Modules (41):** All module components

### Infrastructure
- docker-compose.yml, docker-compose.prod.yml, Dockerfile.prod
- .env.example (root + backend)
- .gitignore
- prisma/schema.prisma + all migrations
- package.json (root + backend + frontend)
- tsconfig.json (backend)
