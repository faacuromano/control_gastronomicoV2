"use strict";
/**
 * @fileoverview Webhook Job Processor
 *
 * Worker para procesar webhooks de plataformas de delivery de forma asíncrona.
 * Este worker toma jobs de la cola y los procesa creando/actualizando pedidos.
 *
 * FLUJO:
 * 1. Recibir job de la cola
 * 2. Parsear payload con adapter correspondiente
 * 3. Mapear productos externos a productos internos
 * 4. Crear orden en el sistema
 * 5. Notificar a cocina via WebSocket
 * 6. Aceptar pedido en la plataforma
 *
 * @module integrations/delivery/jobs/webhookProcessor
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookProcessor = void 0;
exports.initWebhookProcessor = initWebhookProcessor;
const queue_1 = require("../../../lib/queue");
const AdapterFactory_1 = require("../adapters/AdapterFactory");
const prisma_1 = require("../../../lib/prisma");
const kds_service_1 = require("../../../services/kds.service");
const marginConsent_service_1 = require("../../../services/marginConsent.service");
const featureFlags_service_1 = require("../../../services/featureFlags.service");
const stockMovement_service_1 = require("../../../services/stockMovement.service");
const logger_1 = require("../../../utils/logger");
const client_1 = require("@prisma/client");
const normalized_types_1 = require("../types/normalized.types");
// ============================================================================
// PROCESSOR
// ============================================================================
/**
 * Handler para procesar webhooks de delivery.
 */
const webhookProcessor = async (job) => {
    const startTime = Date.now();
    const { platform, eventType, externalOrderId, payload, metadata } = job.data;
    logger_1.logger.info('Processing webhook job', {
        jobId: job.id,
        platform,
        eventType,
        externalOrderId,
        attempt: job.attemptsMade + 1,
    });
    try {
        // Obtener adapter
        const adapter = await AdapterFactory_1.AdapterFactory.getByPlatformCode(platform);
        // Parsear payload
        const processedWebhook = adapter.parseWebhookPayload(payload);
        // Procesar según tipo de evento
        switch (eventType) {
            case normalized_types_1.WebhookEventType.ORDER_NEW:
                await processNewOrder(processedWebhook.order, adapter, metadata.requestId);
                break;
            case normalized_types_1.WebhookEventType.ORDER_CANCELLED:
                await processCancelledOrder(externalOrderId, platform);
                break;
            case normalized_types_1.WebhookEventType.STATUS_UPDATE:
                await processStatusUpdate(processedWebhook.order, platform);
                break;
            default:
                logger_1.logger.warn('Unknown webhook event type', { eventType, platform });
        }
        const duration = Date.now() - startTime;
        logger_1.logger.info('Webhook job processed successfully', {
            jobId: job.id,
            platform,
            eventType,
            externalOrderId,
            durationMs: duration,
        });
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger_1.logger.error('Webhook job processing failed', {
            jobId: job.id,
            platform,
            eventType,
            externalOrderId,
            durationMs: duration,
            attempt: job.attemptsMade + 1,
            error: error instanceof Error ? error.message : String(error),
        });
        throw error; // Re-throw para que BullMQ maneje reintentos
    }
};
exports.webhookProcessor = webhookProcessor;
// ============================================================================
// FUNCIONES DE PROCESAMIENTO
// ============================================================================
/**
 * Procesa un nuevo pedido de plataforma externa.
 */
async function processNewOrder(normalizedOrder, adapter, requestId) {
    const { externalId, platform, items } = normalizedOrder;
    // 1. Obtener plataforma de DB (fuera de transacción - solo lectura)
    const deliveryPlatform = await prisma_1.prisma.deliveryPlatform.findUnique({
        where: { code: platform },
    });
    if (!deliveryPlatform) {
        throw new Error(`Platform ${platform} not found in database`);
    }
    // 2. Mapear productos externos a internos (fuera de transacción - solo lectura)
    const mappedItems = await mapExternalItemsToInternal(items, deliveryPlatform.id);
    // 3. Calcular totales usando precios del canal
    let subtotal = 0;
    const orderItems = [];
    for (const mappedItem of mappedItems) {
        if (!mappedItem.internalProductId) {
            logger_1.logger.warn('Product not mapped, skipping', {
                externalSku: mappedItem.externalSku,
                platform,
            });
            continue;
        }
        // Obtener precio efectivo del canal
        const { price } = await marginConsent_service_1.marginConsentService.getEffectivePrice(mappedItem.internalProductId, deliveryPlatform.id);
        const itemTotal = price * mappedItem.quantity;
        subtotal += itemTotal;
        orderItems.push({
            productId: mappedItem.internalProductId,
            quantity: mappedItem.quantity,
            unitPrice: price,
            notes: mappedItem.notes ?? null,
        });
    }
    // 4. ATOMIC TRANSACTION: Deduplication + Sequence + Create
    // FIX RC-001: orderNumber now generated INSIDE transaction
    // FIX RC-002: Deduplication via unique constraint, not TOCTOU check
    let createdOrder;
    try {
        createdOrder = await prisma_1.prisma.$transaction(async (tx) => {
            // Generate order number atomically within transaction
            const sequence = await tx.orderSequence.update({
                where: { id: 1 },
                data: { lastNumber: { increment: 1 } },
            });
            const orderNumber = sequence.lastNumber;
            // Create order - if externalId already exists, P2002 is thrown
            const order = await tx.order.create({
                data: {
                    orderNumber,
                    channel: 'DELIVERY_APP',
                    externalId,
                    externalPayload: normalizedOrder.rawPayload,
                    status: 'CONFIRMED',
                    paymentStatus: normalizedOrder.isPrepaid ? 'PAID' : 'PENDING',
                    subtotal,
                    discount: normalizedOrder.discount,
                    tip: normalizedOrder.tip,
                    total: normalizedOrder.total,
                    fulfillmentType: 'PLATFORM_DELIVERY',
                    deliveryPlatformId: deliveryPlatform.id,
                    deliveryAddress: normalizedOrder.deliveryAddress?.fullAddress ?? null,
                    deliveryNotes: normalizedOrder.notes ?? null,
                    deliveryFee: normalizedOrder.deliveryFee,
                    platformCommission: normalizedOrder.platformCommission ?? null,
                    estimatedDeliveryAt: normalizedOrder.estimatedDeliveryAt ?? null,
                    businessDate: new Date(),
                    items: {
                        create: orderItems.map((item) => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            notes: item.notes,
                            status: 'PENDING',
                        })),
                    },
                },
                include: {
                    items: {
                        include: {
                            product: true,
                        },
                    },
                    deliveryPlatform: true,
                },
            });
            return order;
        });
    }
    catch (error) {
        // FIX RC-002: Handle duplicate via unique constraint violation (P2002)
        if (error instanceof Error &&
            'code' in error &&
            error.code === 'P2002') {
            // Duplicate order - this is expected for webhook retries
            const existingOrder = await prisma_1.prisma.order.findFirst({
                where: { externalId },
            });
            logger_1.logger.warn('Duplicate order detected via constraint, skipping', {
                externalId,
                existingOrderId: existingOrder?.id,
                requestId,
            });
            return; // Idempotent success - order already exists
        }
        throw error; // Re-throw other errors
    }
    logger_1.logger.info('Order created from external platform', {
        orderId: createdOrder.id,
        orderNumber: createdOrder.orderNumber,
        externalId,
        platform,
        itemCount: orderItems.length,
        total: createdOrder.total,
    });
    // 7. Descuento de Stock (si módulo habilitado)
    // FIX ES-001: Track stock sync failures and flag order for reconciliation
    let stockSyncFailed = false;
    await (0, featureFlags_service_1.executeIfEnabled)('enableStock', async () => {
        const stockService = new stockMovement_service_1.StockMovementService();
        for (const item of orderItems) {
            // Obtener ingredientes del producto
            const productIngredients = await prisma_1.prisma.productIngredient.findMany({
                where: { productId: item.productId }
            });
            for (const pi of productIngredients) {
                try {
                    await stockService.register(pi.ingredientId, client_1.StockMoveType.SALE, Number(pi.quantity) * item.quantity, `Delivery Order #${createdOrder.orderNumber} (${platform})`);
                }
                catch (stockError) {
                    // FIX ES-001: Flag as failed, escalate to error level
                    stockSyncFailed = true;
                    logger_1.logger.error('STOCK_SYNC_FAILED: Stock deduction failed for delivery order item', {
                        orderId: createdOrder.id,
                        orderNumber: createdOrder.orderNumber,
                        ingredientId: pi.ingredientId,
                        error: stockError instanceof Error ? stockError.stack : String(stockError),
                    });
                }
            }
        }
        if (!stockSyncFailed) {
            logger_1.logger.info('Stock updated for delivery order', {
                orderId: createdOrder.id,
                orderNumber: createdOrder.orderNumber,
                platform,
            });
        }
    });
    // FIX ES-001: Flag order if stock sync failed
    if (stockSyncFailed) {
        await prisma_1.prisma.order.update({
            where: { id: createdOrder.id },
            data: {
                deliveryNotes: `${createdOrder.deliveryNotes ?? ''}\n[STOCK_SYNC_FAILED] Manual reconciliation required.`.trim(),
            }
        });
        logger_1.logger.warn('Order flagged for stock reconciliation', {
            orderId: createdOrder.id,
            orderNumber: createdOrder.orderNumber,
        });
    }
    // 8. Notificar a cocina
    kds_service_1.kdsService.broadcastNewOrder({
        ...createdOrder,
        source: 'DELIVERY',
        platformName: deliveryPlatform.name,
    });
    // 9. Aceptar pedido en la plataforma
    // FIX ES-002: Retry with exponential backoff, flag on failure
    const MAX_ACCEPT_RETRIES = 3;
    let platformAccepted = false;
    for (let attempt = 1; attempt <= MAX_ACCEPT_RETRIES; attempt++) {
        try {
            const estimatedPrepTime = 20; // 20 minutos por defecto
            await adapter.acceptOrder(externalId, estimatedPrepTime);
            platformAccepted = true;
            logger_1.logger.info('Order accepted in platform', {
                externalId,
                platform,
                estimatedPrepTime,
                attempt,
            });
            break; // Success, exit loop
        }
        catch (acceptError) {
            logger_1.logger.warn('Platform acceptance attempt failed', {
                externalId,
                platform,
                orderId: createdOrder.id,
                attempt,
                maxRetries: MAX_ACCEPT_RETRIES,
                error: acceptError instanceof Error ? acceptError.message : String(acceptError),
            });
            if (attempt < MAX_ACCEPT_RETRIES) {
                // Exponential backoff: 1s, 2s, 4s
                const backoffMs = 1000 * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
        }
    }
    // FIX ES-002: Flag order if platform acceptance failed after all retries
    if (!platformAccepted) {
        logger_1.logger.error('CRITICAL: Platform acceptance failed after all retries', {
            externalId,
            platform,
            orderId: createdOrder.id,
            orderNumber: createdOrder.orderNumber,
        });
        await prisma_1.prisma.order.update({
            where: { id: createdOrder.id },
            data: {
                deliveryNotes: `${createdOrder.deliveryNotes ?? ''}\n[PLATFORM_ACCEPT_FAILED] Customer may receive cancellation! Manual intervention required.`.trim(),
            }
        });
    }
}
/**
 * Procesa una cancelación de pedido.
 */
async function processCancelledOrder(externalOrderId, platform) {
    const order = await prisma_1.prisma.order.findFirst({
        where: { externalId: externalOrderId },
    });
    if (!order) {
        logger_1.logger.warn('Cannot cancel order - not found', {
            externalId: externalOrderId,
            platform,
        });
        return;
    }
    await prisma_1.prisma.order.update({
        where: { id: order.id },
        data: {
            status: 'CANCELLED',
            closedAt: new Date(),
        },
    });
    logger_1.logger.info('Order cancelled from platform', {
        orderId: order.id,
        externalId: externalOrderId,
        platform,
    });
    // Notificar a cocina
    kds_service_1.kdsService.broadcastOrderUpdate({
        id: order.id,
        orderNumber: order.orderNumber,
        status: 'CANCELLED',
    });
}
/**
 * Procesa actualización de estado.
 */
async function processStatusUpdate(normalizedOrder, platform) {
    const { externalId, status } = normalizedOrder;
    const order = await prisma_1.prisma.order.findFirst({
        where: { externalId },
    });
    if (!order) {
        logger_1.logger.warn('Cannot update order status - not found', {
            externalId,
            platform,
        });
        return;
    }
    // Mapear estado normalizado a interno
    const internalStatus = mapNormalizedStatusToInternal(status);
    if (internalStatus) {
        await prisma_1.prisma.order.update({
            where: { id: order.id },
            data: { status: internalStatus },
        });
        logger_1.logger.info('Order status updated from platform', {
            orderId: order.id,
            externalId,
            newStatus: internalStatus,
            platform,
        });
    }
}
// ============================================================================
// HELPERS
// ============================================================================
/**
 * Mapea items externos a productos internos usando ProductChannelPrice.
 */
async function mapExternalItemsToInternal(items, platformId) {
    const result = [];
    for (const item of items) {
        // Buscar mapeo por SKU externo
        const channelPrice = await prisma_1.prisma.productChannelPrice.findFirst({
            where: {
                externalSku: item.externalSku,
                deliveryPlatformId: platformId,
            },
        });
        result.push({
            externalSku: item.externalSku,
            internalProductId: channelPrice?.productId ?? null,
            quantity: item.quantity,
            notes: item.notes,
        });
    }
    return result;
}
// getNextOrderNumber() REMOVED - now inlined in transaction (FIX RC-001)
// Order number generation is now atomic with order creation to prevent race conditions
/**
 * Mapea estado normalizado a estado interno de Order.
 */
function mapNormalizedStatusToInternal(status) {
    const statusMap = {
        NEW: 'OPEN',
        ACCEPTED: 'CONFIRMED',
        IN_PREPARATION: 'IN_PREPARATION',
        READY: 'PREPARED',
        ON_ROUTE: 'ON_ROUTE',
        DELIVERED: 'DELIVERED',
        CANCELLED: 'CANCELLED',
    };
    return statusMap[status] ?? null;
}
// ============================================================================
// INICIALIZACIÓN
// ============================================================================
/**
 * Registra el processor para la cola de webhooks.
 * Debe llamarse al iniciar la aplicación.
 */
function initWebhookProcessor() {
    logger_1.logger.info('Initializing webhook processor...');
    queue_1.queueService.process(queue_1.QUEUE_NAMES.DELIVERY_WEBHOOKS, webhookProcessor);
    logger_1.logger.info('Webhook processor initialized', {
        queue: queue_1.QUEUE_NAMES.DELIVERY_WEBHOOKS,
    });
}
//# sourceMappingURL=webhookProcessor.js.map