# Estado del Arte - PentiumPOS

**Fecha:** 15 Enero 2026 | **Generado por:** Análisis automático de código real

---

## 1. Estructura de Archivos Crítica

```
control_gastronomicoV2/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # 352 líneas, 20+ modelos
│   │   └── seed.ts                # Datos de prueba
│   ├── src/
│   │   ├── app.ts                 # Express app setup
│   │   ├── server.ts              # Entry point + Socket.IO
│   │   ├── controllers/           # 13 controllers
│   │   │   ├── auth.controller.ts
│   │   │   ├── cashShift.controller.ts
│   │   │   ├── category.controller.ts
│   │   │   ├── client.controller.ts
│   │   │   ├── delivery.controller.ts
│   │   │   ├── ingredient.controller.ts
│   │   │   ├── order.controller.ts
│   │   │   ├── product.controller.ts
│   │   │   ├── role.controller.ts
│   │   │   ├── stockMovement.controller.ts
│   │   │   ├── table.controller.ts
│   │   │   └── user.controller.ts
│   │   ├── services/              # 12 services (lógica de negocio)
│   │   │   ├── auth.service.ts
│   │   │   ├── cashShift.service.ts
│   │   │   ├── category.service.ts
│   │   │   ├── featureFlags.service.ts
│   │   │   ├── ingredient.service.ts
│   │   │   ├── kds.service.ts
│   │   │   ├── order.service.ts       # 578 líneas, core del sistema
│   │   │   ├── orderNumber.service.ts
│   │   │   ├── payment.service.ts
│   │   │   ├── product.service.ts
│   │   │   ├── stockMovement.service.ts
│   │   │   └── table.service.ts
│   │   ├── routes/                # 11 route files
│   │   │   ├── auth.routes.ts
│   │   │   ├── cashShift.routes.ts
│   │   │   ├── client.routes.ts
│   │   │   ├── config.routes.ts
│   │   │   ├── delivery.routes.ts
│   │   │   ├── inventory.routes.ts
│   │   │   ├── menu.routes.ts
│   │   │   ├── order.routes.ts
│   │   │   ├── role.routes.ts
│   │   │   ├── table.routes.ts
│   │   │   └── user.routes.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts            # JWT + RBAC
│   │   │   ├── error.ts
│   │   │   └── rateLimit.ts       # Rate limiting activo
│   │   ├── lib/
│   │   │   ├── prisma.ts
│   │   │   └── socket.ts          # Socket.IO singleton
│   │   └── utils/
│   │       ├── errors.ts
│   │       ├── logger.ts
│   │       └── response.ts
│   └── tests/                     # Unit tests
│       └── unit/
│           ├── auth.service.test.ts
│           └── order.service.test.ts
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                # Router principal, 100 líneas
│   │   ├── main.tsx               # Entry point
│   │   ├── context/
│   │   │   └── SocketContext.tsx  # WebSocket provider
│   │   ├── store/                 # Zustand stores
│   │   │   ├── auth.store.ts
│   │   │   ├── cash.store.ts
│   │   │   ├── kitchen.store.ts
│   │   │   └── pos.store.ts
│   │   ├── services/              # API clients (10 archivos)
│   │   │   ├── cashShiftService.ts
│   │   │   ├── categoryService.ts
│   │   │   ├── clientService.ts
│   │   │   ├── configService.ts
│   │   │   ├── ingredientService.ts
│   │   │   ├── orderService.ts
│   │   │   ├── productService.ts
│   │   │   ├── roleService.ts
│   │   │   ├── tableService.ts
│   │   │   └── userService.ts
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── auth/RouteGuard.tsx    # RBAC + Feature flags
│   │   │   ├── cash/
│   │   │   │   ├── OpenShiftModal.tsx
│   │   │   │   └── CloseShiftModal.tsx
│   │   │   ├── layout/
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── MainLayout.tsx
│   │   │   │   └── Sidebar.tsx
│   │   │   └── ui/                    # Shadcn components
│   │   ├── modules/
│   │   │   ├── admin/
│   │   │   │   ├── AdminLayout.tsx
│   │   │   │   ├── cash/CashShiftHistoryPage.tsx
│   │   │   │   ├── pages/
│   │   │   │   │   ├── ClientsPage.tsx
│   │   │   │   │   ├── IngredientsPage.tsx
│   │   │   │   │   └── SettingsPage.tsx
│   │   │   │   ├── products/
│   │   │   │   │   ├── CategoryList.tsx
│   │   │   │   │   ├── ProductList.tsx
│   │   │   │   │   └── components/ProductForm.tsx
│   │   │   │   ├── tables/
│   │   │   │   │   ├── TablesAdminPage.tsx
│   │   │   │   │   └── components/DraggableTable.tsx
│   │   │   │   └── users/UsersPage.tsx
│   │   │   ├── kitchen/
│   │   │   │   ├── components/KitchenTimer.tsx
│   │   │   │   └── pages/
│   │   │   │       ├── KitchenPage.tsx     # KDS Kanban
│   │   │   │       └── components/TicketCard.tsx
│   │   │   ├── orders/
│   │   │   │   ├── delivery/pages/DeliveryDashboard.tsx
│   │   │   │   ├── pos/
│   │   │   │   │   ├── components/
│   │   │   │   │   │   ├── CategoryTabs.tsx
│   │   │   │   │   │   ├── CheckoutModal.tsx
│   │   │   │   │   │   ├── ClientLookup.tsx
│   │   │   │   │   │   ├── DeliveryModal.tsx
│   │   │   │   │   │   ├── POSLayout.tsx
│   │   │   │   │   │   ├── ProductCard.tsx
│   │   │   │   │   │   ├── ProductGrid.tsx
│   │   │   │   │   │   ├── Receipt.tsx
│   │   │   │   │   │   └── ShoppingCart.tsx
│   │   │   │   │   └── pages/POSPage.tsx
│   │   │   │   └── tables/
│   │   │   │       ├── components/
│   │   │   │       │   ├── FloorPlanEditor.tsx
│   │   │   │       │   ├── TableDetailModal.tsx
│   │   │   │       │   └── TableMap.tsx
│   │   │   │       └── pages/TablePage.tsx
│   │   │   └── core/ui/Layout.tsx
│   │   └── pages/
│   │       ├── CashPage.tsx
│   │       └── auth/LoginPage.tsx
│   └── cypress/
│       └── e2e/
│           └── tables_dnd.cy.ts
```

---

## 2. Estado REAL de Features (verificado en código)

### ✅ COMPLETO Y FUNCIONAL

| Feature                | Backend | Frontend | Detalle                                                  |
| ---------------------- | ------- | -------- | -------------------------------------------------------- |
| **Login/Auth**         | ✅      | ✅       | JWT, bcrypt, `auth.service.ts`, `LoginPage.tsx`          |
| **RBAC**               | ✅      | ✅       | `RouteGuard.tsx` valida permisos y feature flags         |
| **Rate Limiting**      | ✅      | N/A      | `rateLimit.ts` en `/login`                               |
| **Categorías CRUD**    | ✅      | ✅       | `CategoryList.tsx`, API completa                         |
| **Productos CRUD**     | ✅      | ✅       | `ProductList.tsx`, `ProductForm.tsx`                     |
| **POS (Venta)**        | ✅      | ✅       | `POSPage.tsx` integrado con backend, carrito, checkout   |
| **Pagos**              | ✅      | ✅       | Single y Split payments en `payment.service.ts`          |
| **Cash Shifts**        | ✅      | ✅       | Apertura/Cierre, Arqueo Ciego, `cashShift.service.ts`    |
| **Tables CRUD**        | ✅      | ✅       | `table.service.ts`, `TablesAdminPage.tsx`                |
| **Tables DnD**         | ✅      | ✅       | `DraggableTable.tsx`, batch update posiciones            |
| **Tables Operativo**   | ✅      | ✅       | `TablePage.tsx`, `TableDetailModal.tsx`                  |
| **KDS (Cocina)**       | ✅      | ✅       | `KitchenPage.tsx` Kanban, WebSocket real-time            |
| **Type Safety**        | ✅      | ✅       | Debt eliminado. Strict typing en services/controllers.   |
| **Stock/Inventory**    | ✅      | ✅       | `stockMovement.service.ts`, `IngredientsPage.tsx`        |
| **Clientes CRUD**      | ✅      | ✅       | `ClientsPage.tsx`, `ClientLookup.tsx` en POS             |
| **Usuarios Admin**     | ✅      | ✅       | `UsersPage.tsx` (405 líneas, CRUD completo)              |
| **Roles Admin**        | ✅      | ✅       | Gestión roles en `UsersPage.tsx`                         |
| **Delivery Dashboard** | ✅      | ✅       | `DeliveryDashboard.tsx`, columnas status, asignar driver |
| **Feature Flags**      | ✅      | ✅       | `TenantConfig`, `featureFlags.service.ts`, `RouteGuard`  |
| **WebSocket**          | ✅      | ✅       | `socket.ts`, `SocketContext.tsx`, eventos KDS            |
| **Settings UI**        | ✅      | ✅       | `SettingsPage.tsx` edita TenantConfig                    |
| **Cash History**       | ✅      | ✅       | `CashShiftHistoryPage.tsx`                               |

### 🟡 PARCIAL / MENOR DETALLE

| Feature                         | Estado           | Detalle                                          |
| ------------------------------- | ---------------- | ------------------------------------------------ |
| **Modificadores**               | Backend ✅, UI ? | Schema soporta, no verificado en UI              |
| **Recetas (RECIPE type)**       | Backend ✅       | `ProductIngredient` en schema, consumo en orders |
| **Impresión Tickets**           | ❌               | No hay código de integración con impresoras      |
| **Reportes/Analytics**          | ❌               | No hay páginas de reportes en frontend           |
| **Integraciones Delivery Apps** | ❌               | `OrderChannel` soporta pero no hay webhooks      |

---

## 3. Arquitectura Actual

### Stack

| Capa            | Tecnología                                   |
| --------------- | -------------------------------------------- |
| **Frontend**    | React 18, Vite, TypeScript                   |
| **State**       | Zustand (4 stores: auth, cash, kitchen, pos) |
| **Routing**     | React Router v6                              |
| **HTTP Client** | Axios (axios instance en services)           |
| **Styling**     | TailwindCSS + Shadcn/UI                      |
| **Real-time**   | Socket.IO client                             |
| **Backend**     | Node.js + Express + TypeScript               |
| **ORM**         | Prisma 5                                     |
| **Database**    | MySQL                                        |
| **Auth**        | JWT (jsonwebtoken) + bcrypt                  |
| **Real-time**   | Socket.IO server                             |
| **Validation**  | Zod (parcial)                                |
| **Testing**     | Jest                                         |

### Patrones Usados

1. **Modular Monolith** - Todo en un repo, pero separado por dominio
2. **Service Layer** - Controllers delegan a services
3. **Feature Flags** - `TenantConfig` controla módulos (enableStock, enableKDS, etc.)
4. **Protected Routes** - `RouteGuard` valida permisos + flags
5. **WebSocket Rooms** - `kitchen` room para KDS broadcasts
6. **Transacciones** - `prisma.$transaction` en operaciones críticas
7. **Zustand Stores** - Estado global minimalista

### API Routes (principales)

```
POST   /api/v1/auth/login
POST   /api/v1/auth/login-pin
GET    /api/v1/auth/me

GET    /api/v1/menu/categories
POST   /api/v1/menu/categories
GET    /api/v1/menu/products
POST   /api/v1/menu/products

GET    /api/v1/orders
POST   /api/v1/orders
GET    /api/v1/orders/kds
PATCH  /api/v1/orders/:id/status
PATCH  /api/v1/orders/:id/items

GET    /api/v1/tables
POST   /api/v1/tables
PATCH  /api/v1/tables/batch
POST   /api/v1/tables/:id/open
POST   /api/v1/tables/:id/close

GET    /api/v1/cash-shifts/current
POST   /api/v1/cash-shifts/open
POST   /api/v1/cash-shifts/close
POST   /api/v1/cash-shifts/close-with-count

GET    /api/v1/inventory/ingredients
POST   /api/v1/inventory/ingredients
POST   /api/v1/inventory/movements

GET    /api/v1/users
POST   /api/v1/users
GET    /api/v1/roles

GET    /api/v1/clients/search
POST   /api/v1/clients

GET    /api/v1/delivery/orders
PATCH  /api/v1/delivery/:id/assign

GET    /api/v1/config/features
PUT    /api/v1/config
```

---

## 4. Deuda Técnica Conocida

### Type Safety

✅ **Resuelto (Enero 2026)**: Se han eliminado más de 28 instancias de `as any` en el backend, adoptando tipos estrictos de Prisma y manejo de errores con `ApiError`.

### Patrón Problemático: `req.user`

El middleware `auth.ts` añade `user` a `req`, pero TypeScript no lo reconoce. Se usa `(req as any).user` en múltiples controllers. **Fix:** Extender tipos de Express.

### Otros

1. **Sin Reportes** - No hay UI de analytics/reportes
2. **Filtro KDS por estación** - `activeStation` implementado en UI pero filtro es placeholder (`true`)
3. **Sonido KDS** - Código espera `/sounds/bell.mp3` que puede no existir
4. **Modifiers en POS** - Backend soporta, no verificado si UI los muestra correctamente

---

## 5. Prisma Schema (Modelos Principales)

```prisma
// 20+ modelos definidos

TenantConfig     // Feature flags (enableStock, enableKDS, etc.)
Role             // RBAC con permissions JSON
User             // Auth con PIN y password

Category         // Con printer routing
Product          // SIMPLE | COMBO | RECIPE
ModifierGroup    // Para modificadores
ModifierOption
Ingredient       // Con stock tracking
ProductIngredient
StockMovement    // PURCHASE | SALE | WASTE | ADJUSTMENT

Order            // Multi-canal (POS, WAITER_APP, QR_MENU, DELIVERY_APP)
OrderItem        // Con status (PENDING, COOKING, READY, SERVED)
OrderItemModifier
Payment          // CASH, CARD, TRANSFER, QR_INTEGRATED, ONLINE

Area
Table            // Con x,y para layout

Client           // Con puntos y wallet
CashShift        // Con arqueo ciego (startAmount, endAmount)
```

### Enums

```prisma
OrderStatus: OPEN, CONFIRMED, IN_PREPARATION, PREPARED, ON_ROUTE, DELIVERED, CANCELLED
PaymentStatus: PENDING, PARTIAL, PAID, REFUNDED
TableStatus: FREE, OCCUPIED, RESERVED, CLEANING
ItemStatus: PENDING, COOKING, READY, SERVED
```

---

## 6. Testing

| Tipo           | Estado | Archivos                                        |
| -------------- | ------ | ----------------------------------------------- |
| Unit (Backend) | ✅     | `auth.service.test.ts`, `order.service.test.ts` |
| Integration    | ?      | No verificado                                   |
| E2E (Cypress)  | ✅     | `tables_dnd.cy.ts`                              |

---

## 7. Rutas Frontend (App.tsx)

```
/login              → LoginPage
/                   → Home (Welcome)
/ventas             → POSPage [RBAC: orders.create]
/cash               → CashPage [RBAC: cash.read]
/delivery-dashboard → DeliveryDashboard [Flag: enableDelivery, RBAC: orders.read]
/tables             → TablePage [RBAC: tables.read]
/kitchen            → KitchenPage [Flag: enableKDS]

/admin/categories   → CategoryList
/admin/products     → ProductList
/admin/tables       → TablesAdminPage
/admin/users        → UsersPage [RBAC: users.read]
/admin/clients      → ClientsPage
/admin/cash-shifts  → CashShiftHistoryPage [RBAC: cash.read]
/admin/ingredients  → IngredientsPage [Flag: enableStock]
/admin/settings     → SettingsPage
```

---

**Fin del documento. Listo para copiar a nueva sesión.**
