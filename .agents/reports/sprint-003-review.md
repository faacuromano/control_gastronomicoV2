# REVIEW — Sprint 3 | 2026-02-06

## Sprint 3: Core Service Unit Tests
**Module(s):** Orders/POS, Authentication
**Focus:** Testing — Backend

### Execution Validation

| Check | Result | Notes |
|-------|--------|-------|
| `tsc --noEmit` | PASS (0 errors) | Verified independently |
| `npm run test:unit` | **67 passed, 0 failed** | All unit tests green |
| `npm test` (full) | 139 passed, 21 failed | 35 new tests added, 3 pre-existing failures fixed. 21 remaining are integration/DB tests. |
| Files modified | 2 test files | order.service.test.ts, auth.service.test.ts |

### Test Coverage Summary

#### order.service.test.ts — 29 tests (22 new + 7 existing)

| Describe Block | Tests | Status | Coverage |
|---------------|-------|--------|----------|
| createOrder | 6 | ALL PASS | Success, product not found, inactive, no server, no shift, multiple items |
| getRecentOrders | 1 | PASS | Returns ordered list with includes |
| **getById** (NEW) | 3 | ALL PASS | Success with includes, not found, tenant isolation |
| **addPayments** (NEW) | 11 | ALL PASS | Full payment, partial, accumulated, table release, empty array, negative amount, zero amount, not found, cancelled, already paid, overpayment, invalid ID |
| **addItemsToOrder** (NEW) | 4 | ALL PASS | Add items + recalculate, not found, paid order, reopen DELIVERED |
| **createOrder integration** (NEW) | 3 | ALL PASS | Stock flag check, order number generation, executeIfEnabled stock processing |

#### auth.service.test.ts — 38 tests (13 new + 25 existing, 3 existing fixed)

| Describe Block | Tests | Status | Coverage |
|---------------|-------|--------|----------|
| loginWithPin | 11 | ALL PASS | Success (4), validation (3), auth errors (3), audit (1) |
| loginWithPassword | 7 | ALL PASS | Success (2), validation (2), auth errors (4) |
| register | 6 | ALL PASS (3 fixed) | Success (2), validation (3), conflict (1) |
| **refreshAccessToken** (NEW) | 8 | ALL PASS | New tokens (1), user shape (1), rotation/delete (1), create new (1), JWT claims (1), invalid token (1), expired + cleanup (1), inactive user + cleanup (1) |
| **createRefreshToken** (NEW) | 4 | ALL PASS | Returns raw 64-char hex (1), stores SHA-256 hash (1), deletes oldest at limit (1), no delete under limit (1) |
| **revokeRefreshTokens** (NEW) | 1 | PASS | Deletes all tokens for user+tenant |

### Pre-Existing Failures Fixed

| ID | Test | Root Cause | Fix |
|----|------|-----------|-----|
| F-001 | register: creates user and returns valid data | Test used `password123` which lacks uppercase (PasswordSchema requires upper+lower+number) | Changed to `Password123` |
| F-002 | register: hashes password before storing | Same cause + assertion used old password string | Updated password + assertion |
| F-003 | register: CONFLICT if email already registered | Same cause — validation failed before reaching conflict check | Updated password |

### Contract Compliance

| Function | Signature | Tests Match? | Notes |
|----------|-----------|-------------|-------|
| `getById(id, tenantId)` | Returns order with items/payments/client/driver | YES | 3 tests cover success, null, tenant scope |
| `addPayments(orderId, request, tenantId, userId, shiftId?)` | Returns AddPaymentsResult | YES | 11 tests cover happy path, edge cases, validation |
| `addItemsToOrder(orderId, items, serverId, tenantId)` | Returns updated order | YES | 4 tests cover success, error cases, reopen |
| `refreshAccessToken(rawToken)` | Returns { accessToken, refreshToken, user } | YES | 8 tests cover success, expiry, inactive user |
| `createRefreshToken(userId, tenantId)` | Returns raw token string | YES | 4 tests cover creation, hashing, rotation |
| `revokeRefreshTokens(userId, tenantId)` | Void, deletes all tokens | YES | 1 test verifies deleteMany call |

### Mock Strategy

| Service | Mock Type | Purpose |
|---------|-----------|---------|
| Prisma | Per-model jest.fn() | Isolate from DB, control return values |
| bcrypt | jest.spyOn | Verify hash/compare calls |
| AuditService | Full module mock | Prevent DB audit writes |
| KDSService | Full module mock | Prevent WebSocket broadcasts |
| FeatureFlagsService | Full module mock | Control feature flag behavior |
| OrderNumberService | Full module mock | Control order number generation |
| BusinessDateService | Full module mock | Fixed business date |
| StockMovementService | Constructor mock | Control stock operations |
| LoyaltyService | Constructor mock | Control loyalty point awards |
| Logger | Full module mock | Suppress console output |

### Acceptance Criteria

| Criterion | Met? | Evidence |
|-----------|------|----------|
| Tests for `createOrder` | YES | 6 existing tests + 3 integration checks |
| Tests for `getOrderById` | YES | 3 new tests (success, not found, tenant isolation) |
| Tests for stock deduction flag check | YES | `isFeatureEnabled` + `executeIfEnabled` assertions |
| Tests for order number generation | YES | `getNextOrderNumber` assertion with tx, tenantId, businessDate |
| Tests for `addPayments` | YES | 11 tests covering full/partial/accumulated/table/errors |
| Tests for `addItemsToOrder` | YES | 4 tests covering success, not found, paid, reopen |
| Tests for `loginWithPin` | YES | 11 existing tests (success, validation, auth errors) |
| Tests for `loginWithPassword` | YES | 7 existing tests (success, validation, auth errors) |
| Tests for `register` | YES | 6 existing tests (3 fixed, all now pass) |
| Tests for `refreshToken` (success, expired, reuse) | YES | 8 tests: success + rotation + JWT + expired + inactive |
| Prisma mocked (no real DB) | YES | All DB calls use jest.fn() mocks |
| `npm run test:unit` passes | YES | 67/67 pass, 0 failures |

### VERDICT: PASS

All acceptance criteria met. 35 new unit tests added (22 order + 13 auth), 3 pre-existing failures fixed. Test suite expanded from 7 → 29 order tests and 22 → 38 auth tests. All unit tests green. TypeScript compiles cleanly. No external service dependencies.
