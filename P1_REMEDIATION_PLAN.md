# 🔧 PLAN DE EJECUCIÓN TÉCNICA: P1-BLOCKER Remediations

**Fecha:** 2026-01-19  
**Sprint:** Security Hardening Phase 2  
**Objetivo:** Remediar 4 issues P1-BLOCKER no tocados en la primera remediación

---

## 📊 GAP ANALYSIS

### Issues YA Remediados (en REMEDIATION_AUDIT_LOG.json)

| ID     | Issue                              | Estado   |
| ------ | ---------------------------------- | -------- |
| RC-001 | OrderSequence fuera de transacción | ✅ FIXED |
| RC-002 | TOCTOU deduplicación               | ✅ FIXED |
| ES-003 | Webhook 200 en error               | ✅ FIXED |
| P1-003 | JWT algorithm confusion            | ✅ FIXED |
| NL-004 | Frontend null crash                | ✅ FIXED |

### Issues P1-BLOCKER NO Remediados (Target de este sprint)

| ID         | Issue                                | Archivo                | Severidad  |
| ---------- | ------------------------------------ | ---------------------- | ---------- |
| **RC-004** | Race condition en `openShift()`      | `cashShift.service.ts` | P1-BLOCKER |
| **RC-005** | Race condition en `closeShift()`     | `cashShift.service.ts` | P1-BLOCKER |
| **ES-001** | Stock deduction error swallowing     | `webhookProcessor.ts`  | P1-BLOCKER |
| **ES-002** | Platform acceptance error swallowing | `webhookProcessor.ts`  | P1-BLOCKER |

---

## 🎯 ISSUE #1: RC-004 — Double Shift Opening Race Condition

### El Bug

**Ubicación:** [cashShift.service.ts L42-70](file:///d:/Proyectos/control_gastronomicoV2/backend/src/services/cashShift.service.ts#L42-L70)

```typescript
// ACTUAL CODE - VULNERABLE
async openShift(userId: number, startAmount: number) {
    // ... user validation ...

    // ⚠️ RACE WINDOW: findFirst + create are NOT atomic
    const existingShift = await prisma.cashShift.findFirst({
        where: { userId, endTime: null }
    });

    if (existingShift) {
        throw new ConflictError('User already has an open shift');
    }

    // Between findFirst and create, another request can also pass the check
    return await prisma.cashShift.create({
        data: { userId, startAmount, businessDate, startTime: new Date() }
    });
}
```

**Stimulus → Conflict:**

- Request A: `findFirst` → null
- Request B: `findFirst` → null (A hasn't created yet)
- Request A: `create` → Shift #1
- Request B: `create` → Shift #2
- **Resultado:** Usuario con 2 turnos abiertos simultáneos → conciliación de caja imposible.

### Estrategia de Test (Jest)

```typescript
// __tests__/cashShift.service.race.test.ts
describe("CashShiftService - Race Conditions", () => {
  it("RC-004: should prevent double shift opening under concurrent requests", async () => {
    const userId = 1;
    const startAmount = 1000;

    // Simulate 5 concurrent openShift calls
    const results = await Promise.allSettled([
      cashShiftService.openShift(userId, startAmount),
      cashShiftService.openShift(userId, startAmount),
      cashShiftService.openShift(userId, startAmount),
      cashShiftService.openShift(userId, startAmount),
      cashShiftService.openShift(userId, startAmount),
    ]);

    // Exactly ONE should succeed
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(4);

    // Verify only 1 shift exists in DB
    const shifts = await prisma.cashShift.findMany({
      where: { userId, endTime: null },
    });
    expect(shifts.length).toBe(1);
  });
});
```

### El Fix

```typescript
// cashShift.service.ts - FIXED VERSION
async openShift(userId: number, startAmount: number) {
    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new NotFoundError('User not found.');
    }

    const businessDate = this.getBusinessDate(new Date());

    // FIX RC-004: Atomic transaction with serializable isolation
    return await prisma.$transaction(async (tx) => {
        // Check inside transaction with SELECT FOR UPDATE semantic
        const existingShift = await tx.cashShift.findFirst({
            where: { userId, endTime: null }
        });

        if (existingShift) {
            throw new ConflictError('User already has an open shift');
        }

        return await tx.cashShift.create({
            data: { userId, startAmount, businessDate, startTime: new Date() }
        });
    }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
}
```

**Alternativa más robusta:** Unique partial index en DB:

```sql
CREATE UNIQUE INDEX cashshift_user_open_unique
ON CashShift(userId) WHERE endTime IS NULL;
```

---

## 🎯 ISSUE #2: RC-005 — Double Shift Closing Race Condition

### El Bug

**Ubicación:** [cashShift.service.ts L73-96](file:///d:/Proyectos/control_gastronomicoV2/backend/src/services/cashShift.service.ts#L73-L96)

```typescript
// ACTUAL CODE - VULNERABLE
async closeShift(userId: number, endAmount: number) {
    // ⚠️ getCurrentShift is OUTSIDE transaction
    const currentShift = await this.getCurrentShift(userId);

    if (!currentShift) {
        throw new NotFoundError('No open shift found');
    }

    // ⚠️ Table count also OUTSIDE transaction
    const openTables = await prisma.table.count({
        where: { status: 'OCCUPIED' }
    });

    if (openTables > 0) {
        throw new ConflictError('Cannot close shift. Tables occupied.');
    }

    // ⚠️ By now, shift could already be closed by concurrent request
    return await prisma.cashShift.update({
        where: { id: currentShift.id },
        data: { endTime: new Date(), endAmount }
    });
}
```

**Stimulus → Conflict:**

- Request A: `getCurrentShift` → Shift #5 (open)
- Request B: `getCurrentShift` → Shift #5 (same shift, still open)
- Request A: `update` → Closes shift with endAmount=1000
- Request B: `update` → Closes SAME shift again with endAmount=1500
- **Resultado:** Datos de cierre sobrescritos, auditoría corrupta.

### Estrategia de Test (Jest)

```typescript
// __tests__/cashShift.service.race.test.ts
it("RC-005: should prevent double shift closing", async () => {
  const userId = 1;
  // First open a shift
  await cashShiftService.openShift(userId, 1000);

  // Simulate 3 concurrent closeShift calls with different amounts
  const results = await Promise.allSettled([
    cashShiftService.closeShift(userId, 1500),
    cashShiftService.closeShift(userId, 1600),
    cashShiftService.closeShift(userId, 1700),
  ]);

  // Exactly ONE should succeed
  const fulfilled = results.filter((r) => r.status === "fulfilled");
  expect(fulfilled.length).toBe(1);

  // Verify shift has consistent endAmount
  const closedShift = await prisma.cashShift.findFirst({
    where: { userId, endTime: { not: null } },
  });
  // The endAmount should be from the first successful request
  expect([1500, 1600, 1700]).toContain(Number(closedShift?.endAmount));
});
```

### El Fix

```typescript
// cashShift.service.ts - FIXED VERSION
async closeShift(userId: number, endAmount: number) {
    // FIX RC-005: Entire operation in transaction
    return await prisma.$transaction(async (tx) => {
        const currentShift = await tx.cashShift.findFirst({
            where: { userId, endTime: null }
        });

        if (!currentShift) {
            throw new NotFoundError('No open shift found');
        }

        // Check tables inside transaction
        const openTables = await tx.table.count({
            where: { status: 'OCCUPIED' }
        });

        if (openTables > 0) {
            throw new ConflictError(`Cannot close shift. ${openTables} tables occupied.`);
        }

        return await tx.cashShift.update({
            where: { id: currentShift.id },
            data: { endTime: new Date(), endAmount }
        });
    }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
}
```

> [!IMPORTANT]
> El mismo patrón debe aplicarse a `closeShiftWithCount()` en L102-132.

---

## 🎯 ISSUE #3: ES-001 — Stock Deduction Error Swallowing

### El Bug

**Ubicación:** [webhookProcessor.ts L267-300](file:///d:/Proyectos/control_gastronomicoV2/backend/src/integrations/delivery/jobs/webhookProcessor.ts#L267-L300)

```typescript
// ACTUAL CODE - VULNERABLE
await executeIfEnabled('enableStock', async () => {
    const stockService = new StockMovementService();

    for (const item of orderItems) {
        const productIngredients = await prisma.productIngredient.findMany({
            where: { productId: item.productId }
        });

        for (const pi of productIngredients) {
            try {
                await stockService.register(
                    pi.ingredientId,
                    StockMoveType.SALE,
                    Number(pi.quantity) * item.quantity,
                    `Delivery Order #${createdOrder.orderNumber}`
                );
            } catch (stockError) {
                // ⚠️ ERROR SWALLOWED - Stock NEVER decremented
                logger.warn('Stock deduction failed', { ... });
            }
        }
    }
});
```

**Stimulus → Conflict:**

- Webhook crea orden exitosamente
- Stock service falla (ej: ingrediente no existe, DB timeout)
- Error loggeado como **warn** (no error)
- Inventario **NUNCA se descuenta**
- **Resultado:** Inventario desincronizado, sobre-venta de productos.

### Estrategia de Test (Jest)

```typescript
// __tests__/webhookProcessor.stock.test.ts
it("ES-001: should flag order when stock deduction fails", async () => {
  // Mock stock service to fail
  jest
    .spyOn(StockMovementService.prototype, "register")
    .mockRejectedValue(new Error("DB connection lost"));

  const order = await processNewOrder(
    mockNormalizedOrder,
    mockAdapter,
    "test-123",
  );

  // Order should be created but flagged
  const savedOrder = await prisma.order.findUnique({
    where: { id: order.id },
  });

  // Option A: Order should have a flag
  expect(savedOrder?.stockSyncStatus).toBe("FAILED");

  // Option B: A reconciliation record should exist
  const pendingReconciliation = await prisma.stockReconciliation.findFirst({
    where: { orderId: order.id, status: "PENDING" },
  });
  expect(pendingReconciliation).not.toBeNull();
});
```

### El Fix

**Opción A: Fail Fast (Rollback de orden si stock falla)**

```typescript
// webhookProcessor.ts - AGGRESSIVE FIX
// Move stock deduction INSIDE the main transaction
createdOrder = await prisma.$transaction(async (tx) => {
  // ... create order ...

  // Stock deduction inside transaction
  if (featureFlags.enableStock) {
    for (const item of orderItems) {
      const productIngredients = await tx.productIngredient.findMany({
        where: { productId: item.productId },
      });

      for (const pi of productIngredients) {
        await tx.ingredient.update({
          where: { id: pi.ingredientId },
          data: { stock: { decrement: Number(pi.quantity) * item.quantity } },
        });
      }
    }
  }

  return order;
});
// If stock fails, entire order is rolled back
```

**Opción B: Flag for Reconciliation (Preferida para Delivery)**

```typescript
// webhookProcessor.ts - SOFT FIX
let stockSyncStatus: "OK" | "FAILED" = "OK";

await executeIfEnabled("enableStock", async () => {
  try {
    // ... stock deduction logic ...
  } catch (stockError) {
    stockSyncStatus = "FAILED";
    logger.error("Stock deduction FAILED - flagging for reconciliation", {
      orderId: createdOrder.id,
      error:
        stockError instanceof Error ? stockError.stack : String(stockError),
    });
  }
});

// Update order with sync status
if (stockSyncStatus === "FAILED") {
  await prisma.order.update({
    where: { id: createdOrder.id },
    data: {
      internalNotes: `[STOCK_SYNC_FAILED] Manual reconciliation required`,
    },
  });
}
```

---

## 🎯 ISSUE #4: ES-002 — Platform Acceptance Error Swallowing

### El Bug

**Ubicación:** [webhookProcessor.ts L309-327](file:///d:/Proyectos/control_gastronomicoV2/backend/src/integrations/delivery/jobs/webhookProcessor.ts#L309-L327)

```typescript
// ACTUAL CODE - VULNERABLE
try {
    const estimatedPrepTime = 20;
    await adapter.acceptOrder(externalId, estimatedPrepTime);

    logger.info('Order accepted in platform', { ... });
} catch (acceptError) {
    // ⚠️ ERROR SWALLOWED - Order NOT accepted in platform
    logger.error('Failed to accept order in platform', { ... });
    // No re-throw, no retry, no notification
}
```

**Stimulus → Conflict:**

- Webhook recibido, orden creada en sistema interno
- `adapter.acceptOrder()` falla (timeout, API error, auth expired)
- Error loggeado pero **no hay acción**
- Plataforma (Rappi/Glovo) **no recibe confirmación**
- **Resultado:** Cliente recibe "pedido cancelado", cocina prepara comida → pérdida económica.

### Estrategia de Test (Jest)

```typescript
// __tests__/webhookProcessor.accept.test.ts
it("ES-002: should retry platform acceptance on failure", async () => {
  // Mock adapter to fail twice then succeed
  const acceptOrderMock = jest
    .spyOn(mockAdapter, "acceptOrder")
    .mockRejectedValueOnce(new Error("Timeout"))
    .mockRejectedValueOnce(new Error("Timeout"))
    .mockResolvedValueOnce(undefined);

  await processNewOrder(mockNormalizedOrder, mockAdapter, "test-123");

  // Should have been called 3 times (2 failures + 1 success)
  expect(acceptOrderMock).toHaveBeenCalledTimes(3);
});

it("ES-002: should mark order as acceptance_failed after max retries", async () => {
  jest
    .spyOn(mockAdapter, "acceptOrder")
    .mockRejectedValue(new Error("Platform down"));

  await processNewOrder(mockNormalizedOrder, mockAdapter, "test-123");

  // Order should be flagged
  const order = await prisma.order.findFirst({
    where: { externalId: mockNormalizedOrder.externalId },
  });
  expect(order?.platformAcceptanceStatus).toBe("FAILED");

  // Alert should be sent
  expect(alertService.sendCritical).toHaveBeenCalledWith(
    expect.stringContaining("Platform acceptance failed"),
  );
});
```

### El Fix

```typescript
// webhookProcessor.ts - FIXED VERSION
// 8. Accept order in platform WITH retries
const MAX_ACCEPT_RETRIES = 3;
let acceptanceSuccess = false;

for (let attempt = 1; attempt <= MAX_ACCEPT_RETRIES; attempt++) {
  try {
    const estimatedPrepTime = 20;
    await adapter.acceptOrder(externalId, estimatedPrepTime);
    acceptanceSuccess = true;

    logger.info("Order accepted in platform", {
      externalId,
      platform,
      attempt,
    });
    break; // Success, exit loop
  } catch (acceptError) {
    logger.warn("Platform acceptance attempt failed", {
      externalId,
      platform,
      attempt,
      maxRetries: MAX_ACCEPT_RETRIES,
      error:
        acceptError instanceof Error
          ? acceptError.message
          : String(acceptError),
    });

    if (attempt < MAX_ACCEPT_RETRIES) {
      // Exponential backoff: 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
}

// If all retries failed, flag order and alert
if (!acceptanceSuccess) {
  logger.error("CRITICAL: Platform acceptance failed after all retries", {
    externalId,
    platform,
    orderId: createdOrder.id,
  });

  await prisma.order.update({
    where: { id: createdOrder.id },
    data: {
      internalNotes: `[PLATFORM_ACCEPT_FAILED] Manual intervention required. Customer may have received cancellation!`,
    },
  });

  // TODO: Send alert to operations team
  // await alertService.sendCritical(`Order ${createdOrder.orderNumber} not accepted in ${platform}`);
}
```

---

## 📋 RESUMEN DE CAMBIOS

| Archivo                | Cambio                                         | Líneas Afectadas |
| ---------------------- | ---------------------------------------------- | ---------------- |
| `cashShift.service.ts` | Wrap `openShift()` en `$transaction`           | L42-70           |
| `cashShift.service.ts` | Wrap `closeShift()` en `$transaction`          | L73-96           |
| `cashShift.service.ts` | Wrap `closeShiftWithCount()` en `$transaction` | L102-132         |
| `webhookProcessor.ts`  | Flag orden si stock falla                      | L267-300         |
| `webhookProcessor.ts`  | Retry + flag para platform acceptance          | L309-327         |

---

## ⚠️ RIESGOS Y MITIGACIONES

| Riesgo                                                           | Mitigación                                                       |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| Serializable isolation puede causar deadlocks bajo carga extrema | Usar timeout corto (5s) y manejar `P2034` (transaction conflict) |
| Stock flag requiere nuevo campo en Order                         | Usar `internalNotes` existente como workaround temporal          |
| Retries en acceptOrder aumentan latencia                         | Ejecutar en background job, no bloquear worker principal         |

---

## ✅ CRITERIOS DE ACEPTACIÓN

- [ ] Test RC-004 pasa: 5 requests concurrentes → solo 1 shift creado
- [ ] Test RC-005 pasa: 3 cierres concurrentes → solo 1 cierre
- [ ] Test ES-001 pasa: Fallo de stock → orden flaggeada
- [ ] Test ES-002 pasa: 3 retries con backoff exponencial
- [ ] TypeScript compila sin errores
- [ ] No regresiones en tests existentes

---

_Plan pendiente de aprobación. No se ejecutará código hasta confirmación del usuario._
