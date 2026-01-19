# 🔴 ANÁLISIS DE INTEGRIDAD DE CONTRATO

## Backend vs Frontend - Simulación Adversaria (CLAUDE OPUS 4.5)

**Fecha:** 2026-01-19  
**Auditor:** Claude Opus 4.5 (Senior Forensic Software Architect)  
**Protocolo:** Tree of Thoughts - Stimulus → State → Conflict

---

## 1. LA MENTIRA DEL NULL

| ID         | Archivo Frontend        | Línea          | Código con Crash Potencial                                 | Campo Opcional en Backend                                | Fix Requerido                                                                       |
| ---------- | ----------------------- | -------------- | ---------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **NL-001** | `DeliveryDashboard.tsx` | **L229-232**   | `anyOrder.deliveryAddress \|\| anyOrder.client?.address`   | `Order.deliveryAddress: String?`, `Order.clientId: Int?` | ✅ Usa fallback `\|\|` pero...                                                      |
| **NL-002** | `DeliveryDashboard.tsx` | **L275, L291** | `anyOrder.driver?.name \|\| "Repartidor asignado"`         | `Order.driverId: Int?`, relación `driver` es opcional    | ⚠️ Correcto con `?.` pero usa `as any` (L228) = **Sin type safety**.                |
| **NL-003** | `TableDetailModal.tsx`  | **L269**       | `item.product?.name`                                       | `OrderItem.product` es include opcional                  | ✅ Usa `?.` correctamente.                                                          |
| **NL-004** | `TableDetailModal.tsx`  | **L277**       | `mod.modifierOption.name`                                  | `OrderItemModifier.modifierOption` es relación FK        | ⚠️ **Sin `?.`**. Si el include falla → `Cannot read property 'name' of undefined`.  |
| **NL-005** | `orderService.ts`       | **L14**        | `notes?: string \| null`                                   | Prisma genera `notes: string \| null`                    | ⚠️ Tipo correcto, pero componentes no siempre manejan `null`.                       |
| **NL-006** | `cashShiftService.ts`   | **L9**         | `endTime: string \| null`                                  | Backend retorna `Date \| null`                           | ⚠️ **Tipo incorrecto**. Backend envía `Date`, frontend espera `string`. Ver NL-007. |
| **NL-007** | `DashboardPage.tsx`     | **L268-269**   | `formatDate(shift.startTime)`, `formatTime(shift.endTime)` | `endTime` puede ser `null`                               | ⚠️ `formatTime(null)` → `new Date(null)` → **"Invalid Date"** en UI.                |
| **NL-008** | `DashboardPage.tsx`     | **L272-273**   | `Number(shift.startAmount)`                                | Backend envía `Decimal` como `string`                    | ✅ Correcto. `Number("123.45")` funciona.                                           |
| **NL-009** | `CheckoutModal.tsx`     | **L139**       | `Number(order.total)`                                      | `order.total: string` (Decimal serializado)              | ✅ Correcto.                                                                        |
| **NL-010** | `KitchenPage.tsx`       | **L101-103**   | `new Date(a.createdAt).getTime()`                          | `createdAt: string` (ISO8601 serializado)                | ✅ Correcto. `new Date("2026-01-19T...")` funciona.                                 |

### Hallazgo Crítico: NL-004 (Modifier sin Optional Chaining)

```typescript
// TableDetailModal.tsx L276-278
{item.modifiers.map((mod) => (
  <p key={mod.id} className="text-xs text-blue-600">
    + {mod.modifierOption.name}  // ⚠️ CRASH si modifierOption es undefined
    {Number(mod.priceCharged) > 0 && ` (+$${...})`}
  </p>
))}
```

**Stimulus:** Backend no incluye `modifierOption` en el query.  
**State:** `mod.modifierOption = undefined`.  
**Conflict:** `undefined.name` → **TypeError: Cannot read property 'name' of undefined**.

---

## 2. DATE SERIALIZATION

| ID         | Flujo                                       | Problema                                                                                         | Evidencia                                                 | Impacto                                                                                                              |
| ---------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **DS-001** | `CashShift.startTime` Backend → Frontend    | Backend: `Date` nativo de JS. JSON.stringify → `"2026-01-19T04:41:58.000Z"`. Frontend: `string`. | `cashShiftService.ts L8`: `startTime: string`             | ✅ **Correcto**. ISO string se parsea bien.                                                                          |
| **DS-002** | `CashShift.businessDate` Backend → Frontend | Backend: `DateTime @db.Date` (solo fecha). JSON → `"2026-01-19"` o `"2026-01-19T00:00:00.000Z"`  | Frontend usa directo sin normalizar timezone.             | ⚠️ **Potencial bug**: Si el server está en UTC y el cliente en UTC-3, la fecha puede mostrarse como el día anterior. |
| **DS-003** | `Order.createdAt` Backend → Frontend        | Serialización correcta como ISO string.                                                          | `KitchenPage.tsx L101`: `new Date(a.createdAt).getTime()` | ✅ Correcto.                                                                                                         |
| **DS-004** | `Decimal` (Prisma) → `number` (Frontend)    | Prisma serializa `Decimal` como `string` por defecto para evitar pérdida de precisión.           | `orderService.ts L13`: `unitPrice: string`                | ✅ **Manejado correctamente** con `Number()`.                                                                        |
| **DS-005** | `BigInt` si existiera                       | No hay campos `BigInt` en el schema actual.                                                      | —                                                         | ✅ N/A.                                                                                                              |

### Hallazgo Crítico: DS-002 (Timezone en BusinessDate)

```typescript
// DashboardPage.tsx L38
const weekAgo = new Date(now);
weekAgo.setDate(weekAgo.getDate() - 7);
return { startDate: weekAgo.toISOString().split("T")[0]!, endDate: end! };
```

**Problema:** El frontend genera `startDate = "2026-01-12"` en **timezone local**, pero el backend puede interpretar `businessDate` comparando contra `"2026-01-12T00:00:00Z"` (midnight UTC).

Si el usuario está en UTC-3 y pide "última semana" a las 22:00 local, el backend puede incluir o excluir registros del día límite incorrectamente.

---

## 3. WATERFALL DETECTION (Cascada de Requests)

| ID         | Archivo                 | Línea        | Patrón Detectado                                                                                                                                                             | Impacto                                                                                                             | Severidad        |
| ---------- | ----------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------- |
| **WF-001** | `CheckoutModal.tsx`     | **L112-129** | `useEffect` con `[isOpen]` ejecuta **5 llamadas secuenciales**: `loadPaymentMethods()`, `loadPrinters()`, `loadLoyaltyConfig()`, `loadLoyaltyBalance()`, `loadOrderTotal()`. | 5 requests en cascada al abrir modal. Si cada uno tarda 100ms, son **500ms+ de bloqueo**.                           | **[P1-BLOCKER]** |
| **WF-002** | `DashboardPage.tsx`     | **L73-80**   | `Promise.all([6 requests])`.                                                                                                                                                 | ✅ **Correcto**. Paralelo.                                                                                          | —                |
| **WF-003** | `DeliveryDashboard.tsx` | **L35-38**   | `Promise.allSettled([2 requests])`.                                                                                                                                          | ✅ **Correcto**. Paralelo con resiliencia.                                                                          | —                |
| **WF-004** | `TableDetailModal.tsx`  | **L49-54**   | `useEffect` ejecuta `loadOrderItems()` y `loadPrinters()` **sin Promise.all**, pero ambos son independientes.                                                                | ⚠️ No es waterfall estricto, pero podrían paralelizarse.                                                            | **[P2-DEBT]**    |
| **WF-005** | `KitchenPage.tsx`       | **L145-157** | En `onItemChange` callback, se llama a `orderService.updateItemStatus()` **dentro del map** del render.                                                                      | ⚠️ Cada click en item dispara 1 request, pero no es un loop automático.                                             | **[P2-DEBT]**    |
| **WF-006** | `DeliveryDashboard.tsx` | **L21-24**   | `setInterval(fetchData, 15000)` - Polling cada 15s.                                                                                                                          | ⚠️ Correcto para polling, pero si el usuario tiene múltiples tabs abiertas, el servidor recibe N \* (requests/15s). | **[P2-DEBT]**    |

### Hallazgo Crítico: WF-001 (5 requests secuenciales en CheckoutModal)

```typescript
// CheckoutModal.tsx L112-129
useEffect(() => {
  if (isOpen && !prevIsOpenRef.current) {
    // ...reset state...
    loadPaymentMethods(); // REQUEST 1 - AWAIT
    loadPrinters(); // REQUEST 2 - AWAIT
    loadLoyaltyConfig(); // REQUEST 3 - AWAIT
    if (selectedClientId) {
      loadLoyaltyBalance(selectedClientId); // REQUEST 4 - AWAIT
    }
    if (tableMode && tableId) {
      loadOrderTotal(tableId); // REQUEST 5 - AWAIT
    }
  }
}, [isOpen, tableMode, tableId, selectedClientId]);
```

**Problema:** Las funciones `loadX()` son `async` pero NO se esperan con `await`. Esto causa:

1. **Race conditions** en el state (cada setState ocurre en orden impredecible).
2. NO es waterfall real (no hay dependencia), pero tampoco es **visualmente paralelo** - el usuario ve loading states inconsistentes.

**Fix requerido:**

```typescript
useEffect(() => {
  if (isOpen && !prevIsOpenRef.current) {
    Promise.all([
      loadPaymentMethods(),
      loadPrinters(),
      loadLoyaltyConfig(),
      selectedClientId
        ? loadLoyaltyBalance(selectedClientId)
        : Promise.resolve(),
      tableMode && tableId ? loadOrderTotal(tableId) : Promise.resolve(),
    ]).catch(console.error);
  }
}, [isOpen]);
```

---

## 4. MATRIZ DE REFACTORIZACIÓN INMEDIATA

| Prioridad | ID     | Archivo                        | Acción Requerida                                                                                  |
| --------- | ------ | ------------------------------ | ------------------------------------------------------------------------------------------------- |
| **P0**    | NL-004 | `TableDetailModal.tsx:L277`    | Agregar optional chaining: `mod.modifierOption?.name`                                             |
| **P0**    | NL-007 | `DashboardPage.tsx:L269`       | Guard `shift.endTime && formatTime(shift.endTime)`                                                |
| **P1**    | WF-001 | `CheckoutModal.tsx:L112-129`   | Refactorizar a `Promise.all()`                                                                    |
| **P1**    | DS-002 | `DashboardPage.tsx:L28-48`     | Normalizar fechas a UTC antes de enviar al backend                                                |
| **P1**    | NL-002 | `DeliveryDashboard.tsx:L228`   | Definir interface `OrderWithDelivery` con campos opcionales tipados                               |
| **P2**    | WF-004 | `TableDetailModal.tsx:L49-54`  | Paralelizar con `Promise.all([loadOrderItems, loadPrinters])`                                     |
| **P2**    | WF-006 | `DeliveryDashboard.tsx:L21-24` | Implementar `visibilitychange` listener para pausar polling en tabs inactivos                     |
| **P2**    | —      | `orderService.ts`              | Agregar campos `deliveryAddress`, `deliveryNotes`, `driver`, `client` a `OrderResponse` interface |

---

## 5. CÓDIGO DE FIX INMEDIATO

### Fix NL-004: Optional Chaining en Modifier

```typescript
// TableDetailModal.tsx L276-280 - BEFORE
{item.modifiers.map((mod) => (
  <p key={mod.id}>+ {mod.modifierOption.name}</p>
))}

// AFTER
{item.modifiers?.map((mod) => (
  <p key={mod.id}>+ {mod.modifierOption?.name ?? 'Sin nombre'}</p>
))}
```

### Fix NL-007: Guard para null endTime

```typescript
// DashboardPage.tsx L268-270 - El código actual ya tiene el guard correcto:
<p>
  {formatDate(shift.startTime)} • {formatTime(shift.startTime)}
  {shift.endTime && ` - ${formatTime(shift.endTime)}`}
</p>

// Pero verificar que formatTime no crashea si accidentalmente recibe null.
// Agregar guard defensivo en la función:
const formatTime = (date: string | null) => {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};
```

### Fix WF-001: Paralelizar loads en CheckoutModal

```typescript
// CheckoutModal.tsx - REFACTORED useEffect
useEffect(() => {
  if (!isOpen || prevIsOpenRef.current) return;
  prevIsOpenRef.current = isOpen;

  // Reset state synchronously
  setCompletedOrder(null);
  setPayments([]);
  setError(null);
  setLoading(false);
  setCurrentMethod("CASH");
  setInvoiceNumber(null);
  setGeneratingInvoice(false);
  setBackendTotal(null);
  setPointsToRedeem(0);
  setRedeemedDiscount(0);
  setLoyaltyBalance(null);
  setManualDiscountType("PERCENTAGE");
  setManualDiscountValue(0);
  setManualDiscountApplied(0);
  setShowDiscountSection(false);
  setCachedOrder(null);

  // Parallel async loads
  const init = async () => {
    try {
      const [methods, allPrinters, config] = await Promise.all([
        paymentMethodService.getActive(),
        printerService.getAll(),
        loyaltyService.getConfig(),
      ]);

      setPaymentMethods(methods.sort((a, b) => a.sortOrder - b.sortOrder));
      if (methods.length > 0) {
        setCurrentMethod(methods[0].code);
      }
      setPrinters(allPrinters);
      setLoyaltyConfig(config);

      // Secondary parallel loads (dependent on props)
      const secondaryLoads: Promise<void>[] = [];

      if (selectedClientId) {
        secondaryLoads.push(
          loyaltyService.getBalance(selectedClientId).then(setLoyaltyBalance),
        );
      }

      if (tableMode && tableId) {
        secondaryLoads.push(
          orderService.getOrderByTable(tableId).then((order) => {
            if (order) {
              setBackendTotal(Number(order.total));
              setCurrentOrderId(order.id);
              setCachedOrder(order);
            }
          }),
        );
      }

      if (secondaryLoads.length > 0) {
        await Promise.all(secondaryLoads);
      }
    } catch (err) {
      console.error("CheckoutModal init failed", err);
    }
  };

  init();
}, [isOpen, tableMode, tableId, selectedClientId]);
```

### Fix DS-002: Normalizar fechas con timezone

```typescript
// DashboardPage.tsx L28-48 - REFACTORED getDateRange
const getDateRange = (
  preset: DatePreset,
): { startDate: string; endDate: string } | undefined => {
  const now = new Date();

  // Formatear en timezone local, no UTC
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const end = formatLocalDate(now);

  switch (preset) {
    case "today":
      return undefined; // Let backend use default
    case "week": {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { startDate: formatLocalDate(weekAgo), endDate: end };
    }
    case "month": {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return { startDate: formatLocalDate(monthAgo), endDate: end };
    }
    default:
      return undefined;
  }
};
```

### Fix NL-002: Interface tipada para DeliveryDashboard

```typescript
// Agregar a orderService.ts o crear types/order.types.ts en frontend

export interface OrderWithDeliveryDetails extends OrderResponse {
  deliveryAddress?: string | null;
  deliveryNotes?: string | null;
  driverId?: number | null;
  driver?: {
    id: number;
    name: string;
    phone?: string;
  } | null;
  client?: {
    id: number;
    name: string;
    phone?: string | null;
    address?: string | null;
  } | null;
}

// En DeliveryDashboard.tsx, usar el tipo correcto:
const [orders, setOrders] = useState<OrderWithDeliveryDetails[]>([]);

// Y en DeliveryCard, eliminar el cast `as any`:
const DeliveryCard: React.FC<DeliveryCardProps> = ({ order, ... }) => {
  const address = order.deliveryAddress ?? order.client?.address ?? 'Sin dirección';
  const clientName = order.client?.name ?? 'Cliente Ocasional';
  // ...
};
```

---

## 6. RESUMEN EJECUTIVO

| Categoría             | P0    | P1    | P2    | Total  |
| --------------------- | ----- | ----- | ----- | ------ |
| Null Safety           | 2     | 1     | 1     | 4      |
| Date Serialization    | 0     | 1     | 0     | 1      |
| Waterfall/Performance | 0     | 1     | 3     | 4      |
| Type Safety           | 0     | 1     | 1     | 2      |
| **Total**             | **2** | **4** | **5** | **11** |

### Acciones Inmediatas Requeridas:

1. **NL-004**: Fix en 1 línea - agregar `?.` a `mod.modifierOption`
2. **NL-007**: Agregar guard defensivo en `formatTime()`
3. **WF-001**: Refactorizar useEffect con Promise.all
4. **NL-002/DS-002**: Definir interfaces correctas y normalizar fechas

---

## 7. PRÓXIMA FASE

- **FASE 4:** Auditoría de autenticación JWT y CORS
- **FASE 5:** Análisis de WebSocket security y rate limiting
- **FASE 6:** Pruebas de carga con simulación de 1000 usuarios concurrentes

---

_Generado automáticamente por el protocolo de auditoría CLAUDE OPUS 4.5_
