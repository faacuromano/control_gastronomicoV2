# REVIEW — Sprint 12 | 2026-02-07

## Sprint 12: Unit Tests — Product/Category/Discount Services
**Module(s):** Menu/Catalog, Discounts
**Focus:** Testing — Backend

### Execution Validation

| Check | Result | Notes |
|-------|--------|-------|
| `npm run test:unit` | PASS (188 tests, 0 failures) | All 8 unit test suites pass |
| New tests | 56 | category (14), product (19), discount (19) + 4 subtests |
| Existing tests | 132 | auth, order, cashShift, table, payment — no regressions |
| Files created | 3 | category.service.test.ts, product.service.test.ts, discount.service.test.ts |

### Files Summary

#### category.service.test.ts (14 tests) — NEW
- `getCategories`: product counts (active/total), empty result
- `getCategoryById`: success, not found
- `createCategory`: valid, with printerId, empty name, name too long
- `updateCategory`: name, printerId null, not found
- `deleteCategory`: empty category, cascade inactive products, active products conflict, not found

#### product.service.test.ts (19 tests) — NEW
- `getProducts`: pagination, limit cap (500), where filters
- `getProductById`: success, not found
- `createProduct`: simple, ingredient validation (tenant scope), modifier validation, name/price/tenant validation, invalid category
- `updateProduct`: fields, ingredient replacement, not found, category validation
- `toggleProductActive`: true→false, false→true, not found
- `deleteProduct`: soft delete, not found

#### discount.service.test.ts (19 tests) — NEW
- `applyDiscount`: percentage (10%), fixed, cap at subtotal, stacking, auto-mark PAID, invalid type/reason/value/percentage/>100, paid order, not found
- `removeDiscount`: restore total, paid order, not found
- `getDiscountReasons`: all 7 reasons, code+label structure
- `getDiscountTypes`: 2 types, code+label structure

### VERDICT: PASS

56 new unit tests added for 3 services. All 188 unit tests pass with 0 failures and no regressions. Combined with existing tests, coverage now includes 8 critical services: auth, order, cashShift, table, payment, product, category, discount.
