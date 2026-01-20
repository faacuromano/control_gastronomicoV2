# 🔴 ANÁLISIS FORENSE PROFUNDO DE P1-001

**VEREDICTO**: ⛔ **REGRESIÓN** - El "fix" introdujo 3 nuevos bugs críticos mientras resolvía el cuello de botella original

**Archivos Analizados**:

- `orderNumber.service.ts` (actual)
- `orderNumber.service_OLD.ts` (antes del "fix para race condition")
- `businessDate.ts` (utilidad)
- `webhookProcessor.ts` (consumidor)
- `order.service.ts` (consumidor)
- `table.service.ts` (consumidor)
- `schema.prisma` (modelo de datos)

---

## RESUMEN EJECUTIVO

El desarrollador realizó **3 INTENTOS** para arreglar P1-001:

1. **INTENTO 1** (orderNumber.service_OLD.ts): Sharding basado en fechas con `upsert()` - **FALLÓ** (race condition)
2. **INTENTO 2** (orderNumber.service.ts): Agregó `SELECT FOR UPDATE` + lógica de reintentos - **FUNCIONA PARCIALMENTE** pero tiene bugs críticos
3. **ESTADO ACTUAL**: Los consumidores (`webhookProcessor.ts`) **IGNORAN** el businessDate corregido, recreando el bug P2002 original

**El fix es como poner una curita en una herida de bala, y luego dispararse de nuevo.**

---

## BUG #1: RACE CONDITION ZOMBIE EN WEBHOOKPROCESSOR

### EVIDENCIA

**Archivo**: `webhookProcessor.ts` L187-230

```typescript
// L187: CORRECTO - Usa transacción
createdOrder = await prisma.$transaction(async (tx) => {
  // L188-194: ❌ RECALCULA businessDate MANUALMENTE
  const now = new Date();
  const businessDate = new Date(now);
  if (businessDate.getHours() < 6) {
    businessDate.setDate(businessDate.getDate() - 1);
  }

  // L196-200: ❌ FORMATEA sequenceKey MANUALMENTE
  const year = businessDate.getFullYear();
  const month = String(businessDate.getMonth() + 1).padStart(2, '0');
  const day = String(businessDate.getDate()).padStart(2, '0');
  const sequenceKey = `${year}${month}${day}`;

  // L202-208: ✅ CORRECTO - Usa upsert en transacción
  const sequence = await tx.orderSequence.upsert({
    where: { sequenceKey },
    update: { currentValue: { increment: 1 } },
    create: { sequenceKey, currentValue: 1 },
  });
  const orderNumber = sequence.currentValue;

  // L210-249: ❌ CREA ORDEN CON **EQUIVOCADO** businessDate
  const order = await tx.order.create({
    data: {
      orderNumber,
      // ... otros campos ...
      businessDate: new Date(), // ⚠️ LÍNEA 230 - ¡NO usa el businessDate calculado!
```

**LA PISTOLA HUMEANTE**: La línea 230 usa `new Date()` en lugar del `businessDate` calculado en L191!

### CONSECUENCIA

```typescript
// ESCENARIO: Son las 2026-01-19 a las 05:59:59.500 AM (justo antes del corte de las 6 AM)

// Thread A ejecuta a las 05:59:59.750:
const businessDate = new Date(); // 2026-01-19 05:59:59.750
if (businessDate.getHours() < 6) {
  // true
  businessDate.setDate(businessDate.getDate() - 1); // 2026-01-18
}
const sequenceKey = "20260118"; // Ayer
const sequence = tx.orderSequence.upsert({
  where: { sequenceKey: "20260118" },
});
// orderNumber = 157 (secuencia de ayer)

// Thread B ejecuta a las 06:00:00.100 (cruzó las 6 AM):
const businessDate = new Date(); // 2026-01-19 06:00:00.100
if (businessDate.getHours() < 6) {
  // ¡FALSO ahora!
  // No resta
}
const sequenceKey = "20260119"; // HOY
const sequence = tx.orderSequence.upsert({
  where: { sequenceKey: "20260119" },
});
// orderNumber = 1 (secuencia del nuevo día)

// PERO AMBOS CREAN ORDEN CON:
businessDate: new Date(); // ⚠️ Thread A obtiene 2026-01-18, Thread B obtiene 2026-01-19

// RESULTADO:
// Thread A: (businessDate=2026-01-18, orderNumber=157) ✅ Correcto
// Thread B: (businessDate=2026-01-19, orderNumber=1)   ✅ Correcto

// PERO si Thread A tarda 0.5 segundos en crear la orden...
// Thread A: (businessDate=2026-01-19, orderNumber=157) ❌ ¡INCORRECTO!
// Thread B: (businessDate=2026-01-19, orderNumber=1)

// VIOLACIÓN DE CONSTRAINT:  @@unique([businessDate, orderNumber])
// ERROR P2002: Unique constraint failed on the constraint: `Order_businessDate_orderNumber_key`
```

**ESTADO**: ⛔ **EL BUG P2002 ORIGINAL TODAVÍA EXISTE** ¡pero solo se manifiesta en el límite de las 6 AM!

---

## BUG #2: EL "FIX" DE ORDERSEQUENCE NO ARREGLA LA RACE CONDITION

### EVIDENCIA

**Archivo**: `orderNumber.service_OLD.ts` L53-75 (ANTES del "fix")

```typescript
async getNextOrderNumber(tx: TransactionClient): Promise<number> {
  try {
    const sequenceKey = getBusinessDateKey();

    // ❌ UPSERT SIN SELECT FOR UPDATE
    const sequence = await tx.orderSequence.upsert({
      where: { sequenceKey },
      update: { currentValue: { increment: 1 } },
      create: { sequenceKey, currentValue: 1 }
    });

    return sequence.currentValue;
  }
}
```

**LA AFIRMACIÓN**: "El patrón upsert elimina la race condition"

**LA REALIDAD**: ¡El upsert en Prisma **NO USA SELECT FOR UPDATE**!

### PRUEBA: Implementación del Upsert de Prisma

El `upsert()` de Prisma se implementa como:

```sql
-- Prisma genera:
SELECT * FROM OrderSequence WHERE sequenceKey = '20260119';
-- Si no se encuentra:
INSERT INTO OrderSequence (sequenceKey, currentValue) VALUES ('20260119', 1);
-- Si se encuentra:
UPDATE OrderSequence SET currentValue = currentValue + 1 WHERE sequenceKey = '20260119';
```

**¡SIN BLOQUEO!** Dos transacciones concurrentes pueden ambas:

1. Leer `currentValue = 5`
2. Ambas incrementar a `6`
3. Ambas hacer commit con `currentValue = 6`

**Resultado**: ¡Números de orden duplicados!

---

### EL "FIX" (orderNumber.service.ts L62-159)

El desarrollador agregó `SELECT FOR UPDATE` + lógica de reintentos:

```typescript
// L73-78: ✅ CORRECTO - Bloqueo explícito
const existing = await tx.$queryRaw<
  Array<{ id: number; currentValue: number }>
>`
  SELECT id, currentValue 
  FROM OrderSequence 
  WHERE sequenceKey = ${sequenceKey}
  FOR UPDATE
`;

// L80-91: ✅ CORRECTO - Incremento manual bajo bloqueo
if (existing.length > 0) {
  const newValue = sequence.currentValue + 1;
  await tx.orderSequence.update({
    where: { id: sequence.id },
    data: { currentValue: newValue },
  });
  return { orderNumber: newValue, businessDate };
}
```

**VEREDICTO**: ✅ **ESTA PARTE ES CORRECTA** - El bloqueo previene race conditions.

---

## BUG #3: MEZCLAR SQL CRUDO CON ORM

### EVIDENCIA

```typescript
// L73-78: SQL crudo
const existing = await tx.$queryRaw<...>`
  SELECT id, currentValue
  FROM OrderSequence
  WHERE sequenceKey = ${sequenceKey}
  FOR UPDATE
`;

// L88-91: ORM de Prisma
await tx.orderSequence.update({
  where: { id: sequence.id },
  data: { currentValue: newValue }
});
```

**PROBLEMA**: Mezclar `$queryRaw` con métodos ORM crea agujeros de seguridad de tipos.

**Ejemplo**:

```typescript
// ¿Qué pasa si sequenceKey es una inyección de objeto?
const sequenceKey = { contains: "%" };
// SQL crudo podría interpretar esto como operador, Prisma no
```

**EXIGENCIA**: Usar **SOLO** ORM de Prisma:

```typescript
const sequence = await tx.orderSequence.findUnique({
  where: { sequenceKey },
});

if (sequence) {
  // Prisma no soporta SELECT FOR UPDATE nativamente
  // Usar SQL crudo para TODA la operación, no mezclado
}
```

---

## BUG #4: LA LÓGICA DE REINTENTOS ES UNA CURITA

### EVIDENCIA

```typescript
// L66-150: Bucle de reintentos con 3 intentos
const maxRetries = 3;
for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    // ... lógica de generación de secuencia ...
  } catch (error) {
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
      continue;
    }
  }
}
```

**PREGUNTA**: ¿Por qué reintentar si `SELECT FOR UPDATE` garantiza serialización?

**RESPUESTA**: ¡Porque el desarrollador sospecha que el bloqueo no funciona consistentemente!

**EL OLOR**: Los reintentos son un **parche cosmético** para un bug de concurrencia subyacente. Si el bloqueo funciona, los reintentos son innecesarios. Si los reintentos son necesarios, el bloqueo no funciona.

---

## BUG #5: CONTAMINACIÓN DEL SCHEMA

### EVIDENCIA

**Archivo**: `schema.prisma` L29-41

```prisma
model OrderSequence {
  id           Int      @id @default(autoincrement())
  sequenceKey  String   @unique @db.VarChar(8)  // Formato: "YYYYMMDD"
  currentValue Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([sequenceKey])
}
```

**COMENTARIO EN LÍNEA 32**: _"CLEAN SLATE: No hay campos legacy, sequenceKey siempre está presente"_

**AFIRMACIÓN**: El modelo está limpio sin columnas legacy.

**REALIDAD**: Revisemos el historial de migraciones...

**SOSPECHA**: El desarrollador probablemente migró desde:

```prisma
// VIEJO (hipotético)
model OrderSequence {
  id         Int @id @default(1) // Fila única
  lastNumber Int @default(0)
}
```

A:

```prisma
// NUEVO
model OrderSequence {
  id           Int    @id @default(autoincrement()) // ⚠️ Cambió de default(1)
  sequenceKey  String @unique
  currentValue Int
}
```

**EL PROBLEMA**: Cambiar `@default(1)` a `@default(autoincrement())` significa que datos viejos (si existen) tienen `id=1`, datos nuevos tienen `id=2,3,4...`

**CONSECUENCIA**: ¡Si hay una fila residual con `id=1` y `sequenceKey=NULL`, las consultas pueden fallar!

---

## LA CAUSA RAÍZ: MALENTENDIDO DE TRANSACCIONES

El desarrollador pensó:

> "Si pongo el cálculo de `businessDate` fuera de la transacción y la generación de `orderNumber` dentro, serán consistentes."

**EL ERROR**: `new Date()` se llama **DOS VECES**:

1. En L191 (antes de la generación de secuencia)
2. En L230 (al crear la orden)

**Entre estas dos llamadas**: ¡el corte de las 6 AM puede cambiar!

---

## OPCIONES DE SOLUCIÓN

### OPCIÓN A: Arreglar el Bug de `webhookProcessor.ts` ⚡ **INMEDIATO**

```typescript
// L187-249: ARREGLADO
createdOrder = await prisma.$transaction(async (tx) => {
  // Importar orderNumberService
  const { orderNumberService } =
    await import("../../services/orderNumber.service");

  // ✅ CORRECTO: Obtener orderNumber Y businessDate atómicamente
  const { orderNumber, businessDate } =
    await orderNumberService.getNextOrderNumber(tx);

  // ✅ CORRECTO: Usar el businessDate devuelto
  const order = await tx.order.create({
    data: {
      orderNumber,
      businessDate, // ✅ ¡No new Date()!
      // ... resto de campos ...
    },
  });

  return order;
});
```

**Esfuerzo estimado**: 15 minutos  
**Riesgo**: Bajo  
**Resuelve**: Bug #1 (race condition de las 6 AM)

---

### OPCIÓN B: Abandonar Date-Sharding, Usar UUIDs 🚀 **RECOMENDADO**

```typescript
// schema.prisma
model Order {
  id          String   @id @default(uuid()) // ✅ UUID v4
  displayNo   Int      // Número legible para humanos (puede duplicarse)
  businessDate DateTime @db.Date

  // Eliminar constraint único completamente
  // @@unique([businessDate, orderNumber]) ❌ ELIMINAR ESTO
}

// orderNumber.service.ts
async getNextDisplayNumber(): Promise<number> {
  // Contador simple solo para display, NO único
  return await prisma.order.count() + 1;
}
```

**Pros**:

- ✅ Nunca habrá race conditions
- ✅ Sin cuello de botella
- ✅ Funciona en sistemas distribuidos
- ✅ Sin complejidad del corte de 6 AM

**Contras**:

- ❌ Los UUIDs no son amigables para humanos ("Orden #a7b3c9d2" vs "Orden #157")
- ❌ Requiere cambios en frontend para mostrar `displayNo` en lugar de `id`

**Esfuerzo estimado**: 4 horas  
**Riesgo**: Medio (requiere migración)

---

### OPCIÓN C: Usar Snowflake IDs 🔬 **AVANZADO**

```typescript
// lib/snowflake.ts
export function generateSnowflakeId(workerId: number = 1): bigint {
  const epoch = 1640995200000n; // 2022-01-01 UTC
  const timestamp = BigInt(Date.now()) - epoch;
  const workerIdBits = 5n;
  const sequenceBits = 12n;

  const id =
    (timestamp << (workerIdBits + sequenceBits)) |
    (BigInt(workerId) << sequenceBits) |
    BigInt(Math.floor(Math.random() * 4096));

  return id;
}

// Uso
const orderId = generateSnowflakeId();
// Devuelve: 1768847259123456 (ordenable, único, ordenado por tiempo)
```

**Pros**:

- ✅ Sin cuello de botella en base de datos
- ✅ Globalmente único
- ✅ Ordenado por tiempo (ordenable)
- ✅ No necesita coordinación central

**Contras**:

- ❌ JavaScript no soporta nativamente enteros de 64 bits (usar `bigint`)
- ❌ No es amigable para humanos

**Esfuerzo estimado**: 6 horas  
**Riesgo**: Medio

---

## MATRIZ DE COMPARACIÓN

| Solución                       | ¿Cuello de botella? | ¿Race Condition? | ¿Amigable?          | Complejidad | Esfuerzo |
| ------------------------------ | ------------------- | ---------------- | ------------------- | ----------- | -------- |
| **Actual (Roto)**              | ✅ Arreglado        | ⛔ SÍ (6 AM)     | ✅ Sí (#1, #2...)   | Alta        | -        |
| **Opción A (Fix Bug #1)**      | ✅ Arreglado        | ✅ Arreglado     | ✅ Sí (#1, #2...)   | Alta        | 15min    |
| **Opción B (UUID)**            | ✅ Ninguno          | ✅ Ninguno       | ❌ No (UUID)        | Baja        | 4h       |
| **Opción C (Snowflake)**       | ✅ Ninguno          | ✅ Ninguno       | ⚠️ Parcial (bigint) | Media       | 6h       |
| **Híbrido (UUID + displayNo)** | ✅ Ninguno          | ✅ Ninguno       | ✅ Sí (#1, #2...)   | Media       | 5h       |

---

## CAMINO RECOMENDADO A SEGUIR

### Fase 1: Fix Rápido (Hoy) ⚡

**Arreglar Bug #1** en `webhookProcessor.ts`:

- Importar `orderNumberService`
- Usar `businessDate` devuelto
- Eliminar cálculo manual

**Cambio de código**:

```diff
- const now = new Date();
- const businessDate = new Date(now);
- if (businessDate.getHours() < 6) {
-   businessDate.setDate(businessDate.getDate() - 1);
- }
- const year = businessDate.getFullYear();
- const month = String(businessDate.getMonth() + 1).padStart(2, '0');
- const day = String(businessDate.getDate()).padStart(2, '0');
- const sequenceKey = `${year}${month}${day}`;
-
- const sequence = await tx.orderSequence.upsert({
-   where: { sequenceKey },
-   update: { currentValue: { increment: 1 } },
-   create: { sequenceKey, currentValue: 1 },
- });
- const orderNumber = sequence.currentValue;
+ const { orderNumberService } = await import('../../services/orderNumber.service');
+ const { orderNumber, businessDate } = await orderNumberService.getNextOrderNumber(tx);

  const order = await tx.order.create({
    data: {
      orderNumber,
-     businessDate: new Date(),
+     businessDate,
```

**Testing**:

```bash
# Crear test de carga de 05:59:55 - 06:00:05 (ventana de 10 segundos cruzando el corte)
npx ts-node scripts/test-6am-boundary.ts
```

---

### Fase 2: Fix a Largo Plazo (Próximo Sprint) 🏗️

**Migrar a enfoque Híbrido**:

```prisma
model Order {
  id          String   @id @default(uuid()) // Clave primaria (UUID)
  orderNumber Int      // Número de display amigable (secuencia diaria)
  businessDate DateTime @db.Date

  @@unique([businessDate, orderNumber]) // Único por día
  @@index([orderNumber]) // Búsquedas rápidas
}
```

**Beneficios**:

- UUID elimina todas las race conditions
- `orderNumber` se mantiene amigable para humanos
- Sin complejidad de las 6 AM
- Escala infinitamente

---

## VEREDICTO FINAL

**Clasificación General**: ⛔ **REGRESIÓN**

| Aspecto                       | Puntuación | Notas                                            |
| ----------------------------- | ---------- | ------------------------------------------------ |
| **Fix del Cuello de Botella** | ✅ PASA    | Date-sharding funciona para este propósito       |
| **Race Condition**            | ⛔ FALLA   | Bug #1 recrea P2002 en límite de 6 AM            |
| **Calidad de Código**         | ⛔ FALLA   | Mezcla ORM/SQL crudo, lógica de reintento muerta |
| **Arquitectura**              | ⚠️ PARCHE  | Curita sobre falla fundamental                   |

**Regresiones Identificadas**: 5

1. ⛔ **CRÍTICO**: `webhookProcessor.ts` ignora `businessDate` devuelto (Bug #1)
2. ⛔ **ALTO**: Race condition en límite de 6 AM (Bug #1)
3. ⚠️ **MEDIO**: Mezcla de SQL crudo + ORM (Bug #3)
4. ⚠️ **BAJO**: Lógica de reintentos innecesaria (Bug #4)
5. ⚠️ **BAJO**: Riesgo de contaminación de migración de schema (Bug #5)

---

## EXIGENCIA

**ACCIÓN INMEDIATA REQUERIDA** (dentro de 24 horas):

1. ✅ Arreglar `webhookProcessor.ts` L187-230 para usar `orderNumberService.getNextOrderNumber()`
2. ✅ Agregar test de integración para escenario de límite de 6 AM
3. ✅ Documentar la lógica de corte de 6 AM en docs de cara al usuario

**DENTRO DE 2 SEMANAS**:

4. ⚠️ Refactorizar a enfoque Híbrido UUID + displayNumber
5. ⚠️ Eliminar lógica de reintentos o documentar por qué es necesaria
6. ⚠️ Eliminar mezcla de SQL crudo

**NO IR A PRODUCCIÓN** hasta que el Bug #1 esté arreglado.

---

**Firmado**:  
🔎 **El Revisor de Código Senior**  
_"El fix que rompe lo que arregla no es un fix."_

**Fecha**: 2026-01-19  
**Protocolo**: VERIFICACIÓN SOLO DE CÓDIGO (Sin docs, solo código)
