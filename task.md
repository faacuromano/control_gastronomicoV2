# Sprint 1: Proveedores + Órdenes de Compra

## Fase 1: Modelo de Datos (Backend) 🏗️

### Sprint 1.1 - Schema y Migraciones
- [ ] Definir modelo `Supplier` en schema.prisma
- [ ] Definir modelo `PurchaseOrder` en schema.prisma
- [ ] Definir modelo `PurchaseOrderItem` en schema.prisma
- [ ] Definir enum `PurchaseStatus`
- [ ] Correr migración y verificar DB
- [ ] ✅ Checkpoint: `npx prisma db push` sin errores

### Sprint 1.2 - Servicios Backend (Suppliers)
- [ ] Crear `supplier.service.ts` - CRUD completo
- [ ] Crear `supplier.controller.ts` - validaciones Zod
- [ ] Crear `supplier.routes.ts` - rutas REST
- [ ] Registrar rutas en [app.ts](file:///d:/Proyectos/control_gastronomicoV2/backend/src/app.ts)
- [ ] ✅ Checkpoint: Compilación TypeScript sin errores

### Sprint 1.3 - Servicios Backend (Purchase Orders)
- [ ] Crear `purchaseOrder.service.ts` - CRUD
- [ ] Implementar método `receivePurchaseOrder()` - genera StockMovements
- [ ] Crear `purchaseOrder.controller.ts` - validaciones
- [ ] Crear `purchaseOrder.routes.ts`
- [ ] Registrar rutas en [app.ts](file:///d:/Proyectos/control_gastronomicoV2/backend/src/app.ts)
- [ ] ✅ Checkpoint: Build backend exitoso

---

## Fase 2: Frontend Suppliers 🎨

### Sprint 2.1 - Services y Types
- [ ] Crear `supplierService.ts` en frontend
- [ ] Definir interfaces TypeScript
- [ ] Implementar métodos HTTP (getAll, create, update, delete)
- [ ] ✅ Checkpoint: `tsc --noEmit` sin errores

### Sprint 2.2 - UI Suppliers
- [ ] Crear `SuppliersPage.tsx` en `modules/admin/pages`
- [ ] Tabla listado de proveedores
- [ ] Modal creación/edición
- [ ] Integrar con supplierService
- [ ] ✅ Checkpoint: Página se renderiza sin errores

### Sprint 2.3 - Navegación
- [ ] Agregar ruta `/admin/suppliers` en App.tsx
- [ ] Agregar link en AdminLayout.tsx
- [ ] Agregar ícono en navegación
- [ ] ✅ Checkpoint: Navegación funcional

---

## Fase 3: Frontend Purchase Orders 📦

### Sprint 3.1 - Services
- [ ] Crear `purchaseOrderService.ts`
- [ ] Definir interfaces TypeScript
- [ ] Implementar métodos HTTP
- [ ] ✅ Checkpoint: Compilación sin errores

### Sprint 3.2 - Lista de Órdenes
- [ ] Crear `PurchaseOrdersPage.tsx`
- [ ] Tabla con órdenes (número, proveedor, fecha, estado, total)
- [ ] Filtros por estado
- [ ] Botón "Nueva Orden"
- [ ] ✅ Checkpoint: Lista se muestra correctamente

### Sprint 3.3 - Creación de Orden
- [ ] Modal `CreatePurchaseOrderModal.tsx`
- [ ] Selector de proveedor
- [ ] Agregar items (ingrediente + cantidad + precio)
- [ ] Cálculo de totales automático
- [ ] ✅ Checkpoint: Se puede crear orden PENDING

### Sprint 3.4 - Recepción de Orden
- [ ] Modal `ReceivePurchaseOrderModal.tsx`
- [ ] Confirmar cantidades recibidas
- [ ] Llamar endpoint `/receive`
- [ ] Actualizar lista tras recepción
- [ ] ✅ Checkpoint: Stock se actualiza al recibir

---

## Fase 4: Testing y Refinamiento 🧪

### Sprint 4.1 - Validaciones y UX
- [ ] Validar que no se pueda recibir orden ya recibida
- [ ] Mensajes de error claros
- [ ] Loading states en modales
- [ ] Confirmaciones antes de eliminar
- [ ] ✅ Checkpoint: UX fluida sin bugs

### Sprint 4.2 - Integración Stock
- [ ] Verificar StockMovements se crean correctamente
- [ ] Verificar stock de ingredientes se incrementa
- [ ] Verificar historial en IngredientsPage
- [ ] ✅ Checkpoint: Stock fluye end-to-end

---

## Definición de "Done" ✅

Una tarea está completa cuando:
1. ✅ Código compila sin errores TypeScript
2. ✅ Backend build exitoso (`npm run build`)
3. ✅ Frontend build exitoso (`tsc --noEmit`)
4. ✅ Funcionalidad probada manualmente
5. ✅ Código sigue patrones existentes en el proyecto
