# IMPLEMENTATION PLAN
## Generated: 2026-02-06 | Based on: ARCHITECTURE.md + PROJECT_STATUS.md
## Total Sprints: 10 (first batch — replan after Sprint 10)

## Sprint Dependency Graph
```
Sprint 1 (Validation Security) → Sprint 2 (Core Tests)
Sprint 2 → Sprint 3 (Invoicing FE) ─┐
Sprint 2 → Sprint 4 (Analytics)  ───┤→ Sprint 7 (Delivery Webhooks)
Sprint 2 → Sprint 5 (Audit FE)  ────┘
Sprint 1 → Sprint 6 (Remaining Validation: Auth, KDS Station)
Sprint 5 → Sprint 8 (Client/Loyalty)
Sprint 3 → Sprint 9 (Sync/Offline)
Sprint 4 → Sprint 10 (Discounts Rule Engine)
```

---

### Sprint 1: Input Validation Hardening (Batch 1)
**Module(s):** Menu/Catalog, Printing, Tables
**Focus:** Security — Backend

#### Task 1.1: Add Zod validation to category controller
- **Module:** Menu/Catalog
- **Type:** Security
- **Input contract:** `req.body` from POST/PUT requests
- **Output contract:** Validated `{ name, printerId?, kdsStationId? }` passed to `categoryService`
- **Files to modify:** `backend/src/controllers/category.controller.ts`
- **Acceptance criteria:**
  - [ ] `createCategory` uses Zod `.strict()` schema instead of `...req.body` spread
  - [ ] `updateCategory` uses Zod `.strict()` schema instead of raw `req.body`
  - [ ] `tsc --noEmit` passes
  - [ ] Extra fields in request body are rejected (mass assignment prevented)

#### Task 1.2: Add Zod validation to product controller
- **Module:** Menu/Catalog
- **Type:** Security
- **Input contract:** `req.body` from POST/PUT requests
- **Output contract:** Validated product data matching `productService.createProduct()` / `updateProduct()` signatures
- **Files to modify:** `backend/src/controllers/product.controller.ts`
- **Acceptance criteria:**
  - [ ] `createProduct` uses Zod `.strict()` schema instead of `...req.body` spread
  - [ ] `updateProduct` uses Zod `.strict()` schema instead of raw `req.body`
  - [ ] Schema covers: `name, price, categoryId, productType, isStockable, description?, image?, ingredients[], modifierGroupIds[], kdsStationId?`
  - [ ] `tsc --noEmit` passes

#### Task 1.3: Add Zod validation to printer and kdsStation controllers
- **Module:** Printing, Kitchen (KDS)
- **Type:** Security
- **Input contract:** `req.body` from POST/PUT requests
- **Output contract:** Validated data matching `printerService` and `kdsStationService` signatures
- **Files to modify:** `backend/src/controllers/printer.controller.ts`, `backend/src/controllers/kdsStation.controller.ts`
- **Acceptance criteria:**
  - [ ] Printer create/update use Zod `.strict()` schemas for `{ name, connectionType, ipAddress?, windowsName? }`
  - [ ] KDS station create/update use Zod `.strict()` schemas for `{ name, code, sortOrder?, isActive?, isDefault? }`
  - [ ] `tsc --noEmit` passes
  - [ ] Extra fields rejected

#### Sprint 1 Verification:
- [ ] All output contracts satisfied (validated types match service signatures)
- [ ] No raw `req.body` spread in category, product, printer, kdsStation controllers
- [ ] `tsc --noEmit` passes with 0 errors
- [ ] Mass assignment attack vector eliminated for these endpoints

---

### Sprint 2: Input Validation Hardening (Batch 2) + Remaining Gaps
**Module(s):** Authentication, Tables, Orders, QR Menu
**Focus:** Security — Backend

#### Task 2.1: Add Zod validation to auth controller
- **Module:** Authentication
- **Type:** Security
- **Input contract:** `req.body` from login/register/signup endpoints
- **Output contract:** Validated auth data matching `auth.service.ts` function signatures
- **Files to modify:** `backend/src/controllers/auth.controller.ts`
- **Acceptance criteria:**
  - [ ] `loginWithPin` validates `{ pin: z.string().length(6), tenantId: z.number().int().positive() }`
  - [ ] `loginWithPassword` validates `{ email, password, tenantId }`
  - [ ] `registerUser` validates `{ name, email?, pin?, roleId }`
  - [ ] `registerTenant` validates `{ businessName, name, email, password, phone? }`
  - [ ] `tsc --noEmit` passes

#### Task 2.2: Add Zod validation to remaining raw req.body gaps
- **Module:** Tables, Orders, QR Menu
- **Type:** Security
- **Input contract:** Various `req.body` access points without Zod
- **Output contract:** All remaining raw `req.body` references wrapped in Zod schemas
- **Files to modify:** `backend/src/controllers/table.controller.ts` (updatePosition, batchUpdatePositions, openTable pax), `backend/src/controllers/order.controller.ts` (setDriver), `backend/src/controllers/qr.controller.ts` (createQrCode tableId)
- **Acceptance criteria:**
  - [ ] `table.updatePosition` validates `{ x, y }` with Zod
  - [ ] `table.batchUpdatePositions` validates `{ updates: [{id, x, y}] }` with Zod
  - [ ] `table.openTable` validates `{ pax }` with Zod
  - [ ] `order.setDriver` validates `{ driverId }` with Zod
  - [ ] `qr.createQrCode` validates `{ tableId? }` with Zod
  - [ ] `tsc --noEmit` passes
  - [ ] TD-001 fully resolved (zero raw req.body in any controller)

#### Sprint 2 Verification:
- [ ] `grep -r "req\.body" backend/src/controllers/` shows ONLY `.parse(req.body)` or `.safeParse(req.body)` patterns
- [ ] `tsc --noEmit` passes
- [ ] TD-001 can be marked RESOLVED in PROJECT_STATUS.md

---

### Sprint 3: Core Service Unit Tests (Batch 1)
**Module(s):** Orders/POS, Authentication
**Focus:** Testing — Backend

#### Task 3.1: Unit tests for order.service.ts
- **Module:** Orders/POS
- **Type:** Test
- **Input contract:** Test data mimicking controller inputs: `createOrder({ items, tableId, tenantId, ... })`
- **Output contract:** Jest test file with mocked Prisma, ≥80% function coverage of order.service.ts
- **Files to create:** `backend/tests/unit/services/order.service.test.ts`
- **Files to read:** `backend/src/services/order.service.ts`, `backend/src/services/orderItem.service.ts`
- **Acceptance criteria:**
  - [ ] Tests for `createOrder`, `getOrders`, `getOrderById`
  - [ ] Tests for stock deduction on order creation (with enableStock flag)
  - [ ] Tests for order number generation (businessDate + sequence)
  - [ ] Prisma mocked (no real DB calls)
  - [ ] `npm run test:unit` passes

#### Task 3.2: Unit tests for auth.service.ts
- **Module:** Authentication
- **Type:** Test
- **Input contract:** Test data for login, register, refresh
- **Output contract:** Jest test file covering auth flows, ≥80% function coverage
- **Files to create:** `backend/tests/unit/services/auth.service.test.ts`
- **Files to read:** `backend/src/services/auth.service.ts`
- **Acceptance criteria:**
  - [ ] Tests for `loginWithPin` (success, wrong PIN, locked account)
  - [ ] Tests for `loginWithPassword` (success, wrong password)
  - [ ] Tests for `register` (success, duplicate email)
  - [ ] Tests for `refreshToken` (success, expired, reuse detection)
  - [ ] `npm run test:unit` passes

#### Sprint 3 Verification:
- [ ] Both test files pass with `npm run test:unit`
- [ ] No test depends on external services (DB, Redis)
- [ ] Coverage of core business logic paths ≥ 80%

---

### Sprint 4: Invoicing Frontend
**Module(s):** Invoicing
**Focus:** Frontend

#### Task 4.1: Invoice list page with generation flow
- **Module:** Invoicing
- **Type:** Feature
- **Input contract:** `invoiceService.getInvoices()` → `GET /api/v1/invoices` (already exists in backend)
- **Output contract:** Admin page at `/admin/invoices` displaying invoice list with filters (date range, type), and generate button from order
- **Files to create:** `frontend/src/modules/admin/pages/InvoicesPage.tsx`
- **Files to modify:** `frontend/src/App.tsx` (add route), `frontend/src/modules/admin/AdminLayout.tsx` (add nav link)
- **Acceptance criteria:**
  - [ ] Page renders invoice list with columns: number, date, type, client, total
  - [ ] Filter by date range and invoice type
  - [ ] "Generate Invoice" action linked from order detail
  - [ ] Lazy-loaded component, RouteGuard with `permission: { resource: 'invoices', action: 'read' }`
  - [ ] Uses existing `invoiceService.ts` API calls
  - [ ] `npm run build` passes

#### Task 4.2: Invoice detail/receipt view
- **Module:** Invoicing
- **Type:** Feature
- **Output contract:** Invoice detail modal/page showing full invoice data with print action
- **Files to create:** `frontend/src/modules/admin/pages/components/InvoiceDetail.tsx`
- **Acceptance criteria:**
  - [ ] Shows invoice header (number, date, type), client info, items, subtotal/tax/total
  - [ ] Print button triggers browser print dialog
  - [ ] Accessible from invoice list and from order detail
  - [ ] `npm run build` passes

#### Sprint 4 Verification:
- [ ] Invoicing pages render without errors
- [ ] Navigation to/from invoice pages works
- [ ] `npm run build` passes with 0 errors

---

### Sprint 5: Analytics Dashboard Completion
**Module(s):** Analytics
**Focus:** Backend + Frontend

#### Task 5.1: Complete analytics backend reports
- **Module:** Analytics
- **Type:** Feature
- **Files to modify:** `backend/src/services/analytics.service.ts`, `backend/src/controllers/analytics.controller.ts`
- **Acceptance criteria:**
  - [ ] Daily/weekly/monthly sales summary endpoint
  - [ ] Top products by revenue endpoint
  - [ ] Payment method breakdown endpoint
  - [ ] All queries scoped by tenantId and date range
  - [ ] `tsc --noEmit` passes

#### Task 5.2: Complete analytics frontend dashboard
- **Module:** Analytics
- **Type:** Feature
- **Files to modify:** `frontend/src/modules/admin/pages/DashboardPage.tsx`
- **Acceptance criteria:**
  - [ ] Sales summary cards (today, week, month)
  - [ ] Top products list
  - [ ] Payment method breakdown
  - [ ] Date range picker for filtering
  - [ ] `npm run build` passes

#### Sprint 5 Verification:
- [ ] Dashboard loads with real data
- [ ] All analytics endpoints return correct data structure
- [ ] `tsc --noEmit` and `npm run build` pass

---

### Sprint 6: Audit Log Frontend
**Module(s):** Audit
**Focus:** Frontend

#### Task 6.1: Audit log viewer page
- **Module:** Audit
- **Type:** Feature
- **Input contract:** `GET /api/v1/audit-logs` (needs backend endpoint if not exists)
- **Output contract:** Admin page at `/admin/audit-logs` displaying paginated audit entries
- **Files to create:** `frontend/src/modules/admin/pages/AuditLogPage.tsx`, `frontend/src/services/auditService.ts`
- **Files to modify:** `frontend/src/App.tsx`, `frontend/src/modules/admin/AdminLayout.tsx`
- **Files to potentially create:** `backend/src/routes/audit.routes.ts`, `backend/src/controllers/audit.controller.ts` (if not exists)
- **Acceptance criteria:**
  - [ ] Backend endpoint for listing audit logs with pagination and filters
  - [ ] Frontend page with table: timestamp, user, action, entity, details
  - [ ] Filters: action type, user, date range, entity
  - [ ] Pagination
  - [ ] RouteGuard with admin permission
  - [ ] `npm run build` passes

#### Sprint 6 Verification:
- [ ] Audit log page renders paginated entries
- [ ] Filters work correctly
- [ ] `tsc --noEmit` and `npm run build` pass

---

### Sprint 7: Delivery Webhook Completion
**Module(s):** Delivery
**Focus:** Backend

#### Task 7.1: Complete Rappi and PedidosYa webhook handlers
- **Module:** Delivery
- **Type:** Feature
- **Files to modify:** `backend/src/integrations/delivery/` adapter files
- **Acceptance criteria:**
  - [ ] Rappi webhook: order creation, status updates, cancellation
  - [ ] PedidosYa webhook: order creation, status updates, cancellation
  - [ ] HMAC signature verification on all webhook endpoints
  - [ ] BullMQ job processing for each webhook type
  - [ ] Error handling with retry logic
  - [ ] `tsc --noEmit` passes

#### Sprint 7 Verification:
- [ ] Webhook handlers process all expected event types
- [ ] HMAC verification present on all webhook routes
- [ ] `tsc --noEmit` passes

---

### Sprint 8: Sync / Offline Improvements
**Module(s):** Sync/Offline
**Focus:** Frontend

#### Task 8.1: Conflict resolution strategy
- **Module:** Sync/Offline
- **Type:** Feature/Debt
- **Files to modify:** `frontend/src/lib/syncManager.ts`
- **Acceptance criteria:**
  - [ ] Server-wins conflict resolution for catalog data (products, categories)
  - [ ] Last-write-wins with timestamp comparison for pending operations
  - [ ] User notification when conflicts are resolved
  - [ ] Failed sync retry with exponential backoff
  - [ ] `npm run build` passes

#### Sprint 8 Verification:
- [ ] Sync manager handles network errors gracefully
- [ ] Conflict resolution works for common scenarios
- [ ] `npm run build` passes

---

### Sprint 9: Client / Loyalty Completion
**Module(s):** Clients/Loyalty
**Focus:** Backend + Frontend

#### Task 9.1: Complete loyalty points system
- **Module:** Clients/Loyalty
- **Type:** Feature
- **Files to modify:** `backend/src/services/loyalty.service.ts`, `backend/src/services/client.service.ts`
- **Acceptance criteria:**
  - [ ] Points earned on order completion (configurable rate)
  - [ ] Points redemption at checkout
  - [ ] Points history tracking
  - [ ] `tsc --noEmit` passes

#### Task 9.2: Complete client frontend
- **Module:** Clients/Loyalty
- **Type:** Feature
- **Files to modify:** `frontend/src/modules/admin/pages/ClientsPage.tsx`
- **Acceptance criteria:**
  - [ ] Client detail view with order history, points balance, wallet balance
  - [ ] Points/wallet operations UI
  - [ ] Client search and filter
  - [ ] `npm run build` passes

#### Sprint 9 Verification:
- [ ] Loyalty system end-to-end: earn points → view balance → redeem
- [ ] `tsc --noEmit` and `npm run build` pass

---

### Sprint 10: Discount Rule Engine
**Module(s):** Discounts
**Focus:** Backend + Frontend

#### Task 10.1: Discount rule engine backend
- **Module:** Discounts
- **Type:** Feature
- **Files to modify:** `backend/src/services/discount.service.ts`
- **Acceptance criteria:**
  - [ ] Discount types: percentage, fixed amount, buy-X-get-Y
  - [ ] Discount conditions: minimum order amount, specific products/categories, time-based
  - [ ] Discount stacking rules (max one automatic + one manual)
  - [ ] `tsc --noEmit` passes

#### Task 10.2: Discount management frontend
- **Module:** Discounts
- **Type:** Feature
- **Files to create:** `frontend/src/modules/admin/pages/DiscountsPage.tsx`
- **Acceptance criteria:**
  - [ ] Discount CRUD page
  - [ ] Discount application at POS checkout
  - [ ] `npm run build` passes

#### Sprint 10 Verification:
- [ ] Discount rules apply correctly at checkout
- [ ] `tsc --noEmit` and `npm run build` pass

---

## Remaining Work (post-Sprint 10, to be replanned)

After Sprint 10, the following items still require work:
- Inventory module: PO workflow completion (~10% gap)
- QR Menu: Frontend completion (~10% gap)
- Config/Settings: Frontend minor gaps (~5%)
- Bulk Pricing: Frontend completion (~15%)
- Printing: Additional coverage (~10%)
- Fiscal integration (AFIP) — LOW priority, country-specific
- Additional unit tests for remaining services
- Integration tests for delivery module
- E2E tests for new frontend pages
