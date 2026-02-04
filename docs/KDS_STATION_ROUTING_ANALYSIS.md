# Product-to-Station Routing System Analysis

> **Date:** 2026-02-04
> **Status:** Analysis Complete - Pending Implementation Decision

---

## 1. Current System Overview

### Print Routing (Fully Implemented, Not Integrated)

The print routing system uses a **3-level priority hierarchy**:

```
Priority 1: Area + Category Override  →  "Beverages in Terrace" → Terrace Printer
Priority 2: Area-Wide Override        →  "All items in Terrace" → Terrace Printer
Priority 3: Category Default          →  "Beverages" → Bar Printer
```

**Database Schema:**
- `Category.printerId` - Default printer for all products in category
- `AreaPrinterOverride` - Overrides by area (can be category-specific or area-wide)

**Key Files:**
- Service: `backend/src/services/printRouting.service.ts`
- Controller: `backend/src/controllers/printRouting.controller.ts`
- Routes: `backend/src/routes/printRouting.routes.ts`

**Key Issue:** The print routing service **exists but is never called** during order creation. Orders are created and broadcast to KDS, but nothing triggers printing.

### KDS System (Fully Implemented)

**Backend:**
- `kdsService.broadcastNewOrder()` - Emits to `tenant:{id}:kitchen` room
- `kdsService.broadcastOrderUpdate()` - Emits updates
- Socket rooms exist: `tenant:{id}:kitchen:station:{name}` (sanitized, ready to use)

**Key Files:**
- KDS Service: `backend/src/services/kds.service.ts`
- Kitchen Service: `backend/src/services/orderKitchen.service.ts`
- Socket Config: `backend/src/lib/socket.ts`
- Frontend Page: `frontend/src/modules/kitchen/pages/KitchenPage.tsx`
- Frontend Store: `frontend/src/store/kitchen.store.ts`

**Frontend:**
- Store has `KitchenStation = 'ALL' | 'HOT' | 'COLD' | 'DESSERT'`
- UI allows station selection
- **But filtering is a no-op:** `orders.filter(_o => activeStation === 'ALL' ? true : true)`

### Current Gap Analysis

| Concept | Print Routing | KDS Routing |
|---------|--------------|-------------|
| Assignment Level | Category | None |
| Override by Area | Yes | No |
| Product-level | No | No |
| Data Model | Complete | Missing |
| Service | Complete | Broadcast only |
| Integration | Not called | Working |

---

## 2. Requirements Analysis

### Functional Requirements

1. **Product Station Assignment**
   - Each product can be assigned to a KDS station (Bar, Kitchen, Cold Station, etc.)
   - If not assigned, inherit from category
   - If category not assigned, go to "default" or "all" station

2. **KDS Station Filtering**
   - Each KDS display shows only items for its station
   - "ALL" view shows everything (for managers/expeditors)

3. **Real-time Updates**
   - When items are added, only the relevant station receives them
   - Status updates still broadcast to all (for order-level visibility)

4. **Print Routing Integration** (secondary)
   - Same station assignment could drive printer selection
   - Or keep printer routing separate (category-based)

### Non-Functional Requirements

1. **Backward Compatibility** - Existing orders/products must work
2. **Multi-tenant Isolation** - Stations scoped to tenant
3. **Performance** - No additional queries per item
4. **Flexibility** - Stations should be configurable per tenant

---

## 3. Architecture Options

### Option A: Extend Product Model (Simplest)

Add `kdsStationId` to Product model, create a `KdsStation` table.

```prisma
model KdsStation {
  id        Int       @id @default(autoincrement())
  tenantId  Int
  name      String    // "Kitchen", "Bar", "Cold", "Dessert"
  code      String    // "KITCHEN", "BAR", "COLD", "DESSERT"
  isDefault Boolean   @default(false)
  products  Product[]
  categories Category[]
  @@unique([tenantId, code])
}

model Product {
  // ... existing fields
  kdsStationId  Int?
  kdsStation    KdsStation? @relation(...)
}

model Category {
  // ... existing fields
  kdsStationId  Int?        // Default station for products in this category
  kdsStation    KdsStation? @relation(...)
}
```

**Routing Logic:**
```
Product.kdsStationId ?? Category.kdsStationId ?? tenant.defaultStationId
```

| Pros | Cons |
|------|------|
| Simple implementation | No area overrides |
| Follows existing category-based pattern | Different from print routing |
| Easy to understand | Less flexible |

### Option B: Mirror Print Routing Pattern (Most Consistent)

Create parallel structure to print routing for KDS stations.

```prisma
model KdsStation {
  id        Int       @id @default(autoincrement())
  tenantId  Int
  name      String
  code      String
  categories Category[]
  areaOverrides AreaKdsStationOverride[]
  @@unique([tenantId, code])
}

model Category {
  kdsStationId  Int?
  kdsStation    KdsStation?
  stationOverrides AreaKdsStationOverride[]
}

model AreaKdsStationOverride {
  id          Int         @id @default(autoincrement())
  tenantId    Int
  areaId      Int
  categoryId  Int?        // null = all categories in this area
  stationId   Int
  @@unique([areaId, categoryId])
}
```

| Pros | Cons |
|------|------|
| Consistent with print routing | More complexity |
| Area-specific overrides | May be over-engineered |
| Maximum flexibility | More UI work |

### Option C: Unified Routing Model (Most Flexible)

Create a single routing concept that drives both printing AND KDS.

```prisma
model ProductionStation {
  id          Int       @id @default(autoincrement())
  tenantId    Int
  name        String    // "Kitchen", "Bar"
  code        String    // "KITCHEN", "BAR"
  printerId   Int?      // Optional printer for this station
  printer     Printer?
  @@unique([tenantId, code])
}

model Category {
  stationId   Int?
  station     ProductionStation?
}

model Product {
  stationId   Int?      // Override category's station
  station     ProductionStation?
}
```

**Routing Flow:**
```
1. Determine station: Product.stationId ?? Category.stationId ?? default
2. For KDS: Broadcast to station's socket room
3. For Printing: Use station.printerId (if configured)
```

| Pros | Cons |
|------|------|
| Single source of truth | Migration complexity |
| Intuitive model | Changes existing print routing logic |
| Future-proof | Higher initial effort |

---

## 4. Recommended Approach: Option A + Limited Option C

**Phase 1: KDS Station Assignment (Option A)**
- Add `KdsStation` model with tenant-scoped stations
- Add `kdsStationId` to `Category` (default for category)
- Add `kdsStationId` to `Product` (override category)
- Update KDS broadcasting to route by station
- Fix frontend filtering

**Phase 2: Unify with Printing (Optional, Future)**
- Link stations to printers
- Migrate print routing to use stations

---

## 5. Implementation Plan (Phase 1)

### 5.1 Database Changes

```prisma
// New model
model KdsStation {
  id         Int        @id @default(autoincrement())
  tenantId   Int
  tenant     Tenant     @relation(fields: [tenantId], references: [id])
  name       String
  code       String     // KITCHEN, BAR, COLD, DESSERT, etc.
  sortOrder  Int        @default(0)
  isActive   Boolean    @default(true)
  isDefault  Boolean    @default(false)  // One per tenant
  createdAt  DateTime   @default(now())

  products   Product[]
  categories Category[]

  @@unique([tenantId, code])
  @@index([tenantId])
}

// Modify existing models
model Category {
  // ... existing
  kdsStationId  Int?
  kdsStation    KdsStation? @relation(fields: [kdsStationId], references: [id])
}

model Product {
  // ... existing
  kdsStationId  Int?
  kdsStation    KdsStation? @relation(fields: [kdsStationId], references: [id])
}
```

### 5.2 Backend Changes

#### New Service: `kdsStation.service.ts`
- `createStation(tenantId, name, code)` - Create new station
- `updateStation(id, tenantId, data)` - Update station
- `deleteStation(id, tenantId)` - Delete (only if no products assigned)
- `getStations(tenantId)` - List all stations
- `setDefaultStation(id, tenantId)` - Set as default
- `seedDefaultStations(tenantId)` - Create initial stations for new tenant

#### Modify: `kds.service.ts`
```typescript
// Current
broadcastNewOrder(order) {
  io.to(`tenant:${tenantId}:kitchen`).emit('kitchen:order_new', payload);
}

// New - also broadcast to station-specific rooms
broadcastNewOrder(order) {
  // Broadcast to general kitchen (for ALL view)
  io.to(`tenant:${tenantId}:kitchen`).emit('kitchen:order_new', payload);

  // Group items by station and broadcast to specific rooms
  const itemsByStation = groupItemsByStation(order.items);
  for (const [stationCode, items] of itemsByStation) {
    io.to(`tenant:${tenantId}:kitchen:station:${stationCode}`)
      .emit('kitchen:station_items', { orderId: order.id, items });
  }
}
```

#### Modify: `orderKitchen.service.ts`
```typescript
// Add station filter parameter
async getActiveOrders(tenantId: number, stationCode?: string) {
  return prisma.order.findMany({
    where: {
      tenantId,
      status: { in: ['OPEN', 'CONFIRMED', 'IN_PREPARATION', 'PREPARED'] },
      // Filter by station if specified
      ...(stationCode && stationCode !== 'ALL' ? {
        items: {
          some: {
            product: {
              OR: [
                { kdsStation: { code: stationCode } },
                { kdsStationId: null, category: { kdsStation: { code: stationCode } } }
              ]
            }
          }
        }
      } : {})
    },
    include: {
      items: {
        where: stationCode && stationCode !== 'ALL' ? {
          product: {
            OR: [
              { kdsStation: { code: stationCode } },
              { kdsStationId: null, category: { kdsStation: { code: stationCode } } }
            ]
          }
        } : undefined,
        include: { product: { include: { kdsStation: true } } }
      }
    }
  });
}
```

### 5.3 Frontend Changes

#### KDS Page (`KitchenPage.tsx`)
```typescript
// Join station-specific room when station selected
useEffect(() => {
  if (socket && isConnected) {
    socket.emit('join:kitchen');
    if (activeStation !== 'ALL') {
      socket.emit('join:kitchen:station', activeStation);
    }

    // Listen for station-specific items
    socket.on('kitchen:station_items', ({ orderId, items }) => {
      // Update order with new items for this station
    });
  }
}, [socket, isConnected, activeStation]);

// Fetch orders with station filter
const loadActiveOrders = async () => {
  const data = await orderService.getActiveOrders(activeStation);
  setOrders(data);
};
```

#### Admin: Station Management Page (New)
- List all stations with drag-to-reorder
- Create/edit station modal
- Delete station (with confirmation)
- Set default station

#### Admin: Product Form
- Add station selector dropdown
- "Inherit from category" option (null value)

#### Admin: Category Form
- Add default station selector dropdown

---

## 6. Risk Analysis

### High Risk

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Data migration breaks existing products | Orders stop appearing in KDS | Medium | Default station assigned to all existing products/categories via migration |
| Socket room naming conflicts | Wrong station receives items | Low | Use station `code` (uppercase, validated) consistently |
| Multi-tenant data leak | Security breach | Low | All queries include `tenantId`, socket rooms prefixed with tenant |

### Medium Risk

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Performance degradation | Slow order creation | Medium | Batch station lookups, cache station codes in memory |
| Frontend state desync | UI shows wrong items | Medium | Clear cache on station change, refetch on reconnect |
| Backward compatibility | API breaks | Low | Nullable `kdsStationId`, default fallback logic |
| Complex station logic | Bugs in routing | Medium | Comprehensive unit tests for routing logic |

### Low Risk

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Complex admin UI | User confusion | Low | Progressive disclosure, sensible defaults |
| Over-emission of socket events | Network overhead | Low | Only emit to relevant rooms, not broadcast |
| Station deletion with assigned products | Data integrity | Low | Prevent deletion or reassign to default |

---

## 7. Key Questions Before Implementation

### Must Decide

1. **Should station routing also affect printing?**
   - Option A: Station → Printer mapping (unifies systems)
   - Option B: Keep print routing separate (more flexibility)
   - **Recommendation:** Phase 1 = separate, Phase 2 = optional unification

2. **Can products override category station?**
   - **Recommendation:** Yes (Product.kdsStationId overrides Category.kdsStationId)

3. **Should stations be per-tenant or global?**
   - **Recommendation:** Per-tenant (restaurants have different needs)

4. **What happens to items without station?**
   - Option A: Don't show in any station view (bad UX)
   - Option B: Show in ALL views only (recommended)
   - Option C: Assign to default station automatically

5. **Should area overrides exist for KDS?**
   - **Recommendation Phase 1:** No (keep simple)
   - **Recommendation Phase 2:** Consider if needed

### Nice to Have

6. **Should stations have colors for UI?**
   - Useful for quick visual identification

7. **Should stations support icons?**
   - Could use emoji or icon library

8. **Should there be station-level permissions?**
   - e.g., "User X can only see BAR station"

---

## 8. Estimated Scope

| Component | Effort | Files Changed/Created |
|-----------|--------|----------------------|
| Database schema | Low | 1 (schema.prisma) |
| Migration script | Low | 1 new migration |
| KdsStation service | Medium | 1 new service |
| KdsStation controller/routes | Low | 2 new files |
| Modify kds.service.ts | Medium | 1 file |
| Modify orderKitchen.service.ts | Medium | 1 file |
| Modify product queries | Low | 2-3 files |
| Frontend: Station admin page | Medium | 1-2 new pages |
| Frontend: Product form | Low | 1 file |
| Frontend: Category form | Low | 1 file |
| Frontend: KDS filtering | Medium | 2 files |
| Tests | Medium | 3-4 files |
| **Total** | **Medium** | **~15-20 files** |

### Estimated Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Database + Migration | 1 day | Schema changes, migration script |
| Backend Services | 2 days | KdsStation service, modified KDS service |
| Backend API | 1 day | Controller, routes, tests |
| Frontend Admin | 2 days | Station management, product/category forms |
| Frontend KDS | 1-2 days | Filtering, socket integration |
| Testing + QA | 1 day | Integration testing |
| **Total** | **8-9 days** | Complete Phase 1 |

---

## 9. File Structure After Implementation

```
backend/
├── prisma/
│   ├── schema.prisma              # Modified - KdsStation model
│   └── migrations/
│       └── YYYYMMDD_add_kds_stations/
├── src/
│   ├── services/
│   │   ├── kdsStation.service.ts  # NEW
│   │   ├── kds.service.ts         # Modified
│   │   └── orderKitchen.service.ts # Modified
│   ├── controllers/
│   │   └── kdsStation.controller.ts # NEW
│   └── routes/
│       └── kdsStation.routes.ts   # NEW

frontend/
├── src/
│   ├── modules/
│   │   ├── admin/
│   │   │   └── pages/
│   │   │       └── KdsStationsPage.tsx  # NEW
│   │   └── kitchen/
│   │       └── pages/
│   │           └── KitchenPage.tsx      # Modified
│   ├── services/
│   │   └── kdsStationService.ts         # NEW
│   └── store/
│       └── kitchen.store.ts             # Modified
```

---

## 10. Migration Strategy

### Step 1: Create Default Stations
```sql
-- For each tenant, create default stations
INSERT INTO KdsStation (tenantId, name, code, sortOrder, isDefault)
SELECT id, 'Cocina', 'KITCHEN', 1, true FROM Tenant;

INSERT INTO KdsStation (tenantId, name, code, sortOrder, isDefault)
SELECT id, 'Barra', 'BAR', 2, false FROM Tenant;
```

### Step 2: Assign Default Station to Categories
```sql
-- Assign all categories to KITCHEN by default
UPDATE Category c
SET kdsStationId = (
  SELECT id FROM KdsStation
  WHERE tenantId = c.tenantId AND isDefault = true
);
```

### Step 3: Products Inherit from Category
- No action needed - null `kdsStationId` means "use category's station"

---

## 11. Appendix: Current Socket Room Structure

```
tenant:{tenantId}:kitchen              # General kitchen (ALL view)
tenant:{tenantId}:kitchen:station:{code}  # Station-specific (e.g., :KITCHEN, :BAR)
tenant:{tenantId}:waiters              # Waiter notifications
tenant:{tenantId}:table:{tableId}      # Table-specific
tenant:{tenantId}:admin:stock          # Stock alerts
```

The station rooms already exist in the socket infrastructure (`socket.ts` line 168-173) and are properly sanitized. They just need to be utilized by the KDS service.
