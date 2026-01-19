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

import { queueService, QUEUE_NAMES, type JobHandler } from '../../../lib/queue';
import { AdapterFactory } from '../adapters/AdapterFactory';
import { prisma } from '../../../lib/prisma';
import { kdsService } from '../../../services/kds.service';
import { marginConsentService } from '../../../services/marginConsent.service';
import { executeIfEnabled } from '../../../services/featureFlags.service';
import { StockMovementService } from '../../../services/stockMovement.service';
import { logger } from '../../../utils/logger';
import { StockMoveType } from '@prisma/client';
import {
  DeliveryPlatformCode,
  WebhookEventType,
  NormalizedOrder,
  NormalizedOrderItem,
} from '../types/normalized.types';

// ============================================================================
// TIPOS
// ============================================================================

interface WebhookJobData {
  platform: DeliveryPlatformCode;
  eventType: WebhookEventType;
  externalOrderId: string;
  payload: unknown;
  receivedAt: string;
  metadata: {
    ip?: string;
    userAgent?: string;
    requestId: string;
  };
}

// ============================================================================
// PROCESSOR
// ============================================================================

/**
 * Handler para procesar webhooks de delivery.
 */
const webhookProcessor: JobHandler<WebhookJobData> = async (job) => {
  const startTime = Date.now();
  const { platform, eventType, externalOrderId, payload, metadata } = job.data;

  logger.info('Processing webhook job', {
    jobId: job.id,
    platform,
    eventType,
    externalOrderId,
    attempt: job.attemptsMade + 1,
  });

  try {
    // Obtener adapter
    const adapter = await AdapterFactory.getByPlatformCode(platform);

    // Parsear payload
    const processedWebhook = adapter.parseWebhookPayload(payload);

    // Procesar según tipo de evento
    switch (eventType) {
      case WebhookEventType.ORDER_NEW:
        await processNewOrder(processedWebhook.order!, adapter, metadata.requestId);
        break;

      case WebhookEventType.ORDER_CANCELLED:
        await processCancelledOrder(externalOrderId, platform);
        break;

      case WebhookEventType.STATUS_UPDATE:
        await processStatusUpdate(processedWebhook.order!, platform);
        break;

      default:
        logger.warn('Unknown webhook event type', { eventType, platform });
    }

    const duration = Date.now() - startTime;
    logger.info('Webhook job processed successfully', {
      jobId: job.id,
      platform,
      eventType,
      externalOrderId,
      durationMs: duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Webhook job processing failed', {
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

// ============================================================================
// FUNCIONES DE PROCESAMIENTO
// ============================================================================

/**
 * Procesa un nuevo pedido de plataforma externa.
 */
async function processNewOrder(
  normalizedOrder: NormalizedOrder,
  adapter: Awaited<ReturnType<typeof AdapterFactory.getByPlatformCode>>,
  requestId: string
): Promise<void> {
  const { externalId, platform, items } = normalizedOrder;

  // 1. Obtener plataforma de DB (fuera de transacción - solo lectura)
  const deliveryPlatform = await prisma.deliveryPlatform.findUnique({
    where: { code: platform },
  });

  if (!deliveryPlatform) {
    throw new Error(`Platform ${platform} not found in database`);
  }

  // 2. Mapear productos externos a internos (fuera de transacción - solo lectura)
  const mappedItems = await mapExternalItemsToInternal(items, deliveryPlatform.id);

  // 3. Calcular totales usando precios del canal
  let subtotal = 0;
  const orderItems: Array<{
    productId: number;
    quantity: number;
    unitPrice: number;
    notes: string | null;
  }> = [];

  for (const mappedItem of mappedItems) {
    if (!mappedItem.internalProductId) {
      logger.warn('Product not mapped, skipping', {
        externalSku: mappedItem.externalSku,
        platform,
      });
      continue;
    }

    // Obtener precio efectivo del canal
    const { price } = await marginConsentService.getEffectivePrice(
      mappedItem.internalProductId,
      deliveryPlatform.id
    );

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
    createdOrder = await prisma.$transaction(async (tx) => {
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
          externalPayload: normalizedOrder.rawPayload as object,
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
  } catch (error: unknown) {
    // FIX RC-002: Handle duplicate via unique constraint violation (P2002)
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      // Duplicate order - this is expected for webhook retries
      const existingOrder = await prisma.order.findFirst({
        where: { externalId },
      });
      logger.warn('Duplicate order detected via constraint, skipping', {
        externalId,
        existingOrderId: existingOrder?.id,
        requestId,
      });
      return; // Idempotent success - order already exists
    }
    throw error; // Re-throw other errors
  }

  logger.info('Order created from external platform', {
    orderId: createdOrder.id,
    orderNumber: createdOrder.orderNumber,
    externalId,
    platform,
    itemCount: orderItems.length,
    total: createdOrder.total,
  });

  // 7. Descuento de Stock (si módulo habilitado)
  // Se ejecuta FUERA de la transacción - si falla, el pedido ya existe (preferible a perderlo)
  await executeIfEnabled('enableStock', async () => {
    const stockService = new StockMovementService();
    
    for (const item of orderItems) {
      // Obtener ingredientes del producto
      const productIngredients = await prisma.productIngredient.findMany({
        where: { productId: item.productId }
      });
      
      for (const pi of productIngredients) {
        try {
          await stockService.register(
            pi.ingredientId,
            StockMoveType.SALE,
            Number(pi.quantity) * item.quantity,
            `Delivery Order #${createdOrder.orderNumber} (${platform})`
          );
        } catch (stockError) {
          // Log pero no fallar - el pedido ya está creado
          logger.warn('Stock deduction failed for delivery order item', {
            orderId: createdOrder.id,
            ingredientId: pi.ingredientId,
            error: stockError instanceof Error ? stockError.message : String(stockError),
          });
        }
      }
    }
    
    logger.info('Stock updated for delivery order', {
      orderId: createdOrder.id,
      orderNumber: createdOrder.orderNumber,
      platform,
    });
  });

  // 8. Notificar a cocina
  kdsService.broadcastNewOrder({
    ...createdOrder,
    source: 'DELIVERY',
    platformName: deliveryPlatform.name,
  });

  // 8. Aceptar pedido en la plataforma
  try {
    // Usar tiempo estimado por defecto
    const estimatedPrepTime = 20; // 20 minutos por defecto
    await adapter.acceptOrder(externalId, estimatedPrepTime);
    
    logger.info('Order accepted in platform', {
      externalId,
      platform,
      estimatedPrepTime,
    });
  } catch (acceptError) {
    logger.error('Failed to accept order in platform', {
      externalId,
      platform,
      error: acceptError instanceof Error ? acceptError.message : String(acceptError),
    });
    // No lanzamos error aquí - el pedido ya está creado
  }
}

/**
 * Procesa una cancelación de pedido.
 */
async function processCancelledOrder(
  externalOrderId: string,
  platform: DeliveryPlatformCode
): Promise<void> {
  const order = await prisma.order.findFirst({
    where: { externalId: externalOrderId },
  });

  if (!order) {
    logger.warn('Cannot cancel order - not found', {
      externalId: externalOrderId,
      platform,
    });
    return;
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: 'CANCELLED',
      closedAt: new Date(),
    },
  });

  logger.info('Order cancelled from platform', {
    orderId: order.id,
    externalId: externalOrderId,
    platform,
  });

  // Notificar a cocina
  kdsService.broadcastOrderUpdate({
    id: order.id,
    orderNumber: order.orderNumber,
    status: 'CANCELLED',
  });
}

/**
 * Procesa actualización de estado.
 */
async function processStatusUpdate(
  normalizedOrder: NormalizedOrder,
  platform: DeliveryPlatformCode
): Promise<void> {
  const { externalId, status } = normalizedOrder;

  const order = await prisma.order.findFirst({
    where: { externalId },
  });

  if (!order) {
    logger.warn('Cannot update order status - not found', {
      externalId,
      platform,
    });
    return;
  }

  // Mapear estado normalizado a interno
  const internalStatus = mapNormalizedStatusToInternal(status);

  if (internalStatus) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: internalStatus as any },
    });

    logger.info('Order status updated from platform', {
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
async function mapExternalItemsToInternal(
  items: NormalizedOrderItem[],
  platformId: number
): Promise<Array<{
  externalSku: string;
  internalProductId: number | null;
  quantity: number;
  notes: string | undefined;
}>> {
  const result: Array<{
    externalSku: string;
    internalProductId: number | null;
    quantity: number;
    notes: string | undefined;
  }> = [];

  for (const item of items) {
    // Buscar mapeo por SKU externo
    const channelPrice = await prisma.productChannelPrice.findFirst({
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
function mapNormalizedStatusToInternal(status: string): string | null {
  const statusMap: Record<string, string> = {
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
export function initWebhookProcessor(): void {
  logger.info('Initializing webhook processor...');
  
  queueService.process(QUEUE_NAMES.DELIVERY_WEBHOOKS, webhookProcessor);
  
  logger.info('Webhook processor initialized', {
    queue: QUEUE_NAMES.DELIVERY_WEBHOOKS,
  });
}

export { webhookProcessor };
