# 🔴 REPORTE DE HALLAZGOS [P0-CATASTROPHIC]

## Simulación Adversaria - Nivel CLAUDE OPUS 4.5

**Fecha:** 2026-01-19  
**Auditor:** Claude Opus 4.5 (Senior Forensic Software Architect)  
**Protocolo:** Tree of Thoughts - Stimulus → State → Conflict (1000 requests)

---

## 1. RACE CONDITION CHECK

| ID         | Archivo                    | Línea        | Código Vulnerable                                                                                  | Stimulus → Conflict                                                                                                                                                                                                                                      |
| ---------- | -------------------------- | ------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RC-001** | `webhookProcessor.ts`      | **L440-445** | `await prisma.orderSequence.update({ where: { id: 1 }, data: { lastNumber: { increment: 1 } } })`  | **FUERA DE TRANSACCIÓN**. Webhook A y B llaman `getNextOrderNumber()` simultáneamente. Ambos obtienen mismo número si el UPDATE se ejecuta antes del CREATE de la orden. **Resultado: `orderNumber` duplicado → constraint violation → pedido perdido.** |
| **RC-002** | `webhookProcessor.ts`      | **L133-143** | Deduplicación con `findFirst` antes del `$transaction`                                             | **TOCTOU (Time of Check to Time of Use)**. Webhook A verifica `existingOrder = null`, Webhook B verifica `existingOrder = null`. Ambos crean orden. **Resultado: Pedido duplicado en el sistema.**                                                       |
| **RC-003** | `order.service.ts`         | **L210-215** | `await tx.table.update({ where: { id }, data: { status: 'OCCUPIED', currentOrderId: order.id } })` | Dentro de transacción pero **sin SELECT FOR UPDATE previo**. Mesero A y B abren orden en misma mesa. Ambas transacciones leen `status: FREE`, ambas actualizan. **Resultado: `currentOrderId` apunta a la segunda orden, primera orden huérfana.**       |
| **RC-004** | `cashShift.service.ts`     | **L50-59**   | `findFirst` + `create` en `openShift()`                                                            | **Sin transacción**. `findFirst` retorna null para ambos requests, ambos crean shift. **Resultado: Usuario con 2 turnos abiertos simultáneos → conciliación de caja imposible.**                                                                         |
| **RC-005** | `cashShift.service.ts`     | **L73-96**   | `closeShift()` - `getCurrentShift()` + `update()` separados                                        | **Sin transacción atómica**. Request A obtiene shift, Request B obtiene mismo shift. Ambos cierran. **Resultado: doble cierre con diferentes montos.**                                                                                                   |
| **RC-006** | `stockMovement.service.ts` | **L46-54**   | `tx.ingredient.update({ data: { stock: { increment } } })`                                         | **Correcto dentro de transacción**, pero cuando se llama desde `webhookProcessor.ts` L262-267 está **FUERA de transacción** envuelto en try/catch silencioso. **Resultado: Stock inconsistente si falla parcialmente.**                                  |

### Detalle Crítico: RC-001 (OrderSequence fuera de transacción)

```typescript
// webhookProcessor.ts L440-446
async function getNextOrderNumber(): Promise<number> {
  const result = await prisma.orderSequence.update({
    // ⚠️ FUERA DE TRANSACCIÓN
    where: { id: 1 },
    data: { lastNumber: { increment: 1 } },
  });
  return result.lastNumber;
}
```

**Contraste con order.service.ts L86:**

```typescript
// Correcto - dentro de transacción
const orderNumber = await orderNumberService.getNextOrderNumber(tx);
```

**El webhook processor NO pasa el contexto de transacción, causando:**

1. Número generado
2. Error en creación de orden (cualquier motivo)
3. Número "quemado" - hueco en secuencia

---

## 2. ERROR SWALLOWING (Promesas Zombies)

| ID         | Archivo                                                   | Línea                    | Código Vulnerable                                                          | Consecuencia                                                                                                                                               |
| ---------- | --------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ES-001** | `webhookProcessor.ts`                                     | **L268-275**             | `try { await stockService.register(...) } catch { logger.warn(...) }`      | **Stock NUNCA se descuenta si falla**. Log dice "warn" pero el pedido ya está creado. Inventario desincronizado silenciosamente.                           |
| **ES-002** | `webhookProcessor.ts`                                     | **L294-311**             | `try { await adapter.acceptOrder(...) } catch { logger.error(...) }`       | **Pedido aceptado en sistema interno pero rechazado en plataforma**. Cliente recibe notificación de cancelación, cocina prepara comida. Pérdida económica. |
| **ES-003** | `webhook.controller.ts`                                   | **L108-125**             | Error en `handleWebhook` retorna `200 OK` con `success: false`             | **La plataforma cree que el pedido fue procesado**. No reintentan. Pedido perdido para siempre.                                                            |
| **ES-004** | `stockAlert.service.ts` (llamado en L67 de stockMovement) | No visible pero inferido | `checkAndAlert()` ejecutado **después del return** del movimiento          | Si alerta falla, movimiento ya commitido. No hay rollback posible.                                                                                         |
| **ES-005** | `order.service.ts`                                        | **L238-244**             | `kdsService.broadcastNewOrder()` fuera de transacción                      | Si broadcast falla, orden existe pero cocina no la ve. Timeout del cliente.                                                                                |
| **ES-006** | `cashShift.service.ts`                                    | **L81-87**               | `openTables = await prisma.table.count({ where: { status: 'OCCUPIED' } })` | **Sin transacción**. Puede haber cierre de mesa en progreso. Count retorna 0, pero mesa se reabre antes que el shift cierre.                               |

### Detalle Crítico: ES-003 (Webhook responde 200 en error)

```typescript
// webhook.controller.ts L118-125
} catch (error) {
  // ...logging...

  // ⚠️ RESPONDE 200 INCLUSO EN ERROR
  return res.status(200).json({
    success: false,  // <-- La plataforma IGNORA esto
    requestId,
    message: 'Webhook received but processing failed. Will retry internally.',
  });
}
```

**Impacto:** Rappi/Glovo/PedidosYa usan status HTTP para determinar reintento. `200 OK` = éxito. El pedido **se pierde**.

---

## 3. INPUT POISONING (Inyección y Payload Bombing)

| ID         | Archivo                 | Línea        | Vector de Ataque                                                                     | Explotación                                                                                                                                                                                  |
| ---------- | ----------------------- | ------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **IP-001** | `order.controller.ts`   | **L161**     | `const tableId = Number(req.params.tableId)`                                         | `Number("0")` = 0, `Number("NaN")` = NaN. Si `tableId = 0` se pasa a Prisma, busca tabla con id=0 (no existe). **Pero** si hay SQL injection en otro lugar, `0 OR 1=1` podría pasar.         |
| **IP-002** | `webhook.controller.ts` | **L53**      | `platformCode = String(req.params.platform).toUpperCase()`                           | Sin validación contra whitelist. `platformCode = "CONSTRUCTOR"` o `"__PROTO__"` pasa al `AdapterFactory`. Dependiendo de implementación interna, **prototype pollution**.                    |
| **IP-003** | `hmac.middleware.ts`    | **L116**     | `req.parsedBody = JSON.parse(rawBody.toString('utf-8'))`                             | **Sin límite de profundidad de objeto**. Payload con 1000 niveles de anidación → **Stack Overflow / ReDoS**. `raw({ limit: '1mb' })` existe pero 1MB de JSON anidado es suficiente para DoS. |
| **IP-004** | `order.controller.ts`   | **L23-31**   | Zod schema valida `productId: z.number().int().positive()`                           | ✅ **Correcto**. `{ "productId": { "gt": 0 } }` falla validación. Sin embargo...                                                                                                             |
| **IP-005** | `webhookProcessor.ts`   | **L419-424** | `prisma.productChannelPrice.findFirst({ where: { externalSku: item.externalSku } })` | `externalSku` viene del payload del webhook **sin validación Zod**. Si `externalSku = { contains: "%" }`, Prisma podría interpretarlo como operador. **NoSQL-style injection en ORM**.       |
| **IP-006** | `cashShift.service.ts`  | **L252-258** | `filters.fromDate` usado directamente en `new Date(filters.fromDate)`                | Si `fromDate = "Invalid Date"`, `new Date()` retorna `Invalid Date`. Prisma puede fallar o devolver resultados inesperados.                                                                  |
| **IP-007** | `discount.service.ts`   | **L69-75**   | `DISCOUNT_TYPES.includes(input.type)`                                                | ✅ Correcto, pero `input.notes` L149 va directo a `auditService.log` sin sanitizar. XSS persistente si se muestra en dashboard.                                                              |

### Detalle Crítico: IP-005 (Webhook payload sin validación)

```typescript
// webhookProcessor.ts - El payload del webhook NO tiene Zod schema
const processedWebhook = adapter.parseWebhookPayload(payload); // L75

// Luego se usa directamente:
for (const item of items) {
  // items viene de payload no validado
  const channelPrice = await prisma.productChannelPrice.findFirst({
    where: {
      externalSku: item.externalSku, // ⚠️ DIRECTO DE PAYLOAD EXTERNO
      deliveryPlatformId: platformId,
    },
  });
}
```

**Payload malicioso:**

```json
{
  "items": [
    {
      "externalSku": { "$regex": ".*" },
      "quantity": 1
    }
  ]
}
```

Prisma con MySQL **no es vulnerable a este tipo específico**, pero el patrón es peligroso y podría explotar con futuros cambios.

---

## 4. MATRIZ DE RIESGO CONSOLIDADA

| ID     | Tipo             | Severidad | Probabilidad                 | Impacto                      | CVSS Estimado |
| ------ | ---------------- | --------- | ---------------------------- | ---------------------------- | ------------- |
| RC-001 | Race Condition   | **P0**    | Alta (webhooks concurrentes) | Pérdida de pedido            | 9.1           |
| RC-002 | Race Condition   | **P0**    | Alta                         | Pedido duplicado             | 8.5           |
| ES-003 | Error Swallowing | **P0**    | Media                        | Pérdida silenciosa de pedido | 9.0           |
| RC-003 | Race Condition   | **P1**    | Media                        | Mesa corrupta                | 7.5           |
| RC-004 | Race Condition   | **P1**    | Media                        | Doble turno                  | 7.0           |
| IP-003 | DoS              | **P1**    | Baja (requiere HMAC bypass)  | Servidor caído               | 6.5           |
| ES-001 | Error Swallowing | **P1**    | Alta                         | Inventario desincronizado    | 6.0           |
| IP-005 | Injection        | **P2**    | Baja                         | Indeterminado                | 5.0           |

---

## 5. RECOMENDACIONES INMEDIATAS

### RC-001: Mover `getNextOrderNumber` dentro de transacción

```typescript
// webhookProcessor.ts - FIX
const createdOrder = await prisma.$transaction(async (tx) => {
  const orderNumber = await tx.orderSequence.update({
    where: { id: 1 },
    data: { lastNumber: { increment: 1 } }
  });
  const order = await tx.order.create({
    data: { orderNumber: orderNumber.lastNumber, ... }
  });
  return order;
});
```

### RC-002: Usar `upsert` con constraint único

```typescript
// Usar externalId como clave única, no verificar antes
const order = await prisma.$transaction(async (tx) => {
  // Intentar crear, si existe devolver existente
  try {
    return await tx.order.create({
      data: { externalId, ... }
    });
  } catch (e) {
    if (e.code === 'P2002') { // Unique constraint violation
      return await tx.order.findUnique({ where: { externalId } });
    }
    throw e;
  }
});
```

### ES-003: Retornar 500 en errores

```typescript
// webhook.controller.ts - FIX
} catch (error) {
  logger.error('Webhook processing failed', { error });

  // ✅ CORRECTO: Retornar 500 para que la plataforma reintente
  return res.status(500).json({
    error: 'PROCESSING_FAILED',
    message: 'Internal error, please retry',
  });
}
```

### RC-004/RC-005: Envolver operaciones de CashShift en transacción

```typescript
// cashShift.service.ts - FIX
async openShift(userId: number, startAmount: number) {
  return await prisma.$transaction(async (tx) => {
    const existingShift = await tx.cashShift.findFirst({
      where: { userId, endTime: null }
    });

    if (existingShift) {
      throw new ConflictError('User already has an open shift');
    }

    return await tx.cashShift.create({
      data: { userId, startAmount, businessDate: this.getBusinessDate(new Date()) }
    });
  });
}
```

### IP-002: Validar platformCode contra whitelist

```typescript
// webhook.controller.ts - FIX
const VALID_PLATFORMS = ["RAPPI", "GLOVO", "PEDIDOSYA", "UBEREATS"] as const;

const rawPlatform = String(req.params.platform || "").toUpperCase();
if (!VALID_PLATFORMS.includes(rawPlatform as any)) {
  return res.status(400).json({ error: "UNKNOWN_PLATFORM" });
}
const platformCode = rawPlatform as DeliveryPlatformCode;
```

---

## 6. PRÓXIMAS FASES

- **FASE 3:** Auditoría de autenticación JWT y middleware de permisos
- **FASE 4:** Revisión de configuración de CORS y WebSocket
- **FASE 5:** Pruebas de carga simulando 1000 requests concurrentes

---

_Generado automáticamente por el protocolo de auditoría CLAUDE OPUS 4.5_
