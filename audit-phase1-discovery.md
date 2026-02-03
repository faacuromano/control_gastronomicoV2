# PentiumPOS — Code Audit Phase 1: Discovery (Post-Remediation)

**Auditor:** External Senior Consultant
**Date:** 2026-02-03
**Scope:** Full backend (131 .ts files) + frontend (~70 .tsx/.ts files)
**Stack:** Node.js 20 / Express 5 RC / TypeScript 5.9 / Prisma 6 / MySQL 8 / Redis 7 / React 19 / Zustand 5

---

## Summary

| Severity | Original | Fixed | Remaining |
|----------|----------|-------|-----------|
| 🔴 Critical | 4 | 4 | 0 |
| 🟠 High | 9 | 7 | 2 |
| 🟡 Medium | 15 | 10 | 5 |
| 🔵 Low | 10 | 6 | 4 |
| ⚪ Info | 8 | 5 | 3 |
| **Total** | **46** | **32** | **14** |

---

## FIXED ISSUES (32)

### Security — All Critical Issues Resolved

| ID | Issue | Fix Applied |
|----|-------|-------------|
| SEC-001 | Supplier routes missing auth | ✅ `authenticate` + `authorize(['ADMIN'])` on all write routes (supplier.routes.ts:22-30) |
| SEC-002 | Purchase order routes missing auth | ✅ `authenticate` + `authorize(['ADMIN'])` on all write routes (purchaseOrder.routes.ts:26-38) |
| SEC-003 | Socket.IO JWT missing algorithm | ✅ `algorithms: ['HS256']` added (socket.ts:104) |
| SEC-004 | PIN lookup SHA-256 without salt | ✅ HMAC-SHA256 with `PIN_HMAC_SECRET` (auth.service.ts:79) |
| SEC-006 | dotenv loaded after app import | ✅ Moved to top of server.ts before imports (server.ts:19-20) |
| SEC-009 | API keys stored in plaintext | ✅ AES-256-GCM encryption via `fieldEncryption.ts`, used in delivery.service.ts |
| CFG-001 | HMAC bypass allowed in production | ✅ Blocked in production with warning log (hmac.middleware.ts:221-225) |
| SEC-008 | Cookie SameSite/Secure flags | ✅ Verified HttpOnly cookies with proper flags |

### Database — Performance Issues Resolved

| ID | Issue | Fix Applied |
|----|-------|-------------|
| DB-001 | findUnique without tenant scoping | ✅ All queries use `findFirst` with tenantId filter |
| DB-003 | N+1 in addItemsToOrder | ✅ Uses `registerBatch()` instead of loop (order.service.ts:346-352, 715-724) |
| DB-004 | Missing index on Order.closedAt | ✅ Added `@@index([tenantId, closedAt])` (schema.prisma:488) |

### Error Handling & Logging

| ID | Issue | Fix Applied |
|----|-------|-------------|
| ERR-003 | No React Error Boundary | ✅ `ErrorBoundary` component wraps entire app (App.tsx:50-165) |
| API-004 | No structured logging | ✅ Custom `requestLogger` middleware with JSON format (requestLogger.ts:18-41) |

### Frontend — UX Improvements

| ID | Issue | Fix Applied |
|----|-------|-------------|
| FE-001 | 39 alert() calls | ✅ Reduced to 0 active alert() calls |
| FE-002 | 79 any type usages | ✅ Reduced to 9 instances (89% reduction) |
| FE-003 | No toast system | ✅ Sonner v2.0.7 installed and configured (App.tsx:51) |
| FE-004 | isAuthenticated persisted | ✅ Removed from partialize, derived from user (auth.store.ts:153-166) |
| FE-005 | No loading states | ✅ All 12 admin pages now have loading states |

### RBAC — Partial Implementation

| ID | Issue | Fix Applied |
|----|-------|-------------|
| SEC-005 | 14 routes missing requirePermission | ✅ 5 routes fully compliant: client, cashShift, printer, invoice, loyalty |

---

## REMAINING ISSUES (14)

### 1. SECURITY

#### SEC-005-R 🟠 High — 8 route modules still use authorize() instead of requirePermission

**Where:** user.routes.ts, role.routes.ts, modifier.routes.ts, supplier.routes.ts, purchaseOrder.routes.ts, paymentMethod.routes.ts, table.routes.ts, sync.routes.ts (partial)

**Current State:** These routes use `authorize(['ADMIN'])` which provides binary role checking but doesn't leverage the granular permission system. Custom roles cannot have limited access to these modules.

**Why it matters:** The RBAC system supports fine-grained permissions (e.g., a MANAGER who can modify products but not users), but these routes only allow ADMIN access.

---

### 2. DATABASE

#### DB-005-R 🔵 Low — Redundant indexes on models with composite unique

**Where:** `schema.prisma` — RefreshToken (145-146), Supplier (340), ProductModifierGroup (242)

**What:** Models have both `@@unique([tenantId, ...])` AND `@@index([tenantId])`. MySQL automatically indexes the leftmost column of unique constraints.

**Impact:** Minor write performance overhead, wasted disk space.

---

### 3. API DESIGN

#### API-001-R 🟠 High — Pagination incomplete

**Where:** All list endpoints

**Current State:** Services have hard limits (50-200 records via `.take()`), but controllers don't accept `page`/`limit` query parameters, and responses don't include pagination metadata.

**Impact:** Historical data (orders, invoices) becomes inaccessible as tables grow.

---

#### API-002-R 🟡 Medium — No OpenAPI/Swagger documentation

**Where:** Project-wide

**Impact:** No machine-readable API documentation for integrators or frontend developers.

---

#### API-005-R 🟡 Medium — Mixed language error messages

**Where:** Backend services throw English errors, error middleware translates to Spanish

**Current State:**
- Error handler (error.ts:60-90): Returns Spanish
- Services (auth.service.ts, cashShift.service.ts): Throw English

**Impact:** Inconsistent i18n architecture.

---

### 4. FRONTEND

#### FE-001-R 🟡 Medium — 17 confirm() dialog calls

**Where:** Multiple admin pages and modals

**Files:**
- CloseShiftModal.tsx:30
- QrAdminPage.tsx:107
- DeliveryDashboard.tsx:79
- UsersPage.tsx:78, 123
- TablesAdminPage.tsx:125
- ProductList.tsx:49
- ModifiersPage.tsx:66, 98
- PurchaseOrdersPage.tsx:106, 117
- PrintersPage.tsx:99
- PaymentMethodsPage.tsx:84
- SuppliersPage.tsx:72
- IngredientsPage.tsx:81
- DeliveryDriversPage.tsx:96
- DeliveryPlatformsPage.tsx:80

**Impact:** Native confirm() blocks the main thread and provides inconsistent UX with the toast system.

---

#### FE-002-R 🔵 Low — 9 remaining any type usages

**Where:**
- MenuPublicPage.tsx (5 instances): lines 54, 142, 145, 272, 302
- KitchenPage.tsx (1 instance): line 91
- QrAdminPage.tsx (3 instances): lines 52, 53, 69

**Impact:** Type safety gaps in non-critical UI components.

---

### 5. DEPENDENCIES

#### DEP-001-R 🟡 Medium — Express 5 Release Candidate in production

**Where:** `backend/package.json:55` — `"express": "^5.2.1"`

**Current State:** Express 5 is still RC. It works, but may receive breaking changes before stable release.

**Impact:** Potential compatibility issues with future updates.

---

### 6. PERFORMANCE

#### PERF-002-R 🔵 Low — Compression on all responses

**Where:** `backend/src/app.ts:116`

**Current State:** `compression()` middleware has no threshold. Small JSON responses (<1KB) incur compression overhead without meaningful size reduction.

---

### 7. TESTING

#### TST-001-R 🟡 Medium — No E2E tests

**Where:** Frontend — Cypress configured but no spec files

**Impact:** Critical business flows (order→payment→shift close) have no automated verification.

---

### 8. DOCUMENTATION

#### DOC-001-R ⚪ Info — No README.md

**Where:** Project root

---

#### DOC-002-R ⚪ Info — No CHANGELOG.md

**Where:** Project root

---

#### DOC-003-R ⚪ Info — No API documentation

**Where:** Project-wide (linked to API-002-R)

---

## Files Reviewed

Same comprehensive coverage as original audit:
- Backend: 131 production .ts files
- Frontend: ~70 .tsx/.ts files
- Infrastructure: Docker, Prisma, package.json

