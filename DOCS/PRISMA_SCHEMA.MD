generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model TenantConfig {
  id             Int     @id @default(1)
  businessName   String
  enableStock    Boolean @default(true)
  enableDelivery Boolean @default(true)
  enableKDS      Boolean @default(false)
  enableFiscal   Boolean @default(false)
  enableDigital  Boolean @default(false)
  currencySymbol String  @default("$")
}

model Role {
  id          Int    @id @default(autoincrement())
  name        String @unique
  permissions Json
  users       User[]
}

model User {
  id           Int         @id @default(autoincrement())
  roleId       Int
  role         Role        @relation(fields: [roleId], references: [id])
  name         String
  email        String?     @unique
  pinCode      String?     @unique @db.VarChar(6)
  passwordHash String?
  uiSettings   Json?
  orders       Order[]     @relation("OrderServer")
  deliveries   Order[]     @relation("OrderDriver")
  shifts       CashShift[]
  isActive     Boolean     @default(true)
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  @@index([roleId])
}

model Category {
  id        Int       @id @default(autoincrement())
  name      String
  printerId Int?
  printer   Printer?  @relation(fields: [printerId], references: [id])
  products  Product[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([printerId])
}

model Printer {
  id         Int        @id @default(autoincrement())
  name       String
  ipAddress  String?
  categories Category[]
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
}

model Product {
  id          Int                    @id @default(autoincrement())
  categoryId  Int
  category    Category               @relation(fields: [categoryId], references: [id])
  name        String
  description String?
  price       Decimal                @db.Decimal(10, 2)
  image       String?
  productType ProductType            @default(SIMPLE)
  isStockable Boolean                @default(true)
  ingredients ProductIngredient[]
  modifiers   ProductModifierGroup[]
  isActive    Boolean                @default(true)
  orderItems  OrderItem[]
  createdAt   DateTime               @default(now())
  updatedAt   DateTime               @updatedAt

  @@index([categoryId])
}

enum ProductType {
  SIMPLE
  COMBO
  RECIPE
}

model ModifierGroup {
  id           Int                    @id @default(autoincrement())
  name         String
  minSelection Int                    @default(0)
  maxSelection Int                    @default(1)
  options      ModifierOption[]
  products     ProductModifierGroup[]
  createdAt    DateTime               @default(now())
  updatedAt    DateTime               @updatedAt
}

model ProductModifierGroup {
  productId       Int
  modifierGroupId Int
  product         Product       @relation(fields: [productId], references: [id])
  modifierGroup   ModifierGroup @relation(fields: [modifierGroupId], references: [id])

  @@id([productId, modifierGroupId])
  @@index([modifierGroupId])
  @@index([productId])
}

model ModifierOption {
  id              Int                 @id @default(autoincrement())
  modifierGroupId Int
  group           ModifierGroup       @relation(fields: [modifierGroupId], references: [id])
  name            String
  priceOverlay    Decimal             @default(0) @db.Decimal(10, 2)
  ingredientId    Int?
  ingredient      Ingredient?         @relation(fields: [ingredientId], references: [id])
  qtyUsed         Decimal?            @default(1)
  orderModifiers  OrderItemModifier[]

  @@index([modifierGroupId])
  @@index([ingredientId])
}

model Ingredient {
  id        Int                 @id @default(autoincrement())
  name      String
  unit      String
  cost      Decimal             @db.Decimal(10, 4)
  stock     Decimal             @db.Decimal(10, 4)
  minStock  Decimal             @default(0)
  products  ProductIngredient[]
  modifiers ModifierOption[]
  movements StockMovement[]
  createdAt DateTime            @default(now())
  updatedAt DateTime            @updatedAt
}

model ProductIngredient {
  productId    Int
  ingredientId Int
  quantity     Decimal    @db.Decimal(10, 4)
  product      Product    @relation(fields: [productId], references: [id])
  ingredient   Ingredient @relation(fields: [ingredientId], references: [id])

  @@id([productId, ingredientId])
  @@index([ingredientId])
  @@index([productId])
}

model StockMovement {
  id           Int           @id @default(autoincrement())
  ingredientId Int
  ingredient   Ingredient    @relation(fields: [ingredientId], references: [id])
  type         StockMoveType
  quantity     Decimal       @db.Decimal(10, 4)
  createdAt    DateTime      @default(now())

  @@index([ingredientId])
}

enum StockMoveType {
  PURCHASE
  SALE
  WASTE
  ADJUSTMENT
}

model Order {
  id              Int           @id @default(autoincrement())
  orderNumber     Int           @unique
  channel         OrderChannel  @default(POS)
  externalId      String?
  status          OrderStatus   @default(OPEN)
  paymentStatus   PaymentStatus @default(PENDING)
  subtotal        Decimal       @default(0) @db.Decimal(10, 2)
  discount        Decimal       @default(0) @db.Decimal(10, 2)
  total           Decimal       @default(0) @db.Decimal(10, 2)
  tableId         Int?
  table           Table?        @relation(fields: [tableId], references: [id])
  clientId        Int?
  client          Client?       @relation(fields: [clientId], references: [id])
  serverId        Int?
  server          User?         @relation("OrderServer", fields: [serverId], references: [id])
  driverId        Int?
  driver          User?         @relation("OrderDriver", fields: [driverId], references: [id])
  deliveryAddress String?       // Dirección específica de esta entrega
  deliveryNotes   String?       // Notas de entrega ("Tocar timbre 2B")
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  closedAt        DateTime?
  businessDate    DateTime      @db.Date // Para agrupar ventas por "Día Operativo"
  items           OrderItem[]
  payments        Payment[]

  @@index([tableId])
  @@index([clientId])
  @@index([serverId])
  @@index([driverId])
  @@index([businessDate])
  @@index([createdAt])
}

enum OrderChannel {
  POS
  WAITER_APP
  QR_MENU
  DELIVERY_APP
}

enum OrderStatus {
  OPEN
  CONFIRMED
  PREPARED
  DELIVERED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  PARTIAL
  PAID
  REFUNDED
}

model OrderItem {
  id        Int                 @id @default(autoincrement())
  orderId   Int
  order     Order               @relation(fields: [orderId], references: [id])
  productId Int
  product   Product             @relation(fields: [productId], references: [id])
  quantity  Int
  unitPrice Decimal             @db.Decimal(10, 2)
  modifiers OrderItemModifier[]
  status    ItemStatus          @default(PENDING)
  notes     String?

  @@index([orderId])
  @@index([productId])
}

enum ItemStatus {
  PENDING
  COOKING
  READY
  SERVED
}

model OrderItemModifier {
  id               Int            @id @default(autoincrement())
  orderItemId      Int
  orderItem        OrderItem      @relation(fields: [orderItemId], references: [id])
  modifierOptionId Int
  modifierOption   ModifierOption @relation(fields: [modifierOptionId], references: [id])
  priceCharged     Decimal        @db.Decimal(10, 2)

  @@index([orderItemId])
  @@index([modifierOptionId])
}

model Area {
  id        Int      @id @default(autoincrement())
  name      String
  tables    Table[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Table {
  id             Int         @id @default(autoincrement())
  areaId         Int
  area           Area        @relation(fields: [areaId], references: [id])
  name           String
  x              Int?
  y              Int?
  status         TableStatus @default(FREE)
  currentOrderId Int?
  orders         Order[]
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  @@index([areaId])
}

enum TableStatus {
  FREE
  OCCUPIED
  RESERVED
  CLEANING
}

model Client {
  id            Int      @id @default(autoincrement())
  name          String
  phone         String?  @unique
  email         String?
  address       String?
  taxId         String?
  points        Int      @default(0)
  walletBalance Decimal  @default(0) @db.Decimal(10, 2)
  orders        Order[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model CashShift {
  id          Int       @id @default(autoincrement())
  userId      Int
  user        User      @relation(fields: [userId], references: [id])
  startTime   DateTime  @default(now())
  endTime     DateTime?
  startAmount Decimal   @db.Decimal(10, 2)
  endAmount   Decimal?  @db.Decimal(10, 2)
  businessDate DateTime  @db.Date // Día operativo del turno
  payments    Payment[]

  @@index([userId])
  @@index([businessDate])
}

model Payment {
  id          Int           @id @default(autoincrement())
  orderId     Int
  order       Order         @relation(fields: [orderId], references: [id])
  shiftId     Int?
  shift       CashShift?    @relation(fields: [shiftId], references: [id])
  amount      Decimal       @db.Decimal(10, 2)
  method      PaymentMethod
  externalRef String?
  createdAt   DateTime      @default(now())

  @@index([orderId])
  @@index([shiftId])
}

enum PaymentMethod {
  CASH
  CARD
  TRANSFER
  QR_INTEGRATED
  ONLINE
}