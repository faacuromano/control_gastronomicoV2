# Análisis del Sistema de Enrutamiento Producto-a-Estación

> **Fecha:** 2026-02-04
> **Estado:** Análisis Completo - Pendiente Decisión de Implementación

---

## 1. Resumen del Sistema Actual

### Enrutamiento de Impresión (Completamente Implementado, No Integrado)

El sistema de enrutamiento de impresión usa una **jerarquía de 3 niveles de prioridad**:

```
Prioridad 1: Área + Override de Categoría  →  "Bebidas en Terraza" → Impresora Terraza
Prioridad 2: Override General de Área      →  "Todos los items en Terraza" → Impresora Terraza
Prioridad 3: Default de Categoría          →  "Bebidas" → Impresora Barra
```

**Esquema de Base de Datos:**
- `Category.printerId` - Impresora por defecto para todos los productos de la categoría
- `AreaPrinterOverride` - Sobrecargas por área (pueden ser específicas de categoría o generales)

**Archivos Clave:**
- Servicio: `backend/src/services/printRouting.service.ts`
- Controlador: `backend/src/controllers/printRouting.controller.ts`
- Rutas: `backend/src/routes/printRouting.routes.ts`

**Problema Clave:** El servicio de enrutamiento de impresión **existe pero nunca se llama** durante la creación de órdenes. Las órdenes se crean y transmiten al KDS, pero nada dispara la impresión.

### Sistema KDS (Completamente Implementado)

**Backend:**
- `kdsService.broadcastNewOrder()` - Emite al room `tenant:{id}:kitchen`
- `kdsService.broadcastOrderUpdate()` - Emite actualizaciones
- Los rooms de socket existen: `tenant:{id}:kitchen:station:{name}` (sanitizados, listos para usar)

**Archivos Clave:**
- Servicio KDS: `backend/src/services/kds.service.ts`
- Servicio Cocina: `backend/src/services/orderKitchen.service.ts`
- Config Socket: `backend/src/lib/socket.ts`
- Página Frontend: `frontend/src/modules/kitchen/pages/KitchenPage.tsx`
- Store Frontend: `frontend/src/store/kitchen.store.ts`

**Frontend:**
- El store tiene `KitchenStation = 'ALL' | 'HOT' | 'COLD' | 'DESSERT'`
- La UI permite selección de estación
- **Pero el filtrado no hace nada:** `orders.filter(_o => activeStation === 'ALL' ? true : true)`

### Análisis de Brechas Actual

| Concepto | Enrutamiento Impresión | Enrutamiento KDS |
|----------|------------------------|------------------|
| Nivel de Asignación | Categoría | Ninguno |
| Override por Área | Sí | No |
| Nivel Producto | No | No |
| Modelo de Datos | Completo | Faltante |
| Servicio | Completo | Solo broadcast |
| Integración | No se llama | Funcionando |

---

## 2. Análisis de Requerimientos

### Requerimientos Funcionales

1. **Asignación de Estación a Producto**
   - Cada producto puede asignarse a una estación KDS (Barra, Cocina, Estación Fría, etc.)
   - Si no está asignado, hereda de la categoría
   - Si la categoría no está asignada, va a estación "default" o "todas"

2. **Filtrado de Estaciones KDS**
   - Cada pantalla KDS muestra solo items de su estación
   - Vista "TODAS" muestra todo (para gerentes/expedidores)

3. **Actualizaciones en Tiempo Real**
   - Cuando se agregan items, solo la estación relevante los recibe
   - Actualizaciones de estado siguen transmitiéndose a todos (para visibilidad a nivel orden)

4. **Integración con Enrutamiento de Impresión** (secundario)
   - La misma asignación de estación podría determinar selección de impresora
   - O mantener enrutamiento de impresión separado (basado en categoría)

### Requerimientos No Funcionales

1. **Compatibilidad hacia Atrás** - Órdenes/productos existentes deben funcionar
2. **Aislamiento Multi-tenant** - Estaciones con scope por tenant
3. **Rendimiento** - Sin queries adicionales por item
4. **Flexibilidad** - Las estaciones deben ser configurables por tenant

---

## 3. Opciones de Arquitectura

### Opción A: Extender Modelo de Producto (Más Simple)

Agregar `kdsStationId` al modelo Product, crear tabla `KdsStation`.

```prisma
model KdsStation {
  id        Int       @id @default(autoincrement())
  tenantId  Int
  name      String    // "Cocina", "Barra", "Fría", "Postres"
  code      String    // "KITCHEN", "BAR", "COLD", "DESSERT"
  isDefault Boolean   @default(false)
  products  Product[]
  categories Category[]
  @@unique([tenantId, code])
}

model Product {
  // ... campos existentes
  kdsStationId  Int?
  kdsStation    KdsStation? @relation(...)
}

model Category {
  // ... campos existentes
  kdsStationId  Int?        // Estación por defecto para productos de esta categoría
  kdsStation    KdsStation? @relation(...)
}
```

**Lógica de Enrutamiento:**
```
Product.kdsStationId ?? Category.kdsStationId ?? tenant.defaultStationId
```

| Pros | Contras |
|------|---------|
| Implementación simple | Sin overrides por área |
| Sigue patrón existente basado en categorías | Diferente del enrutamiento de impresión |
| Fácil de entender | Menos flexible |

### Opción B: Espejo del Patrón de Enrutamiento de Impresión (Más Consistente)

Crear estructura paralela al enrutamiento de impresión para estaciones KDS.

```prisma
model KdsStation {
  id        Int       @id @default(autoincrement())
  tenantId  Int
  name      String
  code      String
  categories Category[]
  areaOverrides AreaKdsStationOverride[]
  @@unique([tenantId, code])
}

model Category {
  kdsStationId  Int?
  kdsStation    KdsStation?
  stationOverrides AreaKdsStationOverride[]
}

model AreaKdsStationOverride {
  id          Int         @id @default(autoincrement())
  tenantId    Int
  areaId      Int
  categoryId  Int?        // null = todas las categorías en esta área
  stationId   Int
  @@unique([areaId, categoryId])
}
```

| Pros | Contras |
|------|---------|
| Consistente con enrutamiento de impresión | Más complejidad |
| Overrides específicos por área | Puede ser sobre-ingeniería |
| Máxima flexibilidad | Más trabajo de UI |

### Opción C: Modelo de Enrutamiento Unificado (Más Flexible)

Crear un único concepto de enrutamiento que maneje tanto impresión COMO KDS.

```prisma
model ProductionStation {
  id          Int       @id @default(autoincrement())
  tenantId    Int
  name        String    // "Cocina", "Barra"
  code        String    // "KITCHEN", "BAR"
  printerId   Int?      // Impresora opcional para esta estación
  printer     Printer?
  @@unique([tenantId, code])
}

model Category {
  stationId   Int?
  station     ProductionStation?
}

model Product {
  stationId   Int?      // Override de la estación de la categoría
  station     ProductionStation?
}
```

**Flujo de Enrutamiento:**
```
1. Determinar estación: Product.stationId ?? Category.stationId ?? default
2. Para KDS: Transmitir al room de socket de la estación
3. Para Impresión: Usar station.printerId (si está configurado)
```

| Pros | Contras |
|------|---------|
| Una única fuente de verdad | Complejidad de migración |
| Modelo intuitivo | Cambia lógica existente de enrutamiento de impresión |
| A prueba de futuro | Mayor esfuerzo inicial |

---

## 4. Enfoque Recomendado: Opción A + Opción C Limitada

**Fase 1: Asignación de Estación KDS (Opción A)**
- Agregar modelo `KdsStation` con estaciones por tenant
- Agregar `kdsStationId` a `Category` (default para categoría)
- Agregar `kdsStationId` a `Product` (override de categoría)
- Actualizar broadcast de KDS para enrutar por estación
- Arreglar filtrado del frontend

**Fase 2: Unificar con Impresión (Opcional, Futuro)**
- Vincular estaciones a impresoras
- Migrar enrutamiento de impresión para usar estaciones

---

## 5. Plan de Implementación (Fase 1)

### 5.1 Cambios de Base de Datos

```prisma
// Nuevo modelo
model KdsStation {
  id         Int        @id @default(autoincrement())
  tenantId   Int
  tenant     Tenant     @relation(fields: [tenantId], references: [id])
  name       String
  code       String     // KITCHEN, BAR, COLD, DESSERT, etc.
  sortOrder  Int        @default(0)
  isActive   Boolean    @default(true)
  isDefault  Boolean    @default(false)  // Una por tenant
  createdAt  DateTime   @default(now())

  products   Product[]
  categories Category[]

  @@unique([tenantId, code])
  @@index([tenantId])
}

// Modificar modelos existentes
model Category {
  // ... existente
  kdsStationId  Int?
  kdsStation    KdsStation? @relation(fields: [kdsStationId], references: [id])
}

model Product {
  // ... existente
  kdsStationId  Int?
  kdsStation    KdsStation? @relation(fields: [kdsStationId], references: [id])
}
```

### 5.2 Cambios de Backend

#### Nuevo Servicio: `kdsStation.service.ts`
- `createStation(tenantId, name, code)` - Crear nueva estación
- `updateStation(id, tenantId, data)` - Actualizar estación
- `deleteStation(id, tenantId)` - Eliminar (solo si no hay productos asignados)
- `getStations(tenantId)` - Listar todas las estaciones
- `setDefaultStation(id, tenantId)` - Establecer como default
- `seedDefaultStations(tenantId)` - Crear estaciones iniciales para nuevo tenant

#### Modificar: `kds.service.ts`
```typescript
// Actual
broadcastNewOrder(order) {
  io.to(`tenant:${tenantId}:kitchen`).emit('kitchen:order_new', payload);
}

// Nuevo - también transmitir a rooms específicos de estación
broadcastNewOrder(order) {
  // Transmitir a cocina general (para vista TODAS)
  io.to(`tenant:${tenantId}:kitchen`).emit('kitchen:order_new', payload);

  // Agrupar items por estación y transmitir a rooms específicos
  const itemsByStation = groupItemsByStation(order.items);
  for (const [stationCode, items] of itemsByStation) {
    io.to(`tenant:${tenantId}:kitchen:station:${stationCode}`)
      .emit('kitchen:station_items', { orderId: order.id, items });
  }
}
```

#### Modificar: `orderKitchen.service.ts`
```typescript
// Agregar parámetro de filtro por estación
async getActiveOrders(tenantId: number, stationCode?: string) {
  return prisma.order.findMany({
    where: {
      tenantId,
      status: { in: ['OPEN', 'CONFIRMED', 'IN_PREPARATION', 'PREPARED'] },
      // Filtrar por estación si se especifica
      ...(stationCode && stationCode !== 'ALL' ? {
        items: {
          some: {
            product: {
              OR: [
                { kdsStation: { code: stationCode } },
                { kdsStationId: null, category: { kdsStation: { code: stationCode } } }
              ]
            }
          }
        }
      } : {})
    },
    include: {
      items: {
        where: stationCode && stationCode !== 'ALL' ? {
          product: {
            OR: [
              { kdsStation: { code: stationCode } },
              { kdsStationId: null, category: { kdsStation: { code: stationCode } } }
            ]
          }
        } : undefined,
        include: { product: { include: { kdsStation: true } } }
      }
    }
  });
}
```

### 5.3 Cambios de Frontend

#### Página KDS (`KitchenPage.tsx`)
```typescript
// Unirse a room específico de estación cuando se selecciona
useEffect(() => {
  if (socket && isConnected) {
    socket.emit('join:kitchen');
    if (activeStation !== 'ALL') {
      socket.emit('join:kitchen:station', activeStation);
    }

    // Escuchar items específicos de estación
    socket.on('kitchen:station_items', ({ orderId, items }) => {
      // Actualizar orden con nuevos items para esta estación
    });
  }
}, [socket, isConnected, activeStation]);

// Obtener órdenes con filtro de estación
const loadActiveOrders = async () => {
  const data = await orderService.getActiveOrders(activeStation);
  setOrders(data);
};
```

#### Admin: Página de Gestión de Estaciones (Nueva)
- Listar todas las estaciones con arrastrar para reordenar
- Modal de crear/editar estación
- Eliminar estación (con confirmación)
- Establecer estación por defecto

#### Admin: Formulario de Producto
- Agregar selector dropdown de estación
- Opción "Heredar de categoría" (valor null)

#### Admin: Formulario de Categoría
- Agregar selector dropdown de estación por defecto

---

## 6. Análisis de Riesgos

### Riesgo Alto

| Riesgo | Impacto | Probabilidad | Mitigación |
|--------|---------|--------------|------------|
| Migración de datos rompe productos existentes | Órdenes dejan de aparecer en KDS | Media | Estación por defecto asignada a todos los productos/categorías existentes vía migración |
| Conflictos en nombres de rooms de socket | Estación incorrecta recibe items | Baja | Usar `code` de estación (mayúsculas, validado) consistentemente |
| Filtración de datos multi-tenant | Brecha de seguridad | Baja | Todas las queries incluyen `tenantId`, rooms de socket prefijados con tenant |

### Riesgo Medio

| Riesgo | Impacto | Probabilidad | Mitigación |
|--------|---------|--------------|------------|
| Degradación de rendimiento | Creación de órdenes lenta | Media | Lookup de estaciones en batch, cachear códigos de estación en memoria |
| Desincronización de estado del frontend | UI muestra items incorrectos | Media | Limpiar caché al cambiar estación, refetch al reconectar |
| Compatibilidad hacia atrás | APIs se rompen | Baja | `kdsStationId` nullable, lógica de fallback por defecto |
| Lógica de estaciones compleja | Bugs en enrutamiento | Media | Tests unitarios completos para lógica de enrutamiento |

### Riesgo Bajo

| Riesgo | Impacto | Probabilidad | Mitigación |
|--------|---------|--------------|------------|
| UI de admin compleja | Confusión del usuario | Baja | Divulgación progresiva, defaults sensatos |
| Sobre-emisión de eventos de socket | Overhead de red | Baja | Solo emitir a rooms relevantes, no broadcast |
| Eliminación de estación con productos asignados | Integridad de datos | Baja | Prevenir eliminación o reasignar a default |

---

## 7. Preguntas Clave Antes de Implementar

### Debe Decidirse

1. **¿El enrutamiento de estación también debería afectar la impresión?**
   - Opción A: Mapeo Estación → Impresora (unifica sistemas)
   - Opción B: Mantener enrutamiento de impresión separado (más flexibilidad)
   - **Recomendación:** Fase 1 = separado, Fase 2 = unificación opcional

2. **¿Los productos pueden sobrescribir la estación de la categoría?**
   - **Recomendación:** Sí (Product.kdsStationId sobrescribe Category.kdsStationId)

3. **¿Las estaciones deben ser por-tenant o globales?**
   - **Recomendación:** Por-tenant (los restaurantes tienen diferentes necesidades)

4. **¿Qué pasa con items sin estación?**
   - Opción A: No mostrar en ninguna vista de estación (mala UX)
   - Opción B: Mostrar solo en vista TODAS (recomendado)
   - Opción C: Asignar a estación por defecto automáticamente

5. **¿Deberían existir overrides por área para KDS?**
   - **Recomendación Fase 1:** No (mantener simple)
   - **Recomendación Fase 2:** Considerar si es necesario

### Bueno Tener

6. **¿Las estaciones deberían tener colores para UI?**
   - Útil para identificación visual rápida

7. **¿Las estaciones deberían soportar iconos?**
   - Podría usar emoji o librería de iconos

8. **¿Debería haber permisos a nivel de estación?**
   - ej: "Usuario X solo puede ver estación BARRA"

---

## 8. Alcance Estimado

| Componente | Esfuerzo | Archivos Cambiados/Creados |
|------------|----------|---------------------------|
| Esquema de base de datos | Bajo | 1 (schema.prisma) |
| Script de migración | Bajo | 1 nueva migración |
| Servicio KdsStation | Medio | 1 nuevo servicio |
| Controlador/rutas KdsStation | Bajo | 2 nuevos archivos |
| Modificar kds.service.ts | Medio | 1 archivo |
| Modificar orderKitchen.service.ts | Medio | 1 archivo |
| Modificar queries de producto | Bajo | 2-3 archivos |
| Frontend: Página admin de estaciones | Medio | 1-2 nuevas páginas |
| Frontend: Formulario de producto | Bajo | 1 archivo |
| Frontend: Formulario de categoría | Bajo | 1 archivo |
| Frontend: Filtrado KDS | Medio | 2 archivos |
| Tests | Medio | 3-4 archivos |
| **Total** | **Medio** | **~15-20 archivos** |

### Cronograma Estimado

| Fase | Duración | Entregable |
|------|----------|------------|
| Base de datos + Migración | 1 día | Cambios de esquema, script de migración |
| Servicios Backend | 2 días | Servicio KdsStation, servicio KDS modificado |
| API Backend | 1 día | Controlador, rutas, tests |
| Frontend Admin | 2 días | Gestión de estaciones, formularios de producto/categoría |
| Frontend KDS | 1-2 días | Filtrado, integración de socket |
| Testing + QA | 1 día | Testing de integración |
| **Total** | **8-9 días** | Fase 1 Completa |

---

## 9. Estructura de Archivos Después de Implementación

```
backend/
├── prisma/
│   ├── schema.prisma              # Modificado - modelo KdsStation
│   └── migrations/
│       └── YYYYMMDD_add_kds_stations/
├── src/
│   ├── services/
│   │   ├── kdsStation.service.ts  # NUEVO
│   │   ├── kds.service.ts         # Modificado
│   │   └── orderKitchen.service.ts # Modificado
│   ├── controllers/
│   │   └── kdsStation.controller.ts # NUEVO
│   └── routes/
│       └── kdsStation.routes.ts   # NUEVO

frontend/
├── src/
│   ├── modules/
│   │   ├── admin/
│   │   │   └── pages/
│   │   │       └── KdsStationsPage.tsx  # NUEVO
│   │   └── kitchen/
│   │       └── pages/
│   │           └── KitchenPage.tsx      # Modificado
│   ├── services/
│   │   └── kdsStationService.ts         # NUEVO
│   └── store/
│       └── kitchen.store.ts             # Modificado
```

---

## 10. Estrategia de Migración

### Paso 1: Crear Estaciones por Defecto
```sql
-- Para cada tenant, crear estaciones por defecto
INSERT INTO KdsStation (tenantId, name, code, sortOrder, isDefault)
SELECT id, 'Cocina', 'KITCHEN', 1, true FROM Tenant;

INSERT INTO KdsStation (tenantId, name, code, sortOrder, isDefault)
SELECT id, 'Barra', 'BAR', 2, false FROM Tenant;
```

### Paso 2: Asignar Estación por Defecto a Categorías
```sql
-- Asignar todas las categorías a KITCHEN por defecto
UPDATE Category c
SET kdsStationId = (
  SELECT id FROM KdsStation
  WHERE tenantId = c.tenantId AND isDefault = true
);
```

### Paso 3: Productos Heredan de Categoría
- No se necesita acción - `kdsStationId` null significa "usar estación de la categoría"

---

## 11. Apéndice: Estructura Actual de Rooms de Socket

```
tenant:{tenantId}:kitchen              # Cocina general (vista TODAS)
tenant:{tenantId}:kitchen:station:{code}  # Específico de estación (ej: :KITCHEN, :BAR)
tenant:{tenantId}:waiters              # Notificaciones a mozos
tenant:{tenantId}:table:{tableId}      # Específico de mesa
tenant:{tenantId}:admin:stock          # Alertas de stock
```

Los rooms de estación ya existen en la infraestructura de socket (`socket.ts` línea 168-173) y están correctamente sanitizados. Solo necesitan ser utilizados por el servicio KDS.
