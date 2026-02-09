# PentiumPOS — Code Audit Phase 2: Solutions & Roadmap

**Auditor:** External Senior Consultant
**Date:** 2026-02-02
**Input:** Phase 1 Discovery (46 findings)

---

## Tier 1 — Fix NOW (Critical Security & Reliability)

These must be deployed before any other work. Each is a production risk.

---

### FIX-001: Add authentication to supplier routes (SEC-001)
**Priority:** Immediate | **Effort:** Low | **Risk:** None if done correctly

**Problem:** Supplier routes have zero authentication. Anyone can CRUD suppliers.

**Fix:** Add `authenticate` and `authorize` middleware to `supplier.routes.ts`:

```typescript
// backend/src/routes/supplier.routes.ts
import { Router } from 'express';
import { validateId } from '../middleware/validateId';
import { authenticate, authorize } from '../middleware/auth';
import * as SupplierController from '../controllers/supplier.controller';

const router = Router();

// ALL supplier routes require authentication
router.get('/suppliers', authenticate, SupplierController.getSuppliers);
router.get('/suppliers/:id', authenticate, validateId(), SupplierController.getSupplierById);
router.post('/suppliers', authenticate, authorize(['ADMIN']), SupplierController.createSupplier);
router.put('/suppliers/:id', authenticate, validateId(), authorize(['ADMIN']), SupplierController.updateSupplier);
router.delete('/suppliers/:id', authenticate, validateId(), authorize(['ADMIN']), SupplierController.deleteSupplier);

export default router;
```

**What could break:** Nothing. These routes currently crash because `req.user` is undefined. Adding auth makes them work correctly.

---

### FIX-002: Add authentication to purchase order routes (SEC-002)
**Priority:** Immediate | **Effort:** Low | **Risk:** None

**Fix:** Same pattern as FIX-001:

```typescript
// backend/src/routes/purchaseOrder.routes.ts
import { Router } from 'express';
import { validateId } from '../middleware/validateId';
import { authenticate, authorize } from '../middleware/auth';
import * as PurchaseOrderController from '../controllers/purchaseOrder.controller';

const router = Router();

router.get('/purchase-orders', authenticate, PurchaseOrderController.getPurchaseOrders);
router.get('/purchase-orders/:id', authenticate, validateId(), PurchaseOrderController.getPurchaseOrderById);
router.post('/purchase-orders', authenticate, authorize(['ADMIN']), PurchaseOrderController.createPurchaseOrder);
router.patch('/purchase-orders/:id/status', authenticate, validateId(), authorize(['ADMIN']), PurchaseOrderController.updatePurchaseOrderStatus);
router.post('/purchase-orders/:id/receive', authenticate, validateId(), authorize(['ADMIN']), PurchaseOrderController.receivePurchaseOrder);
router.post('/purchase-orders/:id/cancel', authenticate, validateId(), authorize(['ADMIN']), PurchaseOrderController.cancelPurchaseOrder);
router.delete('/purchase-orders/:id', authenticate, validateId(), authorize(['ADMIN']), PurchaseOrderController.deletePurchaseOrder);

export default router;
```

---

### FIX-003: Add algorithm restriction to Socket.IO JWT verification (SEC-003)
**Priority:** Immediate | **Effort:** Low | **Risk:** None

**Problem:** WebSocket JWT verify doesn't restrict algorithms, enabling `alg: none` attack.

**Fix:** In `backend/src/lib/socket.ts`, line 97, add `algorithms` option:

```typescript
// BEFORE (vulnerable):
const decoded = jwt.verify(token, JWT_SECRET) as { ... };

// AFTER (secure):
const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as { ... };
```

---

### FIX-004: Salt the PIN lookup hash (SEC-004)
**Priority:** Immediate | **Effort:** Medium | **Risk:** Requires data migration

**Problem:** SHA-256 of 6-digit PINs is trivially reversible (only 1M combinations).

**Fix:** Use HMAC-SHA256 with a server-side secret instead of plain SHA-256:

```typescript
// backend/src/services/auth.service.ts
export const generatePinLookup = (pin: string): string => {
    // Use HMAC with JWT_SECRET as key to prevent rainbow table attacks
    // Even with database compromise, attacker needs the HMAC key to reverse PINs
    return crypto.createHmac('sha256', JWT_SECRET!).update(pin).digest('hex');
};
```

**Migration needed:** After deploying the code change, run a one-time backfill script to re-hash all existing `pinLookup` values with HMAC. Until migrated, the legacy SHA-256 fallback path in `loginWithPin` handles unmigrated users.

```typescript
// prisma/backfill-pin-hmac.ts (run once after deploy)
import { prisma } from '../src/lib/prisma';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET!;

async function backfill() {
  const users = await prisma.user.findMany({
    where: { pinLookup: { not: null } },
    select: { id: true, pinHash: true }
  });
  // Note: Cannot reverse bcrypt hashes, so pinLookup will be updated
  // on next successful login via the existing backfill logic.
  // Set pinLookup to null to force re-computation on next login.
  await prisma.user.updateMany({
    where: { pinLookup: { not: null } },
    data: { pinLookup: null }
  });
  console.log(`Reset ${users.length} pinLookup values. Will be re-computed with HMAC on next login.`);
}
backfill();
```

**What could break:** Users will experience one slightly slower login (O(n) bcrypt scan) the first time after deployment. After that, the HMAC-based lookup kicks in at O(1).

---

### FIX-005: Fix dotenv loading order (SEC-006)
**Priority:** Immediate | **Effort:** Low | **Risk:** None

**Problem:** `dotenv.config()` is called after `app.ts` imports execute.

**Fix:** Move `dotenv.config()` to the very top of `server.ts`, before any imports:

```typescript
// backend/src/server.ts — FIRST LINE
import dotenv from 'dotenv';
dotenv.config();

// Now import app (which reads process.env)
import http from 'http';
import app from './app';
import { initSocket } from './lib/socket';
import { logger } from './utils/logger';
```

---

## Tier 2 — Next Sprint (High-Impact Improvements)

---

### FIX-006: Add `requirePermission` to all route modules (SEC-005)
**Priority:** Short-term | **Effort:** Medium | **Risk:** May break existing non-ADMIN workflows if permissions aren't configured

**Problem:** 14 route modules use only `authenticate` without granular RBAC.

**Fix:** Add `requirePermission` to each route that modifies data. Example for `user.routes.ts`:

```typescript
// Instead of: authorize(['ADMIN'])
// Use: requirePermission('users', 'create')
router.post('/', authenticate, requirePermission('users', 'create'), apiRateLimiter, createUser);
router.put('/:id', authenticate, validateId(), requirePermission('users', 'update'), apiRateLimiter, updateUser);
router.delete('/:id', authenticate, validateId(), requirePermission('users', 'delete'), deleteUser);
```

**Important:** The ADMIN role already has a bypass in `requirePermission` (line 185 of auth.ts), so this change won't affect ADMIN users. However, you must ensure all existing custom roles have the correct permissions in their JSON configuration, or those users will lose access.

**Recommended approach:**
1. Audit all existing Role records to see what permissions they have
2. Add `requirePermission` to write routes only (GET routes can remain with just `authenticate`)
3. Test with each role type before deploying

---

### FIX-007: Add HMAC bypass guard for production (CFG-001)
**Priority:** Short-term | **Effort:** Low | **Risk:** None

**Fix:** In `hmac.middleware.ts`, prevent `SKIP_HMAC_VALIDATION` from being used in production:

```typescript
// backend/src/integrations/delivery/webhooks/hmac.middleware.ts
if (process.env.SKIP_HMAC_VALIDATION === 'true') {
    if (process.env.NODE_ENV === 'production') {
        logger.error('SKIP_HMAC_VALIDATION is set in production! Ignoring.');
        // Do NOT skip validation in production
    } else {
        logger.warn('HMAC validation skipped (SKIP_HMAC_VALIDATION=true)');
        return next();
    }
}
```

---

### FIX-008: Add pagination to list endpoints (API-001)
**Priority:** Short-term | **Effort:** Medium | **Risk:** Frontend must be updated to use pagination params

**Fix:** Standardize pagination across all services. Create a helper:

```typescript
// backend/src/utils/pagination.ts
export interface PaginationParams {
  page: number;
  limit: number;
}

export function parsePagination(query: { page?: string; limit?: string }, defaults = { page: 1, limit: 50, maxLimit: 200 }): PaginationParams {
  const page = Math.max(1, parseInt(query.page || String(defaults.page), 10) || defaults.page);
  const limit = Math.min(defaults.maxLimit, Math.max(1, parseInt(query.limit || String(defaults.limit), 10) || defaults.limit));
  return { page, limit };
}

export function paginationMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1
  };
}
```

Then apply to each service that currently uses hardcoded `take`:

```typescript
// Example: order.service.ts getRecentOrders
async getRecentOrders(tenantId: number, page = 1, limit = 50) {
    const take = Math.min(limit, 200);
    const skip = (page - 1) * take;
    const [orders, total] = await Promise.all([
        prisma.order.findMany({
            where: { tenantId },
            take,
            skip,
            orderBy: { createdAt: 'desc' },
            include: { items: { include: { product: true } } }
        }),
        prisma.order.count({ where: { tenantId } })
    ]);
    return { orders, pagination: paginationMeta(total, page, take) };
}
```

---

### FIX-009: Replace `alert()` with toast notifications (FE-001, FE-003)
**Priority:** Short-term | **Effort:** Medium | **Risk:** Low

**Fix:** Install `sonner` (lightweight toast library) and replace all `alert()` calls:

```bash
cd frontend && npm install sonner
```

```tsx
// frontend/src/App.tsx — add Toaster component
import { Toaster } from 'sonner';

function App() {
  return (
    <>
      <Toaster position="top-right" richColors />
      {/* ... existing routes */}
    </>
  );
}
```

Then replace each `alert()`:
```typescript
// BEFORE:
alert("Error al guardar usuario");

// AFTER:
import { toast } from 'sonner';
toast.error("Error al guardar usuario");
```

---

### FIX-010: Add React Error Boundary (ERR-003)
**Priority:** Short-term | **Effort:** Low | **Risk:** None

```tsx
// frontend/src/components/ErrorBoundary.tsx
import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center min-h-screen p-8">
          <h1 className="text-2xl font-bold mb-4">Algo salió mal</h1>
          <p className="text-gray-600 mb-4">{this.state.error?.message}</p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded"
            onClick={() => window.location.reload()}
          >
            Recargar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

Wrap the app in `App.tsx`:
```tsx
<ErrorBoundary>
  <RouterProvider router={router} />
</ErrorBoundary>
```

---

### FIX-011: Fix N+1 in addItemsToOrder (DB-003)
**Priority:** Short-term | **Effort:** Low | **Risk:** None

**Fix:** Use `registerBatch` instead of the loop:

```typescript
// backend/src/services/order.service.ts, line ~713
// BEFORE:
for (const update of stockUpdates) {
  await stockService.register(update.ingredientId, tenantId, StockMoveType.SALE, update.quantity, `Order #${order.orderNumber}`, tx);
}

// AFTER:
await stockService.registerBatch(stockUpdates, tenantId, StockMoveType.SALE, `Order #${order.orderNumber}`, tx);
```

---

## Tier 3 — Next Quarter (Hardening & Quality-of-Life)

---

### FIX-012: Encrypt API keys at rest (SEC-009)
**Priority:** Medium-term | **Effort:** High | **Risk:** Requires encryption key management

Use AES-256-GCM encryption for `apiKey` and `webhookSecret` fields in `TenantPlatformConfig`. Add encrypt/decrypt utility functions and apply them in the delivery service layer.

---

### FIX-013: Eliminate frontend `any` types (FE-002)
**Priority:** Medium-term | **Effort:** High | **Risk:** Low

Enable `noImplicitAny` in the frontend `tsconfig.json` and fix all 79 occurrences. Prioritize:
1. `errorUtils.ts` (7 instances) — type catch clauses as `unknown`
2. API service files — type API responses with interfaces
3. Store files — type state properly

---

### FIX-014: Add OpenAPI/Swagger documentation (API-002)
**Priority:** Medium-term | **Effort:** High | **Risk:** None

Install `swagger-jsdoc` and `swagger-ui-express`. Add JSDoc annotations to route handlers that generate the OpenAPI spec automatically.

---

### FIX-015: Set up CI/CD pipeline (DEP-003, TST-001)
**Priority:** Medium-term | **Effort:** High | **Risk:** None

Create a GitHub Actions workflow:
1. Run `npm ci` for both backend and frontend
2. Run `npm audit --production --audit-level=high`
3. Run `tsc --noEmit` (type check)
4. Run `jest` (backend tests)
5. Run `eslint` (frontend lint)
6. Build Docker images
7. (Future) Run Cypress E2E tests

---

### FIX-016: Add E2E tests for critical flows (TST-001)
**Priority:** Medium-term | **Effort:** High | **Risk:** None

Write Cypress tests for:
1. Login flow (email + PIN)
2. Create order → add items → payment → close
3. Cash shift open/close with variance check
4. Table open → order → close with payment

---

### FIX-017: Centralize env validation with Zod (CFG-003)
**Priority:** Backlog | **Effort:** Low | **Risk:** None

```typescript
// backend/src/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  CORS_ORIGINS: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
});

export const env = envSchema.parse(process.env);
```

---

## Quick Wins (Low Effort, High Value, Ship Today)

| # | Fix | Effort | Value |
|---|-----|--------|-------|
| 1 | FIX-001: Auth on supplier routes | 5 min | 🔴 Critical security fix |
| 2 | FIX-002: Auth on purchase order routes | 5 min | 🔴 Critical security fix |
| 3 | FIX-003: Algorithm restriction on WebSocket JWT | 1 line | 🔴 Critical security fix |
| 4 | FIX-005: Fix dotenv loading order | Move 2 lines | 🟠 Config fix |
| 5 | FIX-011: Use registerBatch in addItemsToOrder | 3 lines | 🟡 Performance fix |
| 6 | FIX-007: Block HMAC bypass in production | 5 lines | 🟠 Security hardening |

---

## Implementation Dependency Order

```
FIX-001 ──┐
FIX-002 ──┤
FIX-003 ──┼── Deploy immediately (no dependencies)
FIX-005 ──┤
FIX-007 ──┘
           │
FIX-004 ── ── Requires migration script
           │
FIX-006 ── ── Requires role permissions audit first
           │
FIX-008 ──┐
FIX-009 ──┼── Frontend + backend changes together
FIX-010 ──┘
           │
FIX-012 ── ── Requires encryption key management setup
FIX-013 ── ── Independent (frontend only)
FIX-014 ── ── Independent
FIX-015 ── ── Independent (infra)
FIX-016 ── ── Depends on FIX-015 (CI/CD)
FIX-017 ── ── Independent
```
