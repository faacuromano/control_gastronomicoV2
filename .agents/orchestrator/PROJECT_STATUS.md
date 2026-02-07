# PROJECT STATUS

## Project: PentiumPOS | Domain: Restaurant POS | Stage: Active Development
## Last Updated: 2026-02-06

---

### TECH STACK

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | React | 19.2.0 |
| Frontend Build | Vite | 7.2.4 |
| Frontend State | Zustand | 5.0.10 |
| Frontend Routing | react-router-dom | 7.12.0 |
| Frontend Styling | TailwindCSS | 3.4.19 |
| Frontend UI | Radix UI (label, slot, tabs) | Latest |
| Frontend DnD | @dnd-kit | 6.3.1 |
| Frontend Icons | lucide-react | 0.562.0 |
| Frontend Offline | Dexie (IndexedDB) | 4.2.1 |
| Frontend PWA | vite-plugin-pwa | 1.2.0 |
| Frontend Toasts | sonner | 2.0.7 |
| Frontend E2E | Cypress | 15.9.0 |
| Backend Framework | Express | 5.2.1 |
| Backend Language | TypeScript | 5.9.3 |
| Backend ORM | Prisma | 6.19.2 |
| Backend Auth | jsonwebtoken + bcryptjs | 9.0.3 / 3.0.3 |
| Backend Validation | Zod | 4.3.5 |
| Backend Security | helmet, cors, express-rate-limit | Latest |
| Backend Real-Time | Socket.IO | 4.8.3 |
| Backend Queue | BullMQ | 5.66.5 |
| Backend Printing | node-thermal-printer | 4.5.0 |
| Backend Tests | Jest + ts-jest + supertest | 30.0.0 |
| Database | MySQL | 8.x |
| Cache/Queue | Redis (optional) | - |

---

### MODULE MAP

| Module | Description | Backend | Frontend | Tests | Security | Debt |
|--------|-------------|---------|----------|-------|----------|------|
| Auth | PIN/password login, JWT cookies, RBAC, refresh tokens | 95% | 95% | Unit+Integration | HIGH | - |
| Orders/POS | Order CRUD, cart, checkout, payments | 95% | 95% | Unit+E2E | HIGH | - |
| Tables | Table map, areas, open/close, drag-and-drop | 90% | 90% | E2E | HIGH | - |
| Kitchen (KDS) | Kitchen display, item status, station routing | 95% | 90% | E2E | HIGH | - |
| Cash Shifts | Open/close shift, blind count, reports | 95% | 95% | Unit+E2E | HIGH | - |
| Menu/Catalog | Products, categories, modifiers, ingredients | 90% | 90% | Unit | HIGH | - |
| Inventory | Stock tracking, movements, purchase orders, suppliers | 90% | 90% | Partial | HIGH | - |
| Delivery | Platform integration, drivers, multi-channel pricing | 90% | 90% | E2E+Integration | HIGH | - |
| Invoicing | Receipts, fiscal invoices | 90% | 90% | None | MEDIUM | Fiscal integration (AFIP) |
| QR Menu | Public menu, self-ordering, QR codes | 90% | 90% | None | HIGH | - |
| Analytics | Dashboard, sales reports, top products | 95% | 95% | None | HIGH | - |
| Clients/Loyalty | Customer DB, points, wallet | 90% | 90% | None | MEDIUM | Points history model |
| Config/Settings | Tenant config, feature flags | 95% | 95% | None | HIGH | - |
| Printing | Thermal printers, routing, area overrides | 90% | 90% | None | HIGH | - |
| Audit | Audit log, action tracking | 95% | 90% | None | HIGH | - |
| Sync/Offline | IndexedDB, sync manager, service worker | 90% | 90% | P0 | HIGH | - |
| Roles/Users | User management, RBAC, permissions | 95% | 90% | None | HIGH | - |
| Discounts | Discount application | 90% | 90% | None | HIGH | Rule engine (advanced) |
| Bulk Pricing | Mass price updates | 90% | 90% | None | HIGH | - |

---

### DATABASE SCHEMA (33 models)

**Core Domain**: Tenant, TenantConfig, User, Role, RefreshToken
**Menu**: Category, Product, ModifierGroup, ModifierOption, ProductModifierGroup, ProductIngredient, Ingredient
**Orders**: Order, OrderItem, OrderItemModifier, Payment, CashShift, Invoice, TaxRate
**Spatial**: Area, Table, AreaPrinterOverride
**Stock**: StockMovement, Supplier, PurchaseOrder, PurchaseOrderItem
**Delivery**: DeliveryPlatform, DeliveryDriver, TenantPlatformConfig, ProductChannelPrice
**Other**: Printer, KdsStation, QrCode, PaymentMethodConfig, AuditLog, OrderSequence, Client

**Key Relations**: All models have `tenantId` FK to Tenant. Order→Table, Order→User(server), Order→Client, OrderItem→Product, Payment→CashShift.

---

### SECURITY POSTURE

| Area | State | Risk | Notes |
|------|-------|------|-------|
| JWT Authentication | Strong | LOW | HttpOnly cookies, HS256, 32+ char secret |
| PIN Brute-Force | Strong | LOW | Rate limiting + account lockout (5 attempts/15min) |
| Multi-Tenant Isolation | Strong | LOW | All Prisma queries scoped by tenantId |
| CORS | Strong | LOW | Explicit origins, no wildcards in production |
| CSRF | Strong | LOW | X-Requested-With header + SameSite cookies |
| Input Validation | Good | MEDIUM | Zod on auth+QR paths; some controllers pass raw req.body |
| Security Headers | Strong | LOW | Helmet with explicit CSP, HSTS, X-Frame-Options |
| Webhook HMAC | Strong | LOW | crypto.timingSafeEqual for delivery webhooks |
| Socket.IO Auth | Strong | LOW | JWT verification on all connections |
| Prototype Pollution | Strong | LOW | sanitize-body middleware strips __proto__ |
| Error Handling | Strong | LOW | ApiError classes, no stack traces in production |
| Refresh Tokens | Strong | LOW | Rotated on use, SHA-256 hashed, max 5 per user |
| Audit Logging | Strong | LOW | All critical operations logged |

---

### TECHNICAL DEBT

| ID | Category | Description | Impact | Priority | Status |
|----|----------|-------------|--------|----------|--------|
| TD-001 | Validation | Controllers pass raw req.body without Zod | Mass assignment risk | HIGH | RESOLVED (Sprint 1-2) |
| TD-002 | Testing | Most services lack unit tests (35 of 37) | Low confidence | HIGH | PARTIAL (Sprint 3: auth+order) |
| TD-003 | Frontend | Invoicing frontend incomplete | Missing feature | MEDIUM | RESOLVED (Sprint 4) |
| TD-004 | Frontend | Analytics dashboard incomplete | Missing feature | MEDIUM | RESOLVED (Sprint 5) |
| TD-005 | Offline | Sync conflict resolution rudimentary | Data inconsistency | MEDIUM | RESOLVED (Sprint 8) |
| TD-006 | Delivery | Webhook handlers incomplete | Integration gap | MEDIUM | RESOLVED (Sprint 7) |
| TD-007 | Loyalty | Wallet/points system skeletal | Missing feature | LOW | RESOLVED (Sprint 9) |
| TD-008 | Discount | No admin page or rule engine | Limited functionality | LOW | PARTIAL (Sprint 10: admin page) |
| TD-009 | Fiscal | AFIP fiscal integration | Country-specific | LOW | DEFERRED |
| TD-010 | DX | Some `as any` casts in non-critical paths | Type safety | LOW | OPEN |
| TD-011 | Consistency | sync.controller uses res.json() not sendSuccess() | Response format | LOW | OPEN |
