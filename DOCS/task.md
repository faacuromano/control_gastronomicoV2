# Sprint 1: Proveedores + Órdenes de Compra

## Fase 1: Modelo de Datos (Prisma Schema)

### 1.1 - Modelo Supplier
- [ ] Crear modelo `Supplier` en Prisma schema
- [ ] Agregar campos: name, phone, email, address, taxId (CUIT), isActive
- [ ] Agregar relación con PurchaseOrder
- [ ] Ejecutar `prisma migrate dev`

### 1.2 - Modelo PurchaseOrder
- [ ] Crear modelo `PurchaseOrder` en Prisma schema
- [ ] Campos: orderNumber, supplierId, status, subtotal, total, notes, receivedAt
- [ ] Crear enum `PurchaseStatus` (PENDING, ORDERED, PARTIAL, RECEIVED, CANCELLED)
- [ ] Ejecutar migration

### 1.3 - Modelo PurchaseOrderItem
- [ ] Crear modelo `PurchaseOrderItem`
- [ ] Campos: purchaseOrderId, ingredientId, quantity, unitCost
- [ ] Agregar relación inversa en Ingredient
- [ ] Ejecutar migration final de Fase 1

**Checkpoint Fase 1:** `npm run build` backend exitoso ✓

---

## Fase 2: Backend - Suppliers

### 2.1 - Supplier Service
- [ ] Crear `supplier.service.ts`
- [ ] Implementar: getAll(), getById(), create(), update(), delete()
- [ ] Manejar soft delete (isActive = false) o hard delete

### 2.2 - Supplier Controller
- [ ] Crear `supplier.controller.ts`
- [ ] Zod schemas para validación
- [ ] Endpoints: GET, GET/:id, POST, PUT/:id, DELETE/:id

### 2.3 - Supplier Routes
- [ ] Crear `supplier.routes.ts`
- [ ] Registrar en `index.ts` bajo `/api/suppliers`
- [ ] Agregar authenticate middleware

**Checkpoint Fase 2:** Test manual con Postman/curl - CRUD suppliers ✓

---

## Fase 3: Backend - Purchase Orders

### 3.1 - PurchaseOrder Service (CRUD)
- [ ] Crear `purchaseOrder.service.ts`
- [ ] Implementar: getAll(), getById(), create(), update()
- [ ] Incluir items en consultas

### 3.2 - PurchaseOrder Service (Recepción)
- [ ] Implementar método `receive(orderId, items)`
- [ ] Crear StockMovements tipo PURCHASE por cada item
- [ ] Actualizar stock de ingredientes
- [ ] Cambiar status a RECEIVED/PARTIAL

### 3.3 - PurchaseOrder Controller
- [ ] Crear `purchaseOrder.controller.ts`
- [ ] Zod schemas para validación
- [ ] Endpoints: GET, GET/:id, POST, PUT/:id, POST/:id/receive

### 3.4 - PurchaseOrder Routes
- [ ] Crear `purchaseOrder.routes.ts`
- [ ] Registrar bajo `/api/purchase-orders`

**Checkpoint Fase 3:** Test recepción → stock incrementa ✓

---

## Fase 4: Frontend - UI

### 4.1 - Services Frontend
- [ ] Crear `supplierService.ts`
- [ ] Crear `purchaseOrderService.ts`

### 4.2 - Suppliers Page
- [ ] Crear `SuppliersPage.tsx` en admin/pages
- [ ] Tabla con lista de proveedores
- [ ] Modal crear/editar proveedor
- [ ] Botón eliminar

### 4.3 - Purchase Orders Page
- [ ] Crear `PurchaseOrdersPage.tsx`
- [ ] Tabla con órdenes de compra y status
- [ ] Filtros por status

### 4.4 - Purchase Order Detail Modal
- [ ] Modal para crear nueva orden
- [ ] Selector de proveedor
- [ ] Agregar items (ingredientes + cantidad + costo)
- [ ] Botón "Recibir Stock"

### 4.5 - Navegación
- [ ] Agregar rutas en App.tsx
- [ ] Agregar links en AdminLayout.tsx

**Checkpoint Fase 4:** E2E - Crear orden, recibir, verificar stock ✓

---

## Verificación Final

- [ ] Backend compila sin errores
- [ ] Frontend compila sin errores
- [ ] Flujo completo: Crear proveedor → Crear orden → Recibir → Stock positivo
- [ ] Ingredientes que estaban negativos ahora tienen stock correcto
