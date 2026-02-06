# REVIEW — Sprint 2 | 2026-02-06

## Sprint 2: Input Validation Hardening (Batch 2)
**Module(s):** Auth, Tables, Orders, QR Menu

### Execution Validation

| Check | Result | Notes |
|-------|--------|-------|
| `tsc --noEmit` | PASS (0 errors) | Verified independently |
| `npm test` | 101 passed, 24 failed | All 24 failures are PRE-EXISTING (auth, order, webhook, tenant isolation tests). None relate to Sprint 2 files. |
| Files modified | 4 controllers | auth, table, order, qr |

### Contract Compliance

| Module | Contract | Matches ARCHITECTURE.md? | Notes |
|--------|----------|--------------------------|-------|
| Auth (loginPin) | `loginWithPin(pin: string, tenantId: number)` | YES | `LoginPinSchema.strict()` validates pin(6) + tenantId(int+) |
| Auth (registerUser) | `register(RegisterData)` | YES | `RegisterUserSchema.strict()` validates email, password(8+), name, pinCode(6), roleId |
| Auth (registerNewTenant) | `registerTenant(RegisterTenantData)` | YES | `RegisterTenantBodySchema.strict()` with `.transform()` for `phone?` (exactOptionalPropertyTypes) |
| Auth (loginUser) | `loginWithPassword(PasswordLoginData)` | YES | `LoginUserSchema.strict()` validates email, password, tenantId |
| Tables (updatePosition) | `updateTablePosition(id, tenantId, x, y)` | YES | `UpdatePositionSchema.strict()` validates x/y numbers |
| Tables (updatePositions) | `updatePositions(tenantId, {id,x,y}[])` | YES | `BatchUpdatePositionsSchema.strict()` validates array of {id,x,y} |
| Tables (openTable) | `openTableWithOrder(tableId, serverId, pax, tenantId)` | YES | `OpenTableSchema.strict()` validates pax with default(1) |
| Orders (assignDriver) | `assignDriver(orderId, driverId, tenantId)` | YES | `assignDriverSchema.strict()` validates driverId(int+) |
| QR (generateCode) | `generateQrCode(tenantId, tableId?)` | YES | `GenerateCodeSchema.strict()` validates optional tableId(int+) |

### Security Findings

| ID | OWASP | Severity | File:Line | Description | Action |
|----|-------|----------|-----------|-------------|--------|
| S-001 | A04 | MEDIUM | auth.controller.ts:193 | Previously `...req.body` spread in registerUser allowed mass assignment (could inject tenantId, isActive, etc.) | FIXED — RegisterUserSchema.strict() whitelists only allowed fields |
| S-002 | A04 | MEDIUM | auth.controller.ts:218 | Previously `req.body` passed directly to registerTenant allowed extra fields | FIXED — RegisterTenantBodySchema.strict() whitelists only allowed fields |
| S-003 | A07 | LOW | auth.controller.ts:251-258 | loginUser had conditional tenant subscription check (`if (rawTenantId)`) — could bypass subscription validation | FIXED — tenantId now required by schema, subscription always validated |
| S-004 | A04 | LOW | table.controller.ts:121 | updatePositions had manual Array.isArray check but no shape validation for array elements | FIXED — BatchUpdatePositionsSchema validates each {id,x,y} element |
| S-005 | A04 | LOW | order.controller.ts:322 | assignDriver used raw `req.body.driverId` with only truthy check | FIXED — assignDriverSchema.strict() validates driverId type and positivity |

### Quality/Architecture Findings

| ID | Category | Severity | File:Line | Description | Action |
|----|----------|----------|-----------|-------------|--------|
| Q-001 | Pattern consistency | LOW | All 4 files | All schemas use `.strict()` — consistent with Sprint 1 pattern | None needed |
| Q-002 | Defense in depth | INFO | auth.controller.ts | Service already has internal Zod schemas (LoginSchema, RegisterSchema, etc.) — controller schemas add boundary defense | By design |

### Acceptance Criteria

| Criterion | Met? | Evidence |
|-----------|------|----------|
| Auth loginPin uses Zod `.strict()` schema | YES | `LoginPinSchema.parse(req.body)` at auth.controller.ts:163 |
| Auth registerUser uses Zod `.strict()` schema | YES | `RegisterUserSchema.parse(req.body)` at auth.controller.ts:230 |
| Auth registerNewTenant uses Zod `.strict()` schema | YES | `RegisterTenantBodySchema.parse(req.body)` at auth.controller.ts:255 |
| Auth loginUser uses Zod `.strict()` schema | YES | `LoginUserSchema.parse(req.body)` at auth.controller.ts:288 |
| Table updatePosition uses Zod `.strict()` schema | YES | `UpdatePositionSchema.parse(req.body)` at table.controller.ts:127 |
| Table batchUpdatePositions uses Zod `.strict()` schema | YES | `BatchUpdatePositionsSchema.parse(req.body)` at table.controller.ts:133 |
| Table openTable pax uses Zod schema | YES | `OpenTableSchema.parse(req.body ?? {})` at table.controller.ts:170 |
| Order assignDriver uses Zod `.strict()` schema | YES | `assignDriverSchema.parse(req.body)` at order.controller.ts:327 |
| QR generateCode uses Zod `.strict()` schema | YES | `GenerateCodeSchema.parse(req.body ?? {})` at qr.controller.ts:172 |
| Extra fields in request body are rejected | YES | All schemas use `.strict()` |
| `tsc --noEmit` passes | YES | 0 errors |

### VERDICT: PASS

All acceptance criteria met. 5 security improvements (2 MEDIUM mass assignment fixes in auth, 1 subscription bypass fix, 2 LOW validation gaps). No contract violations. TypeScript compiles cleanly. Pre-existing test failures unrelated to sprint changes.
