# 📋 CHANGELOG TÉCNICO - Remediación de Seguridad P0

**Fecha:** 2026-01-19  
**Branch:** `fix/audit-p0-critical`  
**Agente:** Claude Opus 4.5 (Senior Forensic Software Architect)

---

## Resumen de Remediaciones

| ID     | Severidad          | Archivo                 | Descripción                  |
| ------ | ------------------ | ----------------------- | ---------------------------- |
| RC-001 | 🔴 P0-CATASTROPHIC | `webhookProcessor.ts`   | OrderSequence en transacción |
| RC-002 | 🔴 P0-CATASTROPHIC | `webhookProcessor.ts`   | Deduplicación via constraint |
| ES-003 | 🔴 P0-CATASTROPHIC | `webhook.controller.ts` | Retornar 500 en errores      |
| P1-003 | 🔴 P0-CATASTROPHIC | `auth.ts`               | JWT algorithm explícito      |
| NL-004 | 🔴 P0-CATASTROPHIC | `TableDetailModal.tsx`  | Optional chaining            |

---

## Detalle de Cambios

### RC-001: Race Condition en OrderSequence

**Archivo:** `backend/src/integrations/delivery/jobs/webhookProcessor.ts`

**Problema:** `getNextOrderNumber()` se ejecutaba FUERA de la transacción, permitiendo que dos webhooks concurrentes obtuvieran el mismo número.

**Antes:**

```typescript
const orderNumber = await getNextOrderNumber(); // ⚠️ FUERA
const createdOrder = await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({
    data: { orderNumber, ... }
  });
});
```

**Después:**

```typescript
const createdOrder = await prisma.$transaction(async (tx) => {
  const sequence = await tx.orderSequence.update({
    where: { id: 1 },
    data: { lastNumber: { increment: 1 } },
  });
  const orderNumber = sequence.lastNumber; // ✅ DENTRO

  const order = await tx.order.create({
    data: { orderNumber, ... }
  });
});
```

**Verificación:** El incremento y la creación ahora son atómicos. Si la creación falla, el número se revierte.

---

### RC-002: TOCTOU en Deduplicación

**Archivo:** `backend/src/integrations/delivery/jobs/webhookProcessor.ts`

**Problema:** `findFirst` antes de la transacción permitía que dos webhooks pasaran la verificación simultáneamente.

**Antes:**

```typescript
const existingOrder = await prisma.order.findFirst({ where: { externalId } });
if (existingOrder) return; // ⚠️ TOCTOU vulnerable
await prisma.$transaction(...);
```

**Después:**

```typescript
try {
  await prisma.$transaction(async (tx) => {
    await tx.order.create({ data: { externalId, ... } });
  });
} catch (error) {
  if (error.code === 'P2002') { // Unique constraint
    return; // ✅ Idempotente
  }
  throw error;
}
```

**Verificación:** La base de datos garantiza unicidad atómicamente. P2002 = duplicado.

---

### ES-003: Pérdida Silenciosa de Pedidos

**Archivo:** `backend/src/integrations/delivery/webhooks/webhook.controller.ts`

**Problema:** Retornar 200 en errores impide que las plataformas reintenten.

**Antes:**

```typescript
catch (error) {
  return res.status(200).json({ success: false, ... }); // ⚠️ Plataforma no reintenta
}
```

**Después:**

```typescript
catch (error) {
  return res.status(500).json({ error: 'PROCESSING_FAILED', ... }); // ✅ Plataforma reintenta
}
```

**Verificación:** HTTP 5xx indica error al cliente. Rappi/Glovo reintentan automáticamente.

---

### P1-003: JWT Algorithm Confusion

**Archivo:** `backend/src/middleware/auth.ts`

**Problema:** Sin algoritmo explícito, un atacante podría enviar `alg: none` y bypasear la firma.

**Antes:**

```typescript
jwt.verify(token, JWT_SECRET, (err, decoded) => { ... });
```

**Después:**

```typescript
jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, decoded) => { ... });
```

**Verificación:** Solo se aceptan tokens firmados con HS256. `alg: none` es rechazado.

---

### NL-004: Crash por Null Access

**Archivo:** `frontend/src/modules/orders/tables/components/TableDetailModal.tsx`

**Problema:** `mod.modifierOption.name` crashea si la relación no está incluida.

**Antes:**

```tsx
+ {mod.modifierOption.name}
```

**Después:**

```tsx
+ {mod.modifierOption?.name ?? 'Modificador'}
```

**Verificación:** Optional chaining previene TypeError. Fallback provee UX graceful.

---

## Verificación Final

| Check               | Resultado               |
| ------------------- | ----------------------- |
| TypeScript Backend  | ✅ PASS                 |
| TypeScript Frontend | ✅ PASS                 |
| Git Branch          | `fix/audit-p0-critical` |

---

## Próximos Pasos

```bash
# Commit los cambios
git add .
git commit -m "fix: P0 critical security remediation (RC-001, RC-002, ES-003, P1-003, NL-004)"

# Push y crear PR
git push -u origin fix/audit-p0-critical
```

---

_Generado automáticamente por Claude Opus 4.5_
