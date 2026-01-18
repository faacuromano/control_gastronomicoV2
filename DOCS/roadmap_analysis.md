# Análisis del Codebase y Roadmap de Desarrollo

> 📅 Generado: 2026-01-16 | Basado en análisis de código, NO documentación

---

## 📊 Estado Actual del Sistema (Basado en Código)

### ✅ Módulos Implementados y Funcionales

| Módulo | Backend | Frontend | Estado |
|--------|---------|----------|--------|
| **Auth (Login/PIN)** | ✅ JWT + PIN | ✅ | Funcional |
| **Productos** | ✅ CRUD | ✅ | Funcional |
| **Categorías** | ✅ CRUD | ✅ | Funcional |
| **Ingredientes** | ✅ CRUD | ✅ | Funcional |
| **Modificadores** | ✅ CRUD | ✅ | Funcional |
| **Stock Movements** | ✅ Manual | ✅ Historial | Solo manual |
| **Órdenes/Ventas** | ✅ Completo | ✅ POS | Funcional |
| **Mesas/Áreas** | ✅ CRUD + D&D | ✅ | Funcional |
| **Clientes** | ✅ CRUD | ✅ | Funcional |
| **Caja (Turnos)** | ✅ Open/Close | ✅ | Funcional |
| **Pagos** | ✅ Split payments | ✅ | Funcional |
| **KDS (Cocina)** | ✅ WebSocket | ✅ | Funcional |
| **Delivery Dashboard** | ✅ Básico | ✅ | Funcional |
| **Impresoras** | ✅ CRUD | ⚠️ Parcial | Sin integración real |
| **Feature Flags** | ✅ TenantConfig | ✅ Settings | Funcional |

### ⚠️ Módulos Parcialmente Implementados

| Módulo | Lo que existe | Lo que falta |
|--------|---------------|--------------|
| **Roles** | CRUD básico, JSON permissions en DB | UI para editar permisos, RBAC no se aplica |
| **Stock Validation** | Validación pre-venta | UI preventiva en POS antes de agregar |
| **Impresión** | Modelo Printer, asignación a categorías | Integración ESC/POS real |

### ❌ Módulos NO Implementados (0% en código)

| Módulo | Prisma Schema | Backend | Frontend |
|--------|---------------|---------|----------|
| **Proveedores (Suppliers)** | ❌ | ❌ | ❌ |
| **Órdenes de Compra** | ❌ | ❌ | ❌ |
| **Analytics/Reportes** | ❌ | ❌ | ❌ |
| **Facturación (Invoices)** | ❌ | ❌ | ❌ |
| **Facturación Fiscal (AFIP)** | ❌ | ❌ | ❌ |
| **Gestión Métodos de Pago** | ❌ Enum hardcoded | ❌ | ❌ |
| **Integraciones Externas** | ❌ | ❌ | ❌ |

---

## 🎯 Roadmap Propuesto

### Sprint 1: Proveedores + Órdenes de Compra (Crítico para Stock)

**Justificación:** El stock actual va a negativo porque no hay forma de cargar compras de forma organizada.

#### Tareas Backend

1. **Prisma Schema:**
```prisma
model Supplier {
  id        Int      @id @default(autoincrement())
  name      String
  phone     String?
  email     String?
  address   String?
  taxId     String?  // CUIT
  orders    PurchaseOrder[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model PurchaseOrder {
  id          Int       @id @default(autoincrement())
  orderNumber Int       @unique
  supplierId  Int
  supplier    Supplier  @relation(fields: [supplierId], references: [id])
  status      PurchaseStatus @default(PENDING)
  subtotal    Decimal   @db.Decimal(10, 2)
  total       Decimal   @db.Decimal(10, 2)
  notes       String?
  receivedAt  DateTime?
  items       PurchaseOrderItem[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model PurchaseOrderItem {
  id              Int       @id @default(autoincrement())
  purchaseOrderId Int
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id])
  ingredientId    Int
  ingredient      Ingredient @relation(fields: [ingredientId], references: [id])
  quantity        Decimal   @db.Decimal(10, 4)
  unitCost        Decimal   @db.Decimal(10, 4)
}

enum PurchaseStatus {
  PENDING
  ORDERED
  PARTIAL
  RECEIVED
  CANCELLED
}
```

2. **Services/Controllers/Routes:**
   - `supplier.service.ts` - CRUD
   - `purchaseOrder.service.ts` - CRUD + `receive()` que actualiza stock
   - Rutas `/api/suppliers`, `/api/purchase-orders`

3. **Lógica de Recepción:**
   - Al marcar orden como RECEIVED, crear StockMovements tipo PURCHASE
   - Actualizar stock de ingredientes automáticamente

#### Tareas Frontend

- `SuppliersPage.tsx` - CRUD tabla
- `PurchaseOrdersPage.tsx` - Lista + Modal creación
- `PurchaseOrderDetailModal.tsx` - Agregar items, recibir stock

**Estimado:** 3-4 días

---

### Sprint 2: Analytics y Reportes Básicos

**Justificación:** Sin estadísticas el negocio opera a ciegas.

#### Métricas Prioritarias

1. **Ventas:**
   - Ventas por día/semana/mes
   - Ticket promedio
   - Productos más vendidos
   - Ventas por canal (POS, Delivery, QR)
   - Ventas por mozo

2. **Stock:**
   - Alertas de stock bajo
   - Ingredientes más consumidos
   - Costo de productos vendidos

3. **Caja:**
   - Resumen por turno
   - Métodos de pago utilizados

#### Implementación

- **Backend:** Endpoints con queries agregadas (GROUP BY, SUM)
- **Frontend:** Dashboard con gráficos (recharts o chart.js)

**Estimado:** 3-4 días

---

### Sprint 3: RBAC Completo (Permisos de Roles)

**Justificación:** El middleware [requirePermission](file:///d:/Proyectos/control_gastronomicoV2/backend/src/middleware/auth.ts#61-103) existe pero permissions están vacíos.

#### Tareas

1. **Backend:**
   - Endpoint `PUT /roles/:id/permissions` para actualizar permisos
   - Definir recursos estándar: `products`, `orders`, `stock`, `users`, etc.
   - Acciones: [create](file:///d:/Proyectos/control_gastronomicoV2/frontend/src/services/orderService.ts#59-63), `read`, [update](file:///d:/Proyectos/control_gastronomicoV2/backend/src/services/table.service.ts#24-31), [delete](file:///d:/Proyectos/control_gastronomicoV2/backend/src/services/table.service.ts#32-47), `*`

2. **Frontend:**
   - UI en Settings para editar permisos por rol
   - Matriz checkboxes: Recurso vs Acciones

3. **Aplicar middleware:**
   - Agregar [requirePermission('products', 'delete')](file:///d:/Proyectos/control_gastronomicoV2/backend/src/middleware/auth.ts#61-103) a rutas sensibles

**Estimado:** 2-3 días

---

### Sprint 4: Gestión de Métodos de Pago

**Justificación:** Actualmente PaymentMethod es un enum hardcoded.

#### Opciones

**Opción A - Enum Extensible (Rápido):**
- Agregar más valores al enum: `MERCADOPAGO`, `CUENTA_CORRIENTE`, etc.

**Opción B - Tabla Dinámica (Flexible):**
```prisma
model PaymentMethodConfig {
  id        Int     @id @default(autoincrement())
  name      String  // "Mercado Pago"
  code      String  @unique // "MERCADOPAGO"
  isActive  Boolean @default(true)
  icon      String? // lucide icon name
}
```

**Recomendación:** Opción B para máxima flexibilidad

**Estimado:** 1-2 días

---

### Sprint 5: Facturación (Comprobantes Internos)

**Justificación:** Generar recibos/facturas para clientes.

#### Modelo

```prisma
model Invoice {
  id           Int       @id @default(autoincrement())
  orderId      Int       @unique
  order        Order     @relation(fields: [orderId], references: [id])
  invoiceNumber String   @unique
  type         InvoiceType // RECEIPT, INVOICE_A, INVOICE_B
  clientTaxId  String?
  clientName   String?
  subtotal     Decimal
  tax          Decimal   @default(0)
  total        Decimal
  pdfUrl       String?
  fiscalCode   String?   // CAE para facturación fiscal
  createdAt    DateTime  @default(now())
}

enum InvoiceType {
  RECEIPT      // Ticket
  INVOICE_A    // Factura A (IVA Responsable)
  INVOICE_B    // Factura B (Consumidor Final)
  INVOICE_C    // Factura C (Monotributo)
}
```

**Estimado:** 2-3 días

---

### Sprint 6: Integración Fiscal (AFIP - Argentina)

> ⚠️ Requiere homologación y certificados digitales

**Prioridad:** BAJA hasta que facturación interna funcione

**Dependencias:**
- Sprint 5 completado
- Certificado digital AFIP
- Librería WSFE (ej: afip.js)

**Estimado:** 5-7 días + testing homologación

---

### Sprint 7: Integraciones Externas

**Opciones por prioridad:**

1. **Mercado Pago** - QR dinámico para cobros
2. **PedidosYa / Rappi** - Webhooks para recibir pedidos
3. **WhatsApp Business API** - Notificaciones de delivery

**Estimado:** Variable (2-5 días por integración)

---

## 📋 Orden de Prioridad Sugerido

| # | Sprint | Impacto | Esfuerzo | Prioridad |
|---|--------|---------|----------|-----------|
| 1 | **Proveedores + Compras** | 🔥 Crítico | Media | **HACER YA** |
| 2 | **Analytics Básicos** | Alto | Media | Alta |
| 3 | **RBAC Permisos** | Medio | Baja | Media |
| 4 | **Métodos de Pago** | Medio | Baja | Media |
| 5 | **Facturación Interna** | Medio | Media | Media |
| 6 | **Facturación Fiscal** | Variable | Alta | Baja* |
| 7 | **Integraciones** | Variable | Alta | Baja |

*Facturación fiscal sube a alta si es requerimiento legal inmediato

---

## ✅ Recomendación Inmediata

**Empezar con Sprint 1: Proveedores + Órdenes de Compra** porque:
1. El stock negativo es un problema real ahora
2. Sin esto, la validación de stock que implementamos es inútil
3. Es prerequisito para analytics de costos

¿Deseas que comience con la implementación del Sprint 1?
