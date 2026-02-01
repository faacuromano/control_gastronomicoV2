/**
 * @fileoverview Tipos Normalizados para Integraciones de Delivery
 * 
 * Define estructuras de datos comunes que todas las plataformas
 * (Rappi, Glovo, PedidosYa) mapean a un formato interno unificado.
 * 
 * RATIONALE:
 * Cada plataforma tiene su propio schema de pedidos. Este módulo
 * normaliza todos a un formato común para que el resto del sistema
 * solo trabaje con un tipo de dato.
 * 
 * @module integrations/delivery/types/normalized
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Plataformas de delivery soportadas.
 */
export enum DeliveryPlatformCode {
  RAPPI = 'RAPPI',
  GLOVO = 'GLOVO',
  PEDIDOSYA = 'PEDIDOSYA',
  UBEREATS = 'UBEREATS',
}

/**
 * Estados de pedido normalizados.
 * Mapean a los estados internos de OrderStatus.
 */
export enum NormalizedOrderStatus {
  NEW = 'NEW',                      // Recién recibido
  ACCEPTED = 'ACCEPTED',            // Aceptado por restaurante
  IN_PREPARATION = 'IN_PREPARATION',// En cocina
  READY = 'READY',                  // Listo para recoger
  PICKED_UP = 'PICKED_UP',          // Driver recogió
  ON_ROUTE = 'ON_ROUTE',            // En camino
  DELIVERED = 'DELIVERED',          // Entregado
  CANCELLED = 'CANCELLED',          // Cancelado
  REJECTED = 'REJECTED',            // Rechazado por restaurante
}

/**
 * Tipos de evento de webhook.
 */
export enum WebhookEventType {
  ORDER_NEW = 'ORDER_NEW',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  ORDER_MODIFIED = 'ORDER_MODIFIED',
  STATUS_UPDATE = 'STATUS_UPDATE',
  DRIVER_ASSIGNED = 'DRIVER_ASSIGNED',
  DRIVER_ARRIVED = 'DRIVER_ARRIVED',
}

// ============================================================================
// TIPOS DE PEDIDO NORMALIZADO
// ============================================================================

/**
 * Item de pedido normalizado.
 */
export interface NormalizedOrderItem {
  /** SKU/PLU del producto en la plataforma */
  externalSku: string;
  /** Nombre del producto (para logging/display) */
  name: string;
  /** Cantidad pedida */
  quantity: number;
  /** Precio unitario (puede diferir del precio local) */
  unitPrice: number;
  /** Notas especiales del cliente */
  notes?: string | undefined;
  /** Modificadores/extras aplicados */
  modifiers: NormalizedModifier[];
  /** Ingredientes removidos */
  removedIngredients: string[];
}

/**
 * Modificador normalizado.
 */
export interface NormalizedModifier {
  /** SKU/ID del modificador en la plataforma */
  externalSku: string;
  /** Nombre del modificador */
  name: string;
  /** Precio adicional */
  price: number;
  /** Cantidad */
  quantity: number;
}

/**
 * Cliente normalizado.
 */
export interface NormalizedCustomer {
  /** ID del cliente en la plataforma */
  externalId: string;
  /** Nombre del cliente */
  name: string;
  /** Teléfono (puede estar enmascarado) */
  phone?: string | undefined;
  /** Email */
  email?: string | undefined;
}

/**
 * Dirección de entrega normalizada.
 */
export interface NormalizedAddress {
  /** Dirección completa formateada */
  fullAddress: string;
  /** Calle y número */
  street?: string | undefined;
  /** Ciudad */
  city?: string | undefined;
  /** Código postal */
  zipCode?: string | undefined;
  /** Latitud */
  latitude?: number | undefined;
  /** Longitud */
  longitude?: number | undefined;
  /** Instrucciones adicionales */
  instructions?: string | undefined;
}

/**
 * Driver normalizado (para PLATFORM_DELIVERY).
 */
export interface NormalizedDriver {
  /** ID del driver en la plataforma */
  externalId: string;
  /** Nombre del driver */
  name: string;
  /** Teléfono */
  phone?: string;
  /** Tipo de vehículo */
  vehicleType?: 'MOTORCYCLE' | 'BICYCLE' | 'CAR' | 'WALKING';
  /** Matrícula del vehículo */
  licensePlate?: string;
  /** URL de foto del driver */
  photoUrl?: string;
}

/**
 * Estructura de pedido normalizada.
 * Todos los adapters deben convertir su payload a este formato.
 */
export interface NormalizedOrder {
  /** ID único del pedido en la plataforma */
  externalId: string;
  /** Código de la plataforma */
  platform: DeliveryPlatformCode;
  /** Número de orden mostrado al cliente */
  displayNumber: string;
  /** Estado del pedido */
  status: NormalizedOrderStatus;
  /** Timestamp de creación en la plataforma */
  createdAt: Date;
  /** Tipo de fulfillment */
  fulfillmentType: 'PLATFORM_DELIVERY' | 'SELF_DELIVERY' | 'TAKEAWAY';
  
  // Cliente y entrega
  customer: NormalizedCustomer;
  deliveryAddress?: NormalizedAddress | undefined;
  driver?: NormalizedDriver | undefined;
  
  // Items
  items: NormalizedOrderItem[];
  
  // Montos
  subtotal: number;
  deliveryFee: number;
  discount: number;
  tip: number;
  total: number;
  
  /** Comisión de la plataforma (si está disponible) */
  platformCommission?: number | undefined;
  
  /** Hora estimada de entrega */
  estimatedDeliveryAt?: Date | undefined;
  
  /** Notas generales del pedido */
  notes?: string | undefined;
  
  /** Método de pago */
  paymentMethod: 'ONLINE' | 'CASH' | 'CARD';
  
  /** Ya pagado en la plataforma? */
  isPrepaid: boolean;
  
  /** Payload raw original para debugging */
  rawPayload: unknown;

  /** Store ID from the external platform (for tenant resolution) */
  storeId?: string;
}

// ============================================================================
// TIPOS DE SINCRONIZACIÓN
// ============================================================================

/**
 * Resultado de sincronización de menú.
 */
export interface MenuSyncResult {
  success: boolean;
  syncedProducts: number;
  failedProducts: number;
  errors: Array<{ productId: number; error: string }>;
  syncedAt: Date;
}

/**
 * Actualización de disponibilidad de producto.
 */
export interface AvailabilityUpdate {
  externalSku: string;
  productId: number;
  isAvailable: boolean;
}

/**
 * Resultado de actualización de estado.
 */
export interface StatusUpdateResult {
  success: boolean;
  externalId: string;
  newStatus: NormalizedOrderStatus;
  error?: string;
}

// ============================================================================
// TIPOS DE WEBHOOK
// ============================================================================

/**
 * Payload de webhook procesado.
 */
export interface ProcessedWebhook {
  /** Tipo de evento */
  eventType: WebhookEventType;
  /** Plataforma de origen */
  platform: DeliveryPlatformCode;
  /** ID del pedido externo */
  externalOrderId: string;
  /** Pedido normalizado (si aplica) */
  order?: NormalizedOrder;
  /** Timestamp de recepción */
  receivedAt: Date;
  /** Payload raw para auditoría */
  rawPayload: unknown;
}

/**
 * Resultado de validación HMAC.
 */
export interface HmacValidationResult {
  isValid: boolean;
  platform: DeliveryPlatformCode;
  error?: string;
}
