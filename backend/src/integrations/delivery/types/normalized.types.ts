/**
 * @fileoverview Tipos Normalizados para Integraciones de Delivery
 *
 * Define las estructuras de datos comunes a las que todas las plataformas
 * (Rappi, Glovo, PedidosYa, UberEats) deben mapear sus datos propietarios.
 *
 * JUSTIFICACION:
 * Cada plataforma tiene su propio esquema de datos para pedidos, clientes,
 * items, direcciones, etc. Este modulo normaliza todos esos formatos dispares
 * en una interfaz comun, de modo que el resto del sistema (servicios, jobs,
 * controladores) solo trabaje con un unico tipo de datos sin importar la
 * plataforma de origen.
 *
 * @module integrations/delivery/types/normalized
 */

// ============================================================================
// ENUMERACIONES
// ============================================================================

/**
 * Plataformas de delivery soportadas por el sistema.
 */
export enum DeliveryPlatformCode {
  RAPPI = 'RAPPI',
  GLOVO = 'GLOVO',
  PEDIDOSYA = 'PEDIDOSYA',
  UBEREATS = 'UBEREATS',
}

/**
 * Estados normalizados de pedido.
 * Cada plataforma mapea sus estados propietarios a estos valores comunes,
 * que a su vez se mapean a los OrderStatus internos del sistema POS.
 */
export enum NormalizedOrderStatus {
  NEW = 'NEW',                      // Recien recibido de la plataforma
  ACCEPTED = 'ACCEPTED',            // Aceptado por el restaurante
  IN_PREPARATION = 'IN_PREPARATION',// En cocina, siendo preparado
  READY = 'READY',                  // Listo para ser retirado por el repartidor
  PICKED_UP = 'PICKED_UP',          // El repartidor retiro el pedido
  ON_ROUTE = 'ON_ROUTE',            // En camino hacia el cliente
  DELIVERED = 'DELIVERED',          // Entregado al cliente
  CANCELLED = 'CANCELLED',          // Cancelado (por plataforma o restaurante)
  REJECTED = 'REJECTED',            // Rechazado por el restaurante
}

/**
 * Tipos de eventos que llegan por webhook desde las plataformas.
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
// TIPOS DEL PEDIDO NORMALIZADO
// ============================================================================

/**
 * Item de pedido normalizado.
 * Representa un producto del pedido con sus modificadores, independiente
 * de como lo envie cada plataforma.
 */
export interface NormalizedOrderItem {
  /** SKU/PLU del producto en la plataforma externa */
  externalSku: string;
  /** Nombre del producto (para logging y visualizacion) */
  name: string;
  /** Cantidad pedida */
  quantity: number;
  /** Precio unitario (puede diferir del precio local del restaurante) */
  unitPrice: number;
  /** Notas especiales del cliente para este item */
  notes?: string | undefined;
  /** Modificadores/extras aplicados al item */
  modifiers: NormalizedModifier[];
  /** Ingredientes que el cliente pidio remover */
  removedIngredients: string[];
}

/**
 * Modificador normalizado (extras, toppings, opciones).
 */
export interface NormalizedModifier {
  /** SKU/ID del modificador en la plataforma externa */
  externalSku: string;
  /** Nombre del modificador */
  name: string;
  /** Precio adicional que cobra este modificador */
  price: number;
  /** Cantidad de este modificador */
  quantity: number;
}

/**
 * Cliente normalizado del pedido.
 */
export interface NormalizedCustomer {
  /** ID del cliente en la plataforma externa */
  externalId: string;
  /** Nombre completo del cliente */
  name: string;
  /** Telefono (puede estar enmascarado por la plataforma por privacidad) */
  phone?: string | undefined;
  /** Correo electronico */
  email?: string | undefined;
}

/**
 * Direccion de entrega normalizada.
 */
export interface NormalizedAddress {
  /** Direccion completa formateada */
  fullAddress: string;
  /** Calle y numero */
  street?: string | undefined;
  /** Ciudad */
  city?: string | undefined;
  /** Codigo postal */
  zipCode?: string | undefined;
  /** Latitud para geolocalizacion */
  latitude?: number | undefined;
  /** Longitud para geolocalizacion */
  longitude?: number | undefined;
  /** Instrucciones adicionales de entrega */
  instructions?: string | undefined;
}

/**
 * Repartidor normalizado (para pedidos con PLATFORM_DELIVERY).
 */
export interface NormalizedDriver {
  /** ID del repartidor en la plataforma externa */
  externalId: string;
  /** Nombre del repartidor */
  name: string;
  /** Telefono de contacto */
  phone?: string;
  /** Tipo de vehiculo */
  vehicleType?: 'MOTORCYCLE' | 'BICYCLE' | 'CAR' | 'WALKING';
  /** Patente del vehiculo */
  licensePlate?: string;
  /** URL de la foto del repartidor */
  photoUrl?: string;
}

/**
 * Estructura de pedido normalizada.
 * Todos los adaptadores DEBEN convertir el payload de su plataforma a este formato.
 * Es el contrato principal que conecta las integraciones externas con el sistema interno.
 */
export interface NormalizedOrder {
  /** ID unico del pedido en la plataforma externa */
  externalId: string;
  /** Codigo de la plataforma de origen */
  platform: DeliveryPlatformCode;
  /** Numero de pedido visible para el cliente en la plataforma */
  displayNumber: string;
  /** Estado actual del pedido */
  status: NormalizedOrderStatus;
  /** Fecha y hora de creacion en la plataforma */
  createdAt: Date;
  /** Tipo de fulfillment: entrega por plataforma, entrega propia, o retiro */
  fulfillmentType: 'PLATFORM_DELIVERY' | 'SELF_DELIVERY' | 'TAKEAWAY';

  // Datos del cliente y la entrega
  customer: NormalizedCustomer;
  deliveryAddress?: NormalizedAddress | undefined;
  driver?: NormalizedDriver | undefined;

  // Items del pedido
  items: NormalizedOrderItem[];

  // Montos del pedido
  subtotal: number;
  deliveryFee: number;
  discount: number;
  tip: number;
  total: number;

  /** Comision de la plataforma (si esta disponible en el payload) */
  platformCommission?: number | undefined;

  /** Hora estimada de entrega */
  estimatedDeliveryAt?: Date | undefined;

  /** Notas generales del pedido */
  notes?: string | undefined;

  /** Metodo de pago utilizado */
  paymentMethod: 'ONLINE' | 'CASH' | 'CARD';

  /** Indica si el pedido ya fue pagado online en la plataforma */
  isPrepaid: boolean;

  /** Payload crudo original para debugging y auditoria */
  rawPayload: unknown;

  /** ID de la tienda en la plataforma externa (usado para resolver el tenant) */
  storeId?: string;
}

// ============================================================================
// TIPOS DE SINCRONIZACION
// ============================================================================

/**
 * Resultado de una sincronizacion de menu con una plataforma.
 */
export interface MenuSyncResult {
  success: boolean;
  syncedProducts: number;
  failedProducts: number;
  errors: Array<{ productId: number; error: string }>;
  syncedAt: Date;
}

/**
 * Actualizacion de disponibilidad de un producto en plataformas externas.
 */
export interface AvailabilityUpdate {
  externalSku: string;
  productId: number;
  isAvailable: boolean;
}

/**
 * Resultado de enviar una actualizacion de estado a una plataforma.
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
 * Webhook procesado tras el parseo y normalizacion del payload.
 */
export interface ProcessedWebhook {
  /** Tipo de evento del webhook */
  eventType: WebhookEventType;
  /** Plataforma de origen */
  platform: DeliveryPlatformCode;
  /** ID del pedido en la plataforma externa */
  externalOrderId: string;
  /** Pedido normalizado (si el evento incluye datos de pedido) */
  order?: NormalizedOrder;
  /** Timestamp de recepcion del webhook */
  receivedAt: Date;
  /** Payload crudo para auditoria */
  rawPayload: unknown;
}

/**
 * Resultado de la validacion HMAC de un webhook.
 */
export interface HmacValidationResult {
  isValid: boolean;
  platform: DeliveryPlatformCode;
  error?: string;
}
