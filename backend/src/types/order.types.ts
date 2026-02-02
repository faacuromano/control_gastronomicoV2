/**
 * @fileoverview Definiciones de tipos relacionados con ordenes.
 *
 * Extraido de order.service.ts durante la Fase 2 de refactorizacion para
 * separar los contratos de datos de la logica de negocio. Contiene:
 *
 * - Tipos de ENTRADA (contratos de la API externa): lo que el frontend envia
 * - Tipos INTERNOS (implementacion del servicio): estructuras intermedias de calculo
 * - Tipos de Prisma: la estructura exacta que se pasa a prisma.order.create()
 * - Tipos de PAGO: para el endpoint de agregar pagos a ordenes existentes
 *
 * @module types/order.types
 */

import { OrderChannel, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';

// ============================================
// TIPOS DE ENTRADA (Contratos de la API externa)
// ============================================

/**
 * Entrada para un item individual de la orden.
 * Representa lo que el frontend envia por cada producto agregado al carrito.
 */
export interface OrderItemInput {
    productId: number;
    quantity: number;
    /** Notas especiales del cliente (ej: "sin cebolla", "bien cocido") */
    notes?: string | undefined;
    /** Modificadores seleccionados con su precio (ej: extra queso +$50) */
    modifiers?: { id: number; price: number }[] | undefined;
    /** IDs de ingredientes que el cliente quiere remover (ej: sin pickles) */
    removedIngredientIds?: number[] | undefined;
}

/**
 * Datos de delivery para ordenes con envio a domicilio.
 */
export interface DeliveryData {
    address: string;
    notes?: string | undefined;
    phone: string;
    name: string;
    /** ID del repartidor asignado, opcional al crear la orden */
    driverId?: number | undefined;
}

/**
 * Entrada completa para crear una nueva orden.
 * Soporta tanto pago unico legacy como pagos divididos (split payments).
 *
 * El campo paymentMethod acepta 'SPLIT' como valor especial que indica
 * que el array 'payments' contiene multiples metodos de pago parciales.
 */
export interface CreateOrderInput {
    /** ID del tenant, opcional por compatibilidad con migracion (se toma de req.user) */
    tenantId?: number;
    userId: number;
    items: OrderItemInput[];
    /** Canal de la orden (POS, WAITER_APP, QR_MENU, DELIVERY_APP) */
    channel?: OrderChannel | undefined;
    /** ID de la mesa, requerido para ordenes DINE_IN */
    tableId?: number | undefined;
    /** ID del cliente, para asociar la orden a un cliente registrado */
    clientId?: number | undefined;
    /** ID del mozo/servidor que tomo la orden */
    serverId?: number | undefined;
    /** Datos de delivery, requerido para ordenes con envio */
    deliveryData?: DeliveryData | undefined;
    /** Metodo de pago unico o 'SPLIT' para pagos divididos */
    paymentMethod?: PaymentMethod | 'SPLIT' | undefined;
    /** Array de pagos parciales para split payment */
    payments?: { method: string; amount: number }[] | undefined;
    /** Monto de descuento manual aplicado al momento del checkout */
    discount?: number | undefined;
}

// ============================================
// TIPOS INTERNOS (Implementacion del servicio)
// ============================================

/**
 * Estructura interna de un item de orden ya validado y con precio calculado.
 * Se genera despues de validar el producto contra la base de datos y calcular
 * el precio unitario incluyendo modificadores.
 */
export interface OrderItemData {
    productId: number;
    quantity: number;
    /** Precio unitario calculado (precio base + modificadores) */
    unitPrice: number;
    notes?: string | undefined;
    /** Estado inicial del item, tipicamente 'PENDING' */
    status: string;
    /** Modificadores ya validados con sus precios reales de la BD */
    modifiers?: { id: number; price: number }[] | undefined;
}

/**
 * Estructura interna para movimientos de stock que se generan al crear una orden.
 * Cada ingrediente usado en los productos de la orden genera un descuento de stock.
 */
export interface StockUpdate {
    ingredientId: number;
    /** Cantidad a descontar del inventario */
    quantity: number;
}

/**
 * Resultado de la funcion validateAndCalculateItems().
 * Contiene los items validados, los movimientos de stock a aplicar y el subtotal.
 */
export interface ItemCalculationResult {
    /** Items validados con precios calculados, listos para insertar */
    itemDataList: OrderItemData[];
    /** Movimientos de stock a aplicar (descuento de ingredientes) */
    stockUpdates: StockUpdate[];
    /** Suma de (unitPrice * quantity) de todos los items */
    subtotal: number;
}

/**
 * Estructura de datos para prisma.order.create().
 * Refleja exactamente el shape que Prisma espera, incluyendo tenantId
 * en cada nivel de create anidado (OrderItem, OrderItemModifier, Payment)
 * ya que TODOS los modelos del sistema multi-tenant requieren tenantId.
 */
export interface OrderCreateData {
    tenantId: number;
    orderNumber: number;
    channel: OrderChannel;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    subtotal: number;
    total: number;
    /** Fecha de negocio calculada con corte a las 6 AM */
    businessDate: Date;
    tableId?: number;
    clientId?: number;
    serverId?: number;
    driverId?: number;
    deliveryAddress?: string;
    deliveryNotes?: string;
    closedAt?: Date;
    /** Items de la orden con creates anidados de modificadores */
    items: {
        create: {
            tenantId: number;
            product: { connect: { id: number } };
            quantity: number;
            unitPrice: number;
            notes: string | null;
            status: string;
            /** Modificadores seleccionados para este item */
            modifiers?: {
                create: { tenantId: number; modifierOptionId: number; priceCharged: number }[]
            };
        }[];
    };
    /** Pagos asociados a la orden (puede ser vacio si se paga despues) */
    payments?: {
        create: {
            tenantId: number;
            amount: number;
            method: PaymentMethod;
            /** ID del turno de caja activo al momento del pago */
            shiftId: number;
        }[];
    };
}

/**
 * Estructura de datos para actualizar el estado de una orden.
 * Usado en las transiciones de estado del flujo de la orden.
 */
export interface OrderUpdateData {
    status: OrderStatus;
    /** Se establece cuando la orden pasa a un estado final (DELIVERED, CANCELLED) */
    closedAt?: Date;
}

// ============================================
// TIPOS DE PAGO (Agregar pagos a orden existente)
// ============================================

/**
 * Entrada para agregar un pago individual a una orden existente.
 * Usado en el flujo de pago post-creacion (cuando la orden se crea sin pago
 * y se paga despues, o para agregar pagos parciales incrementalmente).
 *
 * @interface AddPaymentInput
 * @property {string} method - Codigo del metodo de pago (ej: 'CASH', 'CARD', 'TRANSFER')
 * @property {number} amount - Monto del pago (debe ser positivo y no cero)
 */
export interface AddPaymentInput {
    method: string;
    amount: number;
}

/**
 * Body del request para POST /orders/:id/payments.
 * Permite agregar uno o mas pagos a una orden existente y opcionalmente
 * cerrar la orden si queda completamente pagada.
 *
 * @interface AddPaymentsRequest
 * @property {AddPaymentInput[]} payments - Array de pagos a agregar
 * @property {boolean} [closeOrder] - Si true y la orden queda pagada, se cierra automaticamente
 */
export interface AddPaymentsRequest {
    payments: AddPaymentInput[];
    closeOrder?: boolean;
}

/**
 * Resultado de la operacion de agregar pagos a una orden.
 * Proporciona un resumen completo del estado de pagos despues de la operacion,
 * permitiendo al frontend actualizar la UI con precision.
 *
 * @interface AddPaymentsResult
 */
export interface AddPaymentsResult {
    /** ID de la orden actualizada */
    orderId: number;
    /** Monto total de la orden */
    orderTotal: number;
    /** Monto total pagado antes de esta operacion */
    previouslyPaid: number;
    /** Monto agregado en esta operacion */
    amountAdded: number;
    /** Monto total pagado despues de esta operacion */
    totalPaid: number;
    /** Saldo restante (negativo si se sobrepago) */
    remainingBalance: number;
    /** Estado de pago actualizado (PENDING, PARTIAL, PAID, REFUNDED) */
    paymentStatus: PaymentStatus;
    /** Indica si la orden fue cerrada por esta operacion */
    orderClosed: boolean;
    /** IDs de los registros de pago creados */
    paymentIds: number[];
}
