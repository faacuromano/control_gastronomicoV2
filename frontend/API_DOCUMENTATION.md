# API Documentation v2.0

Multi-tenant gastronomy control system. JWT auth via httpOnly cookies. All routes require `/api/v1` prefix unless noted.

<types>
```typescript
// Global Types
interface Tenant { id: number; name: string; code: string; activeSubscription: boolean; }
interface AuthUser { id: number; tenantId: number; roleId: number; name: string; email: string; role: Role; }
interface Role { id: number; name: string; permissions: Record<string, string[]>; }
interface ApiResponse<T> { success: boolean; data: T; error?: string; }
interface DateRange { startDate: string; endDate: string; } // ISO 8601 format

// Enums
type OrderChannel = 'POS' | 'WAITER_APP' | 'QR_MENU' | 'DELIVERY_APP';
type OrderStatus = 'OPEN' | 'CONFIRMED' | 'IN_PREPARATION' | 'PREPARED' | 'ON_ROUTE' | 'DELIVERED' | 'CANCELLED';
type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'REFUNDED';
type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'QR_INTEGRATED' | 'ONLINE';
type ItemStatus = 'PENDING' | 'COOKING' | 'READY' | 'SERVED';
type TableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';
type ProductType = 'SIMPLE' | 'COMBO' | 'RECIPE';
type StockMoveType = 'PURCHASE' | 'SALE' | 'WASTE' | 'ADJUSTMENT';
type PurchaseStatus = 'PENDING' | 'ORDERED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';
type InvoiceType = 'RECEIPT' | 'INVOICE_B';
type FulfillmentType = 'DINE_IN' | 'TAKEAWAY' | 'PLATFORM_DELIVERY' | 'SELF_DELIVERY';
type VehicleType = 'MOTORCYCLE' | 'BICYCLE' | 'CAR' | 'WALKING';
type PrinterConnection = 'NETWORK' | 'USB';
type QrMenuMode = 'INTERACTIVE' | 'STATIC';
```
</types>

---

<module name="Authentication">

<types>
```typescript
interface LoginPinReq { pin: string; tenantId?: number; }
interface LoginPasswordReq { email: string; password: string; tenantId?: number; }
interface RegisterReq { name: string; email: string; password: string; tenantId: number; roleId: number; }
interface RegisterTenantReq { businessName: string; name: string; email: string; password: string; phone?: string; }
interface LoginRes { user: AuthUser; message: string; }
interface RegisterTenantRes { tenant: Tenant; user: AuthUserWithPin; message: string; }
interface AuthUserWithPin extends AuthUser { generatedPin: string; }
```
</types>

**POST /api/v1/auth/login/pin**
Autentica usuario con PIN. Retorna JWT en httpOnly cookie `auth_token`.
```typescript
Body: LoginPinReq
Response: LoginRes (200)
Errors: 400 (missing PIN), 401 (invalid), 429 (rate limit 5/15min)
```
**Edge Cases**: Bloqueo tras 5 intentos fallidos. Cookie HttpOnly `auth_token` con path `/api`, SameSite strict, secure en prod.

**POST /api/v1/auth/login**
Autentica con email/password. JWT en httpOnly cookie.
```typescript
Body: LoginPasswordReq
Response: LoginRes (200)
Errors: 400, 401, 429
```

**POST /api/v1/auth/register**
Registra usuario en tenant existente. Req: tenantId + roleId.
```typescript
Body: RegisterReq
Response: LoginRes (201)
```

**POST /api/v1/auth/signup**
Registra nuevo tenant SaaS (público).
```typescript
Body: RegisterTenantReq
Response: RegisterTenantRes (201)
```

**POST /api/v1/auth/logout**
Limpia cookie auth. No req auth.
```typescript
Response: { message: string } (200)
```

</module>

---

<module name="Orders">

<types>
```typescript
interface OrderItem { productId: number; quantity: number; notes?: string; modifiers?: ModifierSelection[]; removedIngredientIds?: number[]; }
interface ModifierSelection { id: number; price: number; }
interface CreateOrderReq {
  items: OrderItem[];
  channel?: OrderChannel;
  tableId?: number;
  clientId?: number;
  paymentMethod?: PaymentMethod | 'SPLIT';
  payments?: PaymentEntry[];
  deliveryData?: DeliveryData;
}
interface PaymentEntry { method: string; amount: number; } // method: dynamic codes
interface DeliveryData { address: string; notes?: string; phone?: string; name?: string; driverId?: number; }
interface Order {
  id: number;
  orderNumber: number;
  tenantId: number;
  channel: OrderChannel;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  discount: number;
  tip: number;
  total: number;
  tableId?: number;
  clientId?: number;
  serverId?: number;
  items: OrderItemFull[];
  payments: Payment[];
  businessDate: string;
  createdAt: string;
  closedAt?: string;
}
interface OrderItemFull { id: number; productId: number; product: Product; quantity: number; unitPrice: number; status: ItemStatus; notes?: string; modifiers: OrderItemModifierFull[]; }
interface OrderItemModifierFull { id: number; modifierOptionId: number; modifierOption: ModifierOption; priceCharged: number; }
interface Payment { id: number; orderId: number; amount: number; tip: number; method: PaymentMethod; externalRef?: string; createdAt: string; }
interface VoidItemReq { reason: VoidReason; notes?: string; }
type VoidReason = 'CUSTOMER_REQUEST' | 'KITCHEN_ERROR' | 'WRONG_ORDER' | 'QUALITY_ISSUE' | 'OTHER';
interface TransferItemsReq { itemIds: number[]; fromTableId: number; toTableId: number; }
```
</types>

**POST /api/v1/orders**
Crea orden. Req: auth + `orders:create`.
```typescript
Body: CreateOrderReq
Response: ApiResponse<Order> (201)
Errors: 400 (validation), 401, 403
```
**AI-Hint**: `paymentMethod: 'SPLIT'` + array `payments` para pagos múltiples. BusinessDate calculado server-side.

**GET /api/v1/orders**
Lista órdenes recientes. Req: auth + `orders:read`.
```typescript
Response: ApiResponse<Order[]> (200)
```

**GET /api/v1/orders/table/:tableId**
Orden activa de mesa. Req: auth + `orders:read`.
```typescript
Response: ApiResponse<Order | null> (200)
```

**GET /api/v1/orders/kds**
Órdenes activas para KDS (Kitchen Display System).
```typescript
Response: ApiResponse<Order[]> (200)
```

**PATCH /api/v1/orders/:id/status**
Actualiza estado orden. Req: `orders:update`.
```typescript
Body: { status: OrderStatus }
Response: ApiResponse<Order> (200)
```

**PATCH /api/v1/orders/items/:itemId/status**
Actualiza estado item. Req: `orders:update`.
```typescript
Body: { status: ItemStatus }
Response: ApiResponse<OrderItemFull> (200)
```

**POST /api/v1/orders/:orderId/items**
Agrega items a orden existente. Req: `orders:update`.
```typescript
Body: { items: OrderItem[] }
Response: ApiResponse<Order> (200)
```

**POST /api/v1/orders/:orderId/items/served**
Marca todos items como SERVED. Req: `orders:update`.
```typescript
Response: ApiResponse<Order> (200)
```

**DELETE /api/v1/orders/items/:itemId/void**
Anula item (manager). Req: `orders:delete`.
```typescript
Body: VoidItemReq
Response: ApiResponse<{ orderItem: OrderItemFull; auditLog: any }> (200)
```

**GET /api/v1/orders/void-reasons**
Lista razones anulación. Req: `orders:read`.
```typescript
Response: ApiResponse<Array<{ code: VoidReason; label: string; requiresNote: boolean }>> (200)
```

**POST /api/v1/orders/items/transfer**
Transfiere items entre mesas. Req: `orders:update`.
```typescript
Body: TransferItemsReq
Response: ApiResponse<{ fromOrder: Order; toOrder: Order; transferredItems: OrderItemFull[] }> (200)
```

</module>

---

<module name="Products">

<types>
```typescript
interface Product {
  id: number;
  tenantId: number;
  categoryId: number;
  category: Category;
  name: string;
  description?: string;
  price: number;
  image?: string;
  productType: ProductType;
  isStockable: boolean;
  isActive: boolean;
  ingredients: ProductIngredient[];
  modifiers: ProductModifierGroup[];
  channelPrices: ProductChannelPrice[];
}
interface Category { id: number; name: string; printerId?: number; }
interface ProductIngredient { ingredientId: number; quantity: number; ingredient: Ingredient; }
interface ProductModifierGroup { modifierGroupId: number; modifierGroup: ModifierGroup; }
interface Ingredient { id: number; name: string; unit: string; cost: number; stock: number; minStock: number; }
interface ModifierGroup { id: number; name: string; minSelection: number; maxSelection: number; options: ModifierOption[]; }
interface ModifierOption { id: number; name: string; priceOverlay: number; isActive: boolean; ingredientId?: number; qtyUsed?: number; }
interface ProductChannelPrice { id: number; productId: number; deliveryPlatformId: number; price: number; externalSku?: string; isAvailable: boolean; }
interface CreateProductReq { categoryId: number; name: string; description?: string; price: number; image?: string; productType?: ProductType; isStockable?: boolean; ingredients?: { ingredientId: number; quantity: number }[]; modifiers?: number[]; }
```
</types>

**GET /api/v1/menu/categories**
Lista categorías. Req: auth + `products:read`.
```typescript
Query: none
Response: ApiResponse<Category[]> (200)
```

**GET /api/v1/menu/categories/:id**
Obtiene categoría. Req: auth + `products:read`.
```typescript
Response: ApiResponse<Category> (200)
```

**POST /api/v1/menu/categories**
Crea categoría. Req: auth + `products:create`.
```typescript
Body: { name: string; printerId?: number }
Response: ApiResponse<Category> (201)
```

**PUT /api/v1/menu/categories/:id**
Actualiza categoría. Req: auth + `products:update`.
```typescript
Body: { name?: string; printerId?: number }
Response: ApiResponse<Category> (200)
```

**DELETE /api/v1/menu/categories/:id**
Elimina categoría. Req: auth + `products:delete`.
```typescript
Response: ApiResponse<void> (204)
```

**GET /api/v1/menu/products**
Lista productos. Req: auth + `products:read`.
```typescript
Query: { categoryId?: number; isActive?: boolean }
Response: ApiResponse<Product[]> (200)
```

**GET /api/v1/menu/products/:id**
Obtiene producto con relations. Req: auth + `products:read`.
```typescript
Response: ApiResponse<Product> (200)
```

**POST /api/v1/menu/products**
Crea producto. Req: auth + `products:create`.
```typescript
Body: CreateProductReq
Response: ApiResponse<Product> (201)
```

**PUT /api/v1/menu/products/:id**
Actualiza producto. Req: auth + `products:update`.
```typescript
Body: Partial<CreateProductReq>
Response: ApiResponse<Product> (200)
```

**PATCH /api/v1/menu/products/:id/toggle**
Activa/desactiva producto. Req: auth + `products:update`.
```typescript
Response: ApiResponse<Product> (200)
```

**DELETE /api/v1/menu/products/:id**
Soft delete producto. Req: auth + `products:delete`.
```typescript
Response: ApiResponse<{ message: string }> (200)
```

</module>

---

<module name="Modifiers">

<types>
```typescript
interface CreateGroupReq { name: string; minSelection?: number; maxSelection?: number; }
interface AddOptionReq { name: string; priceOverlay: number; ingredientId?: number; qtyUsed?: number; }
```
</types>

**GET /api/v1/modifiers/groups**
Lista grupos modificadores. Req: auth.
```typescript
Response: ApiResponse<ModifierGroup[]> (200)
```

**GET /api/v1/modifiers/groups/:id**
Obtiene grupo. Req: auth.
```typescript
Response: ApiResponse<ModifierGroup> (200)
```

**POST /api/v1/modifiers/groups**
Crea grupo. Req: auth + ADMIN/MANAGER role.
```typescript
Body: CreateGroupReq
Response: ApiResponse<ModifierGroup> (201)
```

**PUT /api/v1/modifiers/groups/:id**
Actualiza grupo. Req: auth + ADMIN/MANAGER.
```typescript
Body: Partial<CreateGroupReq>
Response: ApiResponse<ModifierGroup> (200)
```

**DELETE /api/v1/modifiers/groups/:id**
Elimina grupo. Req: auth + ADMIN/MANAGER.
```typescript
Response: ApiResponse<void> (204)
```

**POST /api/v1/modifiers/groups/:groupId/options**
Agrega opción a grupo. Req: auth + ADMIN/MANAGER.
```typescript
Body: AddOptionReq
Response: ApiResponse<ModifierOption> (201)
```

**PUT /api/v1/modifiers/options/:optionId**
Actualiza opción. Req: auth + ADMIN/MANAGER.
```typescript
Body: Partial<AddOptionReq>
Response: ApiResponse<ModifierOption> (200)
```

**DELETE /api/v1/modifiers/options/:optionId**
Elimina opción. Req: auth + ADMIN/MANAGER.
```typescript
Response: ApiResponse<void> (204)
```

</module>

---

<module name="Tables">

<types>
```typescript
interface Area { id: number; name: string; tables: Table[]; }
interface Table { id: number; tenantId: number; areaId: number; name: string; x?: number; y?: number; status: TableStatus; currentOrderId?: number; }
interface CreateAreaReq { name: string; }
interface CreateTableReq { areaId: number; name: string; x?: number; y?: number; }
interface UpdatePositionsReq { positions: Array<{ id: number; x: number; y: number }>; }
```
</types>

**GET /api/v1/areas**
Lista áreas con mesas. Req: auth.
```typescript
Response: ApiResponse<Area[]> (200)
```

**POST /api/v1/areas**
Crea área. Req: auth + ADMIN role.
```typescript
Body: CreateAreaReq
Response: ApiResponse<Area> (201)
```

**PUT /api/v1/areas/:id**
Actualiza área. Req: auth + ADMIN.
```typescript
Body: CreateAreaReq
Response: ApiResponse<Area> (200)
```

**DELETE /api/v1/areas/:id**
Elimina área. Req: auth + ADMIN.
```typescript
Response: ApiResponse<void> (204)
```

**GET /api/v1/tables/:id**
Obtiene mesa. Req: auth.
```typescript
Response: ApiResponse<Table> (200)
```

**POST /api/v1/tables**
Crea mesa. Req: auth + ADMIN.
```typescript
Body: CreateTableReq
Response: ApiResponse<Table> (201)
```

**PUT /api/v1/tables/:id**
Actualiza mesa. Req: auth + ADMIN.
```typescript
Body: Partial<CreateTableReq>
Response: ApiResponse<Table> (200)
```

**PUT /api/v1/tables/:id/position**
Actualiza posición mesa. Req: auth + ADMIN.
```typescript
Body: { x: number; y: number }
Response: ApiResponse<Table> (200)
```

**PUT /api/v1/tables/positions**
Actualiza múltiples posiciones. Req: auth + ADMIN.
```typescript
Body: UpdatePositionsReq
Response: ApiResponse<Table[]> (200)
```

**DELETE /api/v1/tables/:id**
Elimina mesa. Req: auth + ADMIN.
```typescript
Response: ApiResponse<void> (204)
```

**POST /api/v1/tables/:id/open**
Abre mesa (mesero). Req: auth.
```typescript
Response: ApiResponse<Table> (200)
```

**POST /api/v1/tables/:id/close**
Cierra mesa. Req: auth.
```typescript
Response: ApiResponse<Table> (200)
```

</module>

---

<module name="Clients">

<types>
```typescript
interface Client { id: number; tenantId: number; name: string; phone?: string; email?: string; address?: string; taxId?: string; points: number; walletBalance: number; }
interface CreateClientReq { name: string; phone?: string; email?: string; address?: string; taxId?: string; }
```
</types>

**GET /api/v1/clients/search**
Busca clientes. Req: auth.
```typescript
Query: { q?: string; phone?: string; email?: string }
Response: ApiResponse<Client[]> (200)
```

**POST /api/v1/clients**
Crea cliente. Req: auth.
```typescript
Body: CreateClientReq
Response: ApiResponse<Client> (201)
```

</module>

---

<module name="Payments">

<types>
```typescript
interface PaymentMethodConfig { id: number; code: string; name: string; icon?: string; isActive: boolean; sortOrder: number; }
interface CreateMethodReq { code: string; name: string; icon?: string; sortOrder?: number; }
```
</types>

**GET /api/v1/payment-methods/active**
Métodos activos para POS. Req: auth.
```typescript
Response: ApiResponse<PaymentMethodConfig[]> (200)
```

**GET /api/v1/payment-methods**
Todos los métodos. Req: auth + ADMIN.
```typescript
Response: ApiResponse<PaymentMethodConfig[]> (200)
```

**GET /api/v1/payment-methods/:id**
Obtiene método. Req: auth + ADMIN.
```typescript
Response: ApiResponse<PaymentMethodConfig> (200)
```

**POST /api/v1/payment-methods**
Crea método. Req: auth + ADMIN.
```typescript
Body: CreateMethodReq
Response: ApiResponse<PaymentMethodConfig> (201)
```

**PUT /api/v1/payment-methods/:id**
Actualiza método. Req: auth + ADMIN.
```typescript
Body: Partial<CreateMethodReq>
Response: ApiResponse<PaymentMethodConfig> (200)
```

**PATCH /api/v1/payment-methods/:id/toggle**
Activa/desactiva. Req: auth + ADMIN.
```typescript
Response: ApiResponse<PaymentMethodConfig> (200)
```

**DELETE /api/v1/payment-methods/:id**
Elimina método. Req: auth + ADMIN.
```typescript
Response: ApiResponse<void> (204)
```

**POST /api/v1/payment-methods/seed**
Seed métodos default. Req: auth + ADMIN.
```typescript
Response: ApiResponse<PaymentMethodConfig[]> (201)
```

</module>

---

<module name="CashShifts">

<types>
```typescript
interface CashShift { id: number; tenantId: number; userId: number; startTime: string; endTime?: string; startAmount: number; endAmount?: number; businessDate: string; }
interface OpenShiftReq { startAmount: number; }
interface CloseShiftReq { countedCash: number; }
interface ShiftReport { shift: CashShift; sales: SalesSummary; cash: CashSummary; payments: PaymentBreakdown[]; }
interface SalesSummary { totalSales: number; orderCount: number; }
interface CashSummary { startAmount: number; cashSales: number; expectedCash: number; countedCash: number; difference: number; }
interface PaymentBreakdown { method: string; count: number; total: number; }
```
</types>

**POST /api/v1/shifts/open**
Abre turno. Req: auth.
```typescript
Body: OpenShiftReq
Response: ApiResponse<CashShift> (200)
```

**POST /api/v1/shifts/close-with-count**
Cierra turno con arqueo ciego. Req: auth.
```typescript
Body: CloseShiftReq
Response: ApiResponse<ShiftReport> (200)
```

**POST /api/v1/shifts/close**
Cierra turno (legacy). Req: auth.
```typescript
Body: { endAmount: number }
Response: ApiResponse<CashShift> (200)
```

**GET /api/v1/shifts/current**
Turno actual usuario. Req: auth.
```typescript
Response: ApiResponse<CashShift | null> (200)
```

**GET /api/v1/shifts/:id/report**
Reporte turno. Req: auth.
```typescript
Response: ApiResponse<ShiftReport> (200)
```

**GET /api/v1/shifts**
Lista turnos. Req: auth.
```typescript
Query: { fromDate?: string (ISO 8601); userId?: number }
Response: ApiResponse<CashShift[]> (200)
```
**Edge Case**: `fromDate` debe ser ISO 8601 completo (YYYY-MM-DDTHH:mm:ss.sssZ).

</module>

---

<module name="Analytics">

<types>
```typescript
interface SalesSummary { totalSales: number; orderCount: number; avgTicket: number; }
interface TopProduct { productId: number; productName: string; quantitySold: number; revenue: number; }
interface PaymentBreakdown { method: string; count: number; total: number; percentage: number; }
interface ChannelSales { channel: OrderChannel; orderCount: number; revenue: number; percentage: number; }
interface LowStockItem { id: number; name: string; stock: number; minStock: number; unit: string; }
interface DailySale { date: string; totalSales: number; orderCount: number; }
```
</types>

**GET /api/v1/analytics/summary**
Resumen ventas. Req: auth.
```typescript
Query: DateRange (opcional, default hoy)
Response: ApiResponse<SalesSummary> (200)
```

**GET /api/v1/analytics/top-products**
Productos más vendidos. Req: auth.
```typescript
Query: { limit?: number; startDate?: string; endDate?: string }
Response: ApiResponse<TopProduct[]> (200)
```

**GET /api/v1/analytics/payments**
Desglose pagos. Req: auth.
```typescript
Query: DateRange (opcional)
Response: ApiResponse<PaymentBreakdown[]> (200)
```

**GET /api/v1/analytics/channels**
Ventas por canal. Req: auth.
```typescript
Query: DateRange (opcional)
Response: ApiResponse<ChannelSales[]> (200)
```

**GET /api/v1/analytics/low-stock**
Items bajo stock. Req: auth.
```typescript
Response: ApiResponse<LowStockItem[]> (200)
```

**GET /api/v1/analytics/daily-sales**
Ventas diarias. Req: auth.
```typescript
Query: DateRange (opcional, default últimos 30 días)
Response: ApiResponse<DailySale[]> (200)
```

</module>

---

<module name="Inventory">

<types>
```typescript
interface CreateIngredientReq { name: string; unit: string; cost: number; stock: number; minStock?: number; }
interface StockMovementReq { ingredientId: number; type: StockMoveType; quantity: number; reason?: string; }
interface StockMovement { id: number; ingredientId: number; type: StockMoveType; quantity: number; reason?: string; createdAt: string; }
```
</types>

**GET /api/v1/inventory/ingredients**
Lista ingredientes. Req: auth.
```typescript
Response: ApiResponse<Ingredient[]> (200)
```

**GET /api/v1/inventory/ingredients/:id**
Obtiene ingrediente. Req: auth.
```typescript
Response: ApiResponse<Ingredient> (200)
```

**POST /api/v1/inventory/ingredients**
Crea ingrediente. Req: auth.
```typescript
Body: CreateIngredientReq
Response: ApiResponse<Ingredient> (201)
```

**PUT /api/v1/inventory/ingredients/:id**
Actualiza ingrediente. Req: auth.
```typescript
Body: Partial<CreateIngredientReq>
Response: ApiResponse<Ingredient> (200)
```

**DELETE /api/v1/inventory/ingredients/:id**
Elimina ingrediente. Req: auth.
```typescript
Response: ApiResponse<void> (204)
```

**POST /api/v1/inventory/stock-movements**
Registra movimiento stock. Req: auth.
```typescript
Body: StockMovementReq
Response: ApiResponse<StockMovement> (201)
```

**GET /api/v1/inventory/stock-movements**
Historial movimientos. Req: auth.
```typescript
Query: { ingredientId?: number; type?: StockMoveType; startDate?: string; endDate?: string }
Response: ApiResponse<StockMovement[]> (200)
```

</module>

---

<module name="Suppliers">

<types>
```typescript
interface Supplier { id: number; tenantId: number; name: string; phone?: string; email?: string; address?: string; taxId?: string; isActive: boolean; }
interface CreateSupplierReq { name: string; phone?: string; email?: string; address?: string; taxId?: string; }
```
</types>

**GET /api/v1/inventory/suppliers**
Lista proveedores. Req: auth.
```typescript
Response: ApiResponse<Supplier[]> (200)
```

**GET /api/v1/inventory/suppliers/:id**
Obtiene proveedor. Req: auth.
```typescript
Response: ApiResponse<Supplier> (200)
```

**POST /api/v1/inventory/suppliers**
Crea proveedor. Req: auth.
```typescript
Body: CreateSupplierReq
Response: ApiResponse<Supplier> (201)
```

**PUT /api/v1/inventory/suppliers/:id**
Actualiza proveedor. Req: auth.
```typescript
Body: Partial<CreateSupplierReq>
Response: ApiResponse<Supplier> (200)
```

**DELETE /api/v1/inventory/suppliers/:id**
Desactiva proveedor. Req: auth.
```typescript
Response: ApiResponse<void> (204)
```

</module>

---

<module name="PurchaseOrders">

<types>
```typescript
interface PurchaseOrder { id: number; tenantId: number; orderNumber: number; supplierId: number; status: PurchaseStatus; subtotal: number; total: number; notes?: string; orderedAt: string; receivedAt?: string; items: PurchaseOrderItem[]; }
interface PurchaseOrderItem { id: number; ingredientId: number; quantity: number; unitCost: number; ingredient: Ingredient; }
interface CreatePurchaseOrderReq { supplierId: number; items: Array<{ ingredientId: number; quantity: number; unitCost: number }>; notes?: string; }
interface UpdateStatusReq { status: PurchaseStatus; }
```
</types>

**GET /api/v1/inventory/purchase-orders**
Lista órdenes compra. Req: auth.
```typescript
Query: { status?: PurchaseStatus; supplierId?: number }
Response: ApiResponse<PurchaseOrder[]> (200)
```

**GET /api/v1/inventory/purchase-orders/:id**
Obtiene orden compra. Req: auth.
```typescript
Response: ApiResponse<PurchaseOrder> (200)
```

**POST /api/v1/inventory/purchase-orders**
Crea orden compra. Req: auth.
```typescript
Body: CreatePurchaseOrderReq
Response: ApiResponse<PurchaseOrder> (201)
```

**PATCH /api/v1/inventory/purchase-orders/:id/status**
Actualiza estado. Req: auth.
```typescript
Body: UpdateStatusReq
Response: ApiResponse<PurchaseOrder> (200)
```

**POST /api/v1/inventory/purchase-orders/:id/receive**
Recibe orden (actualiza stock). Req: auth.
```typescript
Body: { receivedItems?: Array<{ itemId: number; quantityReceived: number }> }
Response: ApiResponse<PurchaseOrder> (200)
```
**AI-Hint**: Si `receivedItems` no se envía, se asume recepción completa de todas cantidades.

**POST /api/v1/inventory/purchase-orders/:id/cancel**
Cancela orden. Req: auth.
```typescript
Response: ApiResponse<PurchaseOrder> (200)
```

**DELETE /api/v1/inventory/purchase-orders/:id**
Elimina orden (solo PENDING). Req: auth.
```typescript
Response: ApiResponse<void> (204)
```

</module>

---

<module name="Users">

<types>
```typescript
interface User { id: number; tenantId: number; roleId: number; name: string; email?: string; isActive: boolean; role: Role; uiSettings?: Record<string, any>; }
interface CreateUserReq { name: string; email?: string; pinHash?: string; passwordHash?: string; roleId: number; }
interface UsersWithCapability { capability: string; users: User[]; }
```
</types>

**GET /api/v1/users**
Lista usuarios. Req: auth.
```typescript
Response: ApiResponse<User[]> (200)
```

**GET /api/v1/users/with-capability**
Usuarios con capacidad específica. Req: auth.
```typescript
Query: { capability: string } // e.g., 'delivery', 'waiter'
Response: ApiResponse<UsersWithCapability> (200)
```

**GET /api/v1/users/:id**
Obtiene usuario. Req: auth + ADMIN.
```typescript
Response: ApiResponse<User> (200)
```

**POST /api/v1/users**
Crea usuario. Req: auth + ADMIN.
```typescript
Body: CreateUserReq
Response: ApiResponse<User> (201)
```

**PUT /api/v1/users/:id**
Actualiza usuario. Req: auth + ADMIN.
```typescript
Body: Partial<CreateUserReq>
Response: ApiResponse<User> (200)
```

**DELETE /api/v1/users/:id**
Desactiva usuario. Req: auth + ADMIN.
```typescript
Response: ApiResponse<void> (204)
```

</module>

---

<module name="Roles">

<types>
```typescript
interface CreateRoleReq { name: string; permissions: Record<string, string[]>; }
interface UpdatePermissionsReq { permissions: Record<string, string[]>; }
interface PermissionOptions { resources: string[]; actions: string[]; }
```
</types>

**GET /api/v1/roles**
Lista roles. Req: auth.
```typescript
Response: ApiResponse<Role[]> (200)
```

**GET /api/v1/roles/permission-options**
Opciones permisos disponibles. Req: auth.
```typescript
Response: ApiResponse<PermissionOptions> (200)
```

**GET /api/v1/roles/:id**
Obtiene rol. Req: auth + ADMIN.
```typescript
Response: ApiResponse<Role> (200)
```

**POST /api/v1/roles**
Crea rol. Req: auth + ADMIN.
```typescript
Body: CreateRoleReq
Response: ApiResponse<Role> (201)
```

**PUT /api/v1/roles/:id/permissions**
Actualiza permisos rol. Req: auth + ADMIN.
```typescript
Body: UpdatePermissionsReq
Response: ApiResponse<Role> (200)
```

**DELETE /api/v1/roles/:id**
Elimina rol. Req: auth + ADMIN.
```typescript
Response: ApiResponse<void> (204)
```

</module>

---

<module name="Delivery">

<types>
```typescript
interface DeliveryPlatform { id: number; code: string; name: string; isEnabled: boolean; }
interface DeliveryDriver { id: number; tenantId: number; name: string; phone: string; email?: string; vehicleType: VehicleType; licensePlate?: string; isActive: boolean; isAvailable: boolean; currentOrderId?: number; }
interface CreateDriverReq { name: string; phone: string; email?: string; vehicleType: VehicleType; licensePlate?: string; }
interface AssignDriverReq { orderId: number; }
```
</types>

**GET /api/v1/delivery/platforms**
Lista plataformas delivery. Req: auth.
```typescript
Response: ApiResponse<DeliveryPlatform[]> (200)
```

**GET /api/v1/delivery/platforms/:id**
Obtiene plataforma. Req: auth.
```typescript
Response: ApiResponse<DeliveryPlatform> (200)
```

**POST /api/v1/delivery/platforms**
Crea plataforma. Req: auth + `settings:update`.
```typescript
Body: { code: string; name: string; }
Response: ApiResponse<DeliveryPlatform> (201)
```

**PATCH /api/v1/delivery/platforms/:id**
Actualiza plataforma. Req: auth + `settings:update`.
```typescript
Body: { name?: string; isEnabled?: boolean; }
Response: ApiResponse<DeliveryPlatform> (200)
```

**PATCH /api/v1/delivery/platforms/:id/toggle**
Activa/desactiva plataforma. Req: auth + `settings:update`.
```typescript
Response: ApiResponse<DeliveryPlatform> (200)
```

**DELETE /api/v1/delivery/platforms/:id**
Elimina plataforma. Req: auth + `settings:update`.
```typescript
Response: ApiResponse<void> (204)
```

**GET /api/v1/delivery/drivers**
Lista conductores. Req: auth.
```typescript
Response: ApiResponse<DeliveryDriver[]> (200)
```

**GET /api/v1/delivery/drivers/available**
Conductores disponibles. Req: auth.
```typescript
Response: ApiResponse<DeliveryDriver[]> (200)
```

**GET /api/v1/delivery/drivers/:id**
Obtiene conductor. Req: auth.
```typescript
Response: ApiResponse<DeliveryDriver> (200)
```

**POST /api/v1/delivery/drivers**
Crea conductor. Req: auth + `settings:update`.
```typescript
Body: CreateDriverReq
Response: ApiResponse<DeliveryDriver> (201)
```

**PATCH /api/v1/delivery/drivers/:id**
Actualiza conductor. Req: auth + `settings:update`.
```typescript
Body: Partial<CreateDriverReq>
Response: ApiResponse<DeliveryDriver> (200)
```

**PATCH /api/v1/delivery/drivers/:id/availability**
Toggle disponibilidad conductor. Req: auth.
```typescript
Response: ApiResponse<DeliveryDriver> (200)
```

**PATCH /api/v1/delivery/drivers/:id/active**
Activa/desactiva conductor. Req: auth + `settings:update`.
```typescript
Response: ApiResponse<DeliveryDriver> (200)
```

**POST /api/v1/delivery/drivers/:id/assign**
Asigna conductor a orden. Req: auth.
```typescript
Body: AssignDriverReq
Response: ApiResponse<{ driver: DeliveryDriver; order: Order }> (200)
```

**POST /api/v1/delivery/drivers/:id/release**
Libera conductor. Req: auth.
```typescript
Response: ApiResponse<DeliveryDriver> (200)
```

**DELETE /api/v1/delivery/drivers/:id**
Elimina conductor. Req: auth + `settings:update`.
```typescript
Response: ApiResponse<void> (204)
```

**GET /api/v1/delivery/orders**
Órdenes delivery activas. Req: auth.
```typescript
Response: ApiResponse<Order[]> (200)
```

**PATCH /api/v1/delivery/orders/:orderId/assign**
Asigna User (con rol delivery) como conductor. Req: auth.
```typescript
Body: { driverId: number } // User ID
Response: ApiResponse<Order> (200)
```

</module>

---

<module name="Invoices">

<types>
```typescript
interface Invoice { id: number; tenantId: number; orderId: number; invoiceNumber: string; type: InvoiceType; clientName?: string; clientTaxId?: string; subtotal: number; tax: number; total: number; createdAt: string; }
interface GenerateInvoiceReq { orderId: number; type: InvoiceType; clientName?: string; clientTaxId?: string; }
```
</types>

**GET /api/v1/invoices**
Lista facturas. Req: auth.
```typescript
Query: { type?: InvoiceType; startDate?: string; endDate?: string }
Response: ApiResponse<Invoice[]> (200)
```

**POST /api/v1/invoices**
Genera factura. Req: auth.
```typescript
Body: GenerateInvoiceReq
Response: ApiResponse<Invoice> (201)
```

**GET /api/v1/invoices/order/:orderId**
Factura por orden. Req: auth.
```typescript
Response: ApiResponse<Invoice | null> (200)
```

**GET /api/v1/invoices/:invoiceNumber**
Factura por número. Req: auth.
```typescript
Response: ApiResponse<Invoice> (200)
```

</module>

---

<module name="Printers">

<types>
```typescript
interface Printer { id: number; tenantId: number; name: string; connectionType: PrinterConnection; ipAddress?: string; windowsName?: string; }
interface CreatePrinterReq { name: string; connectionType: PrinterConnection; ipAddress?: string; windowsName?: string; }
interface SystemPrinter { name: string; displayName?: string; }
```
</types>

**GET /api/v1/print/printers**
Lista impresoras. Req: auth.
```typescript
Response: ApiResponse<Printer[]> (200)
```

**GET /api/v1/print/printers/system**
Impresoras Windows. Req: auth.
```typescript
Response: ApiResponse<SystemPrinter[]> (200)
```

**POST /api/v1/print/printers**
Crea impresora. Req: auth.
```typescript
Body: CreatePrinterReq
Response: ApiResponse<Printer> (201)
```

**PUT /api/v1/print/printers/:id**
Actualiza impresora. Req: auth.
```typescript
Body: Partial<CreatePrinterReq>
Response: ApiResponse<Printer> (200)
```

**DELETE /api/v1/print/printers/:id**
Elimina impresora. Req: auth.
```typescript
Response: ApiResponse<void> (204)
```

**GET /api/v1/print/:id**
Genera buffer ticket (no imprime). Req: auth.
```typescript
Response: Buffer (200, Content-Type: application/octet-stream)
```

**POST /api/v1/print/:orderId/device/:printerId**
Imprime ticket en dispositivo. Req: auth.
```typescript
Response: ApiResponse<{ success: boolean }> (200)
```

**POST /api/v1/print/:orderId/preaccount/:printerId**
Imprime pre-cuenta. Req: auth.
```typescript
Response: ApiResponse<{ success: boolean }> (200)
```

**POST /api/v1/print/test/:printerId**
Imprime página test. Req: auth.
```typescript
Response: ApiResponse<{ success: boolean }> (200)
```

</module>

---

<module name="QR">

<types>
```typescript
interface QrCode { id: number; tenantId: number; code: string; tableId?: number; isActive: boolean; scansCount: number; lastScannedAt?: string; }
interface QrConfig { qrMenuEnabled: boolean; qrMenuMode: QrMenuMode; qrSelfOrderEnabled: boolean; qrMenuPdfUrl?: string; qrMenuBannerUrl?: string; qrMenuTheme?: Record<string, any>; }
interface PublicMenu { categories: Category[]; products: Product[]; }
interface GenerateCodeReq { tableId?: number; }
```
</types>

**GET /api/v1/qr/:code** (PUBLIC)
Valida QR y retorna config. No req auth.
```typescript
Response: ApiResponse<{ qr: QrCode; config: QrConfig; table?: Table }> (200)
Errors: 404 (invalid code), 403 (inactive QR)
```

**GET /api/v1/qr/:code/menu** (PUBLIC)
Obtiene menú público. No req auth.
```typescript
Response: ApiResponse<PublicMenu> (200)
```

**GET /api/v1/qr/admin/config**
Obtiene configuración QR. Req: auth.
```typescript
Response: ApiResponse<QrConfig> (200)
```

**PATCH /api/v1/qr/admin/config**
Actualiza config QR. Req: auth + `settings:update`.
```typescript
Body: Partial<QrConfig>
Response: ApiResponse<QrConfig> (200)
```

**GET /api/v1/qr/admin/codes**
Lista códigos QR. Req: auth.
```typescript
Response: ApiResponse<QrCode[]> (200)
```

**POST /api/v1/qr/admin/codes**
Genera código QR. Req: auth + `settings:update`.
```typescript
Body: GenerateCodeReq
Response: ApiResponse<QrCode> (201)
```

**PATCH /api/v1/qr/admin/codes/:id/toggle**
Activa/desactiva QR. Req: auth + `settings:update`.
```typescript
Response: ApiResponse<QrCode> (200)
```

**DELETE /api/v1/qr/admin/codes/:id**
Elimina QR. Req: auth + `settings:update`.
```typescript
Response: ApiResponse<void> (204)
```

</module>

---

<module name="Configuration">

<types>
```typescript
interface TenantConfig {
  businessName: string;
  currencySymbol: string;
  features: FeatureFlags;
}

interface FeatureFlags {
  enableStock: boolean;
  enableDelivery: boolean;
  enableKDS: boolean;
  enableFiscal: boolean;
  enableDigital: boolean;
}

interface UpdateConfigReq {
  businessName?: string;
  currencySymbol?: string;
  features?: Partial<FeatureFlags>;
}
```
</types>

**GET /api/v1/config**
Obtiene configuración del tenant. Req: auth.
```typescript
Response: ApiResponse<TenantConfig> (200)
```
**AI-Hint**: Frontend cachea esta respuesta para navigation/feature flags. Reload app tras actualizar.

**PATCH /api/v1/config**
Actualiza configuración. Req: auth + ADMIN role (implicit).
```typescript
Body: UpdateConfigReq
Response: ApiResponse<TenantConfig> (200)
```
**Edge Cases**:
- Frontend debe recargar tras update para reflejar cambios en navegación
- Feature flags afectan qué módulos se muestran en UI
- currencySymbol: default "$", acepta cualquier string (€, £, etc.)

</module>

---

## GLOBAL PATTERNS

### Authentication
- Cookie: `auth_token` (HttpOnly, SameSite strict, path `/api`, 24h TTL)
- Header alternativo: `Authorization: Bearer <token>` (legacy support)
- Refresh: No auto-refresh. Re-login tras expiración.

### Multi-Tenancy
- Tenant scoped via JWT `tenantId`. No tenant ID en request body requerido (extraído de token).
- Unique constraints: scoped per tenant (e.g., `@@unique([tenantId, name])`).

### Pagination
- No implementada. Considerar para listas grandes (productos, órdenes).
- Sugerencia futura: `?page=1&limit=50`.

### Date Handling
- Server: BusinessDate calculado via `businessDate.service` (considera hora cierre).
- Query params: ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ) o YYYY-MM-DD.
- Response: ISO 8601 strings.

### Error Format
```typescript
{ success: false; error: string; code?: string; }
```
Códigos comunes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `MISSING_CREDENTIALS`.

### Decimal Precision
- Prices: 2 decimals (`Decimal(10,2)`)
- Quantities: 4 decimals (`Decimal(10,4)`)
- Frontend: usar `parseFloat()` al recibir. Backend acepta number o string.

### File Upload
- No implementado en v2. Imágenes productos: URL string por ahora.
- Sugerencia: multipart/form-data en `POST /api/v1/upload`.

### WebSocket
- No implementado. KDS polling vía `GET /api/v1/orders/kds` cada 5-10s.
- Sugerencia: Socket.IO para updates real-time.

### Rate Limiting
- Auth endpoints: 5 req/15min por IP.
- Otros: Sin límite actual (agregar en prod).

### CORS
- Configurar `Access-Control-Allow-Origin` para frontend domain.
- Credentials: `true` (req para HttpOnly cookies).

---

## SECURITY NOTES

1. **XSS Protection**: JWT en HttpOnly cookie previene acceso JavaScript.
2. **CSRF**: SameSite strict mitiga CSRF. Considerar tokens CSRF si SameSite no soportado.
3. **SQL Injection**: Prisma ORM previene (parametrized queries).
4. **Brute Force**: Rate limiting en auth. Account lockout tras 5 intentos.
5. **Audit Trail**: Acciones críticas logged vía `AuditLog` (login, logout, void, transfers, shift close).
6. **Permission System**: RBAC granular. Resources: `orders`, `products`, `settings`, etc. Actions: `create`, `read`, `update`, `delete`.

---

## PERFORMANCE HINTS

1. **Order Number Generation**: Hourly sharding (`OrderSequence` per hour) reduce contention 24x. Expected latency ~50ms vs 1200ms.
2. **Indexes**: Aplicados en `tenantId`, `businessDate`, `orderNumber`, `externalId`, `createdAt`.
3. **N+1 Queries**: Controllers usan `include` Prisma para eager loading (reduce round-trips).
4. **Stock Operations**: Atomic via Prisma transactions. Ingredient stock updates en `SALE` automático al crear OrderItem.

---

## MIGRATION & BREAKING CHANGES

- **v1 → v2**: Auth token migra de response body a HttpOnly cookie. Frontend debe eliminar `localStorage.setItem('token')` y confiar en cookies automáticas.
- **Multi-Tenancy**: Todos modelos ahora tienen `tenantId`. Migration script `migrate-multi-tenancy.ts` disponible.
- **Order Numbers**: Formato cambió de `YYYYMMDDXXXX` a `XXX` daily reset. businessDate + orderNumber unique per tenant.

---

## AI INTEGRATION HINTS

1. **Order Creation**: Para órdenes QR self-service, usar `channel: 'QR_MENU'` + `tableId` del QR.
2. **Payment Split**: Enviar `paymentMethod: 'SPLIT'` + array `payments` con múltiples métodos.
3. **Void Reasons**: Consultar `GET /api/v1/orders/void-reasons` para dropdown dinámico.
4. **Modifier Pricing**: `priceOverlay` en ModifierOption es delta (agregar a precio base producto).
5. **Stock Deduction**: Automática al crear OrderItem si producto tiene `isStockable: true` + ingredients configurados.
6. **Driver Assignment**: Usar `POST /api/v1/delivery/orders/:orderId/assign` con User ID (role delivery), NO DeliveryDriver ID.

---

**Version**: 2.0
**Last Updated**: 2026-01-25
**Total Endpoints**: 120+
**Compression Ratio**: 60% (de 4600 a ~1840 líneas)

---

**CHANGELOG**:
- v2.0: HttpOnly cookie auth, multi-tenancy, hourly order sharding, dynamic payment methods, QR menu modes, delivery integration.
- v1.0: Initial monolithic implementation.
