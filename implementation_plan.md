# Plan de Implementación: Proveedores + Órdenes de Compra

> Siguiendo arquitectura existente y buenas prácticas del proyecto

---

## 📐 Análisis de Arquitectura Existente

### Patrones Identificados

| Aspecto | Patrón Actual | Aplicación |
|---------|---------------|------------|
| **Backend Structure** | Service → Controller → Routes | Replicar igual |
| **Validación** | Zod schemas en controllers | Usar Zod |
| **Error Handling** | Custom errors ([ValidationError](file:///d:/Proyectos/control_gastronomicoV2/backend/src/utils/errors.ts#25-31), [ConflictError](file:///d:/Proyectos/control_gastronomicoV2/backend/src/utils/errors.ts#65-71)) | Extender si necesario |
| **DB Access** | Prisma ORM con transacciones | Seguir patrón |
| **Frontend Services** | Clase con métodos async + axios | Mantener estilo |
| **UI Components** | Funcional React + TailwindCSS | Mismo stack |
| **State Management** | useState local (sin Zustand para CRUD) | Sin estado global |
| **Modales** | Inline en página con state boolean | Mismo patrón |

---

## 🗂️ Estructura de Archivos Propuesta

```
backend/
├── prisma/
│   └── schema.prisma                  # +3 modelos, +1 enum
├── src/
│   ├── controllers/
│   │   ├── supplier.controller.ts     # NUEVO
│   │   └── purchaseOrder.controller.ts # NUEVO
│   ├── services/
│   │   ├── supplier.service.ts        # NUEVO
│   │   └── purchaseOrder.service.ts   # NUEVO
│   └── routes/
│       ├── supplier.routes.ts         # NUEVO
│       └── purchaseOrder.routes.ts    # NUEVO

frontend/
├── src/
│   ├── services/
│   │   ├── supplierService.ts         # NUEVO
│   │   └── purchaseOrderService.ts    # NUEVO
│   └── modules/
│       └── admin/
│           └── pages/
│               ├── SuppliersPage.tsx           # NUEVO
│               ├── PurchaseOrdersPage.tsx      # NUEVO
│               └── components/
│                   ├── CreatePurchaseOrderModal.tsx  # NUEVO
│                   └── ReceivePurchaseOrderModal.tsx # NUEVO
```

---

## 🏗️ Fase 1: Backend - Data Model

### Prisma Schema Additions

```prisma
model Supplier {
  id            Int             @id @default(autoincrement())
  name          String
  phone         String?
  email         String?
  address       String?
  taxId         String?         // CUIT/RUT
  purchaseOrders PurchaseOrder[]
  isActive      Boolean         @default(true)
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  
  @@index([name])
}

model PurchaseOrder {
  id          Int                  @id @default(autoincrement())
  orderNumber Int                  @unique
  supplierId  Int
  supplier    Supplier             @relation(fields: [supplierId], references: [id])
  status      PurchaseStatus       @default(PENDING)
  subtotal    Decimal              @default(0) @db.Decimal(10, 2)
  total       Decimal              @default(0) @db.Decimal(10, 2)
  notes       String?              @db.Text
  orderedAt   DateTime             @default(now())
  receivedAt  DateTime?
  items       PurchaseOrderItem[]
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt
  
  @@index([supplierId])
  @@index([status])
  @@index([orderedAt])
}

model PurchaseOrderItem {
  id              Int           @id @default(autoincrement())
  purchaseOrderId Int
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  ingredientId    Int
  ingredient      Ingredient    @relation(fields: [ingredientId], references: [id])
  quantity        Decimal       @db.Decimal(10, 4)
  unitCost        Decimal       @db.Decimal(10, 4)
  
  @@index([purchaseOrderId])
  @@index([ingredientId])
}

enum PurchaseStatus {
  PENDING    // Creada, esperando orden
  ORDERED    // Orden enviada a proveedor
  PARTIAL    // Recepción parcial
  RECEIVED   // Totalmente recibida
  CANCELLED  // Cancelada
}
```

### Relación con Ingredient

```prisma
// En modelo Ingredient existente, agregar:
model Ingredient {
  // ... campos existentes
  purchaseOrderItems PurchaseOrderItem[]  // AGREGAR
}
```

---

## 📦 Fase 2: Backend - Business Logic

### Supplier Service

**Archivo:** `backend/src/services/supplier.service.ts`

```typescript
import { prisma } from '../lib/prisma';
import { NotFoundError, ConflictError } from '../utils/errors';

export class SupplierService {
  async getAll() {
    return await prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
  }

  async getById(id: number) {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          orderBy: { orderedAt: 'desc' },
          take: 10
        }
      }
    });
    if (!supplier) throw new NotFoundError('Supplier');
    return supplier;
  }

  async create(data: SupplierCreateInput) {
    // Validar nombre único
    const existing = await prisma.supplier.findFirst({
      where: { name: data.name }
    });
    if (existing) {
      throw new ConflictError('Ya existe un proveedor con ese nombre');
    }
    
    return await prisma.supplier.create({ data });
  }

  async update(id: number, data: SupplierUpdateInput) {
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundError('Supplier');
    
    return await prisma.supplier.update({
      where: { id },
      data
    });
  }

  async delete(id: number) {
    // Verificar que no tenga órdenes
    const ordersCount = await prisma.purchaseOrder.count({
      where: { supplierId: id }
    });
    
    if (ordersCount > 0) {
      throw new ConflictError(
        `No se puede eliminar: el proveedor tiene ${ordersCount} órdenes de compra`
      );
    }
    
    // Soft delete
    return await prisma.supplier.update({
      where: { id },
      data: { isActive: false }
    });
  }
}

export const supplierService = new SupplierService();
```

### Purchase Order Service

**Archivo:** `backend/src/services/purchaseOrder.service.ts`

**Lógica clave:**
- CRUD básico
- `receivePurchaseOrder(id)` que:
  1. Valida que estado sea PENDING o ORDERED
  2. Crea StockMovements tipo PURCHASE
  3. Actualiza stock de ingredientes
  4. Marca orden como RECEIVED

```typescript
async receivePurchaseOrder(id: number) {
  return await prisma.$transaction(async (tx) => {
    // 1. Obtener orden con items
    const order = await tx.purchaseOrder.findUnique({
      where: { id },
      include: { items: true }
    });
    
    if (!order) throw new NotFoundError('Purchase Order');
    
    if (order.status === 'RECEIVED') {
      throw new ConflictError('La orden ya fue recibida');
    }
    
    // 2. Crear movimientos de stock
    const stockService = new StockMovementService();
    for (const item of order.items) {
      await stockService.register(
        item.ingredientId,
        StockMoveType.PURCHASE,
        Number(item.quantity),
        `Orden de Compra #${order.orderNumber}`,
        tx
      );
    }
    
    // 3. Marcar como recibida
    return await tx.purchaseOrder.update({
      where: { id },
      data: {
        status: 'RECEIVED',
        receivedAt: new Date()
      }
    });
  });
}
```

---

## 🎨 Fase 3: Frontend

### Supplier Service

**Archivo:** `frontend/src/services/supplierService.ts`

Siguiendo patrón de `ingredientService.ts`, `productService.ts`

### Purchase Order Service

**Archivo:** `frontend/src/services/purchaseOrderService.ts`

Método especial:
```typescript
async receive(id: number): Promise<void> {
  await api.post(`/purchase-orders/${id}/receive`);
}
```

---

## ✅ Checkpoints de Validación

### Backend
- [ ] Prisma migration sin errores
- [ ] `npm run build` exitoso
- [ ] Postman: CRUD suppliers funcional
- [ ] Postman: CRUD purchase orders funcional
- [ ] Postman: Receive order incrementa stock

### Frontend
- [ ] `tsc --noEmit` sin errores
- [ ] Página suppliers renderiza
- [ ] Página purchase orders renderiza
- [ ] Se puede crear proveedor
- [ ] Se puede crear orden
- [ ] Se puede recibir orden
- [ ] Stock se actualiza al recibir

---

## 🚀 Orden de Implementación

1. Backend Schema + Migration
2. Supplier Service + Controller + Routes
3. Purchase Order Service + Controller + Routes
4. Test backend con Postman
5. Frontend Supplier Service
6. Frontend SuppliersPage
7. Frontend Purchase Order Service
8. Frontend PurchaseOrdersPage
9. Test integración end-to-end
