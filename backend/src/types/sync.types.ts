/**
 * @fileoverview Tipos para el sistema de sincronizacion offline.
 *
 * Define las estructuras de datos para el flujo bidireccional de sincronizacion
 * entre el cliente (terminal POS) y el servidor. Esto permite que la aplicacion
 * funcione sin conexion a internet y sincronice cuando recupere conectividad.
 *
 * Flujo de sincronizacion:
 * 1. PULL (Servidor -> Cliente): El terminal descarga catalogo de productos,
 *    categorias y rutas de impresion para operar offline.
 * 2. PUSH (Cliente -> Servidor): El terminal envia ordenes y pagos creados
 *    offline para ser procesados y almacenados en el servidor.
 *
 * @module types/sync
 */

import { PaymentMethod, OrderStatus, OrderChannel } from '@prisma/client';

// ============================================================================
// TIPOS PULL (Servidor -> Cliente)
// Estructuras que el servidor envia al terminal para su cache local
// ============================================================================

/**
 * Datos de producto para el cache offline.
 * Incluye toda la informacion necesaria para mostrar el producto en el POS
 * y calcular precios con modificadores sin necesidad de conexion al servidor.
 */
export interface SyncProduct {
    id: number;
    name: string;
    price: number;
    categoryId: number;
    /** Nombre de la categoria desnormalizado para evitar joins en el cliente */
    categoryName: string;
    isActive: boolean;
    productType: string;
    /** Grupos de modificadores con sus opciones y precios */
    modifierGroups: SyncModifierGroup[];
}

/**
 * Grupo de modificadores para el cache offline.
 * Define las reglas de seleccion (minimo/maximo) que el POS debe validar
 * localmente al armar la orden sin conexion.
 */
export interface SyncModifierGroup {
    id: number;
    name: string;
    /** Cantidad minima de opciones que el usuario debe seleccionar */
    minSelection: number;
    /** Cantidad maxima de opciones permitidas (0 = sin limite) */
    maxSelection: number;
    options: SyncModifierOption[];
}

/**
 * Opcion de modificador individual para el cache offline.
 * Contiene el precio adicional que se suma al precio base del producto.
 */
export interface SyncModifierOption {
    id: number;
    name: string;
    /** Precio adicional de este modificador (se suma al precio base del producto) */
    price: number;
}

/**
 * Categoria para el cache offline.
 * Estructura minima necesaria para agrupar productos en la interfaz del POS.
 */
export interface SyncCategory {
    id: number;
    name: string;
}

/**
 * Ruta de impresion para el cache offline.
 * Permite que el terminal imprima tickets y comandas localmente
 * sin consultar al servidor, mapeando cada categoria a su impresora asignada.
 */
export interface SyncPrinterRouting {
    categoryId: number;
    printerId: number;
    printerName: string;
    /** Tipo de conexion de la impresora (NETWORK o USB) */
    connectionType: string;
    /** Direccion IP para impresoras de red */
    ipAddress: string | null;
    /** Nombre de impresora en Windows para conexion USB */
    windowsName: string | null;
}

/**
 * Respuesta del endpoint /sync/pull.
 * Contiene todo el catalogo necesario para que el terminal opere offline:
 * productos con modificadores, categorias y configuracion de impresoras.
 */
export interface SyncPullResponse {
    products: SyncProduct[];
    categories: SyncCategory[];
    printerRouting: SyncPrinterRouting[];
    /** Timestamp del servidor en formato ISO8601 para detectar datos desactualizados */
    serverTime: string;
    /** Token para futura implementacion de sync delta (solo cambios desde ultimo pull) */
    syncToken: string;
}

// ============================================================================
// TIPOS PUSH (Cliente -> Servidor)
// Estructuras que el terminal envia al servidor con operaciones creadas offline
// ============================================================================

/**
 * Item de orden proveniente de la cola offline.
 * Estructura identica a OrderItemInput pero sin dependencia circular de tipos.
 */
export interface PendingOrderItem {
    productId: number;
    quantity: number;
    notes?: string;
    modifiers?: { id: number; price: number }[];
    /** IDs de ingredientes removidos por el cliente (ej: "sin mostaza") */
    removedIngredientIds?: number[];
}

/**
 * Orden pendiente de la cola offline.
 * Creada en el terminal cuando no hay conexion y encolada para
 * sincronizacion cuando se recupere la conectividad.
 */
export interface PendingOrder {
    /** ID temporal generado por el cliente (UUID), se mapea a un ID real tras sync */
    tempId: string;
    items: PendingOrderItem[];
    channel: OrderChannel;
    tableId?: number;
    clientId?: number;
    /** Timestamp ISO8601 de cuando se creo la orden offline (no cuando se sincronizo) */
    createdAt: string;
    /** ID del turno de caja al momento de la creacion (puede haber cambiado al sincronizar) */
    shiftId?: number;
}

/**
 * Pago pendiente de la cola offline.
 * Asociado a una PendingOrder mediante tempOrderId.
 */
export interface PendingPayment {
    /** Referencia al tempId de la PendingOrder asociada */
    tempOrderId: string;
    method: PaymentMethod;
    amount: number;
    /** Timestamp ISO8601 de cuando se registro el pago offline */
    createdAt: string;
}

/**
 * Body del request para el endpoint /sync/push.
 * Contiene todas las operaciones pendientes del terminal para procesar
 * en una sola transaccion de sincronizacion.
 */
export interface SyncPushRequest {
    /** Identificador unico del terminal (para tracking y deteccion de duplicados) */
    clientId: string;
    /** BIZ-009: Token del ultimo pull para deteccion de conflictos (ej: precios cambiaron) */
    syncToken?: string;
    pendingOrders: PendingOrder[];
    pendingPayments: PendingPayment[];
}

// ============================================================================
// TIPOS DE RESPUESTA PUSH
// Resultado de la sincronizacion devuelto al terminal
// ============================================================================

/** Estado posible de una orden tras la sincronizacion */
export type SyncOrderStatus = 'SYNCED' | 'CONFLICT' | 'ERROR';

/**
 * Mapeo entre el ID temporal del cliente y el ID real asignado por el servidor.
 * Permite al terminal actualizar sus referencias locales despues de la sincronizacion.
 */
export interface OrderMapping {
    /** ID temporal generado por el cliente */
    tempId: string;
    /** ID real asignado por el servidor (null si fallo) */
    realId: number | null;
    /** Numero de orden asignado por el servidor (null si fallo) */
    orderNumber: number | null;
    /** Estado del resultado de sincronizacion para esta orden */
    status: SyncOrderStatus;
}

/**
 * Error ocurrido durante la sincronizacion de una orden especifica.
 * Permite al terminal identificar que ordenes fallaron y mostrar
 * opciones de reintento al usuario.
 */
export interface SyncError {
    /** ID temporal de la orden que fallo */
    tempId: string;
    /** Codigo de error interno (ej: 'PRODUCT_NOT_FOUND', 'INSUFFICIENT_STOCK') */
    code: string;
    message: string;
}

/**
 * Advertencia durante la sincronizacion (no fatal).
 * La orden se proceso pero con observaciones (ej: precio cambio desde el pull,
 * turno de caja ya no esta activo, etc.).
 */
export interface SyncWarning {
    tempId: string;
    code: string;
    message: string;
}

/**
 * Respuesta del endpoint /sync/push.
 * Informa al terminal el resultado completo de la sincronizacion:
 * que ordenes se crearon exitosamente, cuales fallaron y cuales tienen advertencias.
 */
export interface SyncPushResponse {
    /** true si al menos una orden se sincronizo exitosamente */
    success: boolean;
    /** Mapeo de IDs temporales a IDs reales para cada orden procesada */
    orderMappings: OrderMapping[];
    /** Errores fatales por orden (la orden no se creo) */
    errors: SyncError[];
    /** Advertencias no fatales (la orden se creo pero con observaciones) */
    warnings: SyncWarning[];
    /** Timestamp ISO8601 del servidor cuando se completo la sincronizacion */
    syncedAt: string;
}
