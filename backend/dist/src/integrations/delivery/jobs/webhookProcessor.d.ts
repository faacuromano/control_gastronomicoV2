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
import { type JobHandler } from '../../../lib/queue';
import { DeliveryPlatformCode, WebhookEventType } from '../types/normalized.types';
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
/**
 * Handler para procesar webhooks de delivery.
 */
declare const webhookProcessor: JobHandler<WebhookJobData>;
/**
 * Registra el processor para la cola de webhooks.
 * Debe llamarse al iniciar la aplicación.
 */
export declare function initWebhookProcessor(): void;
export { webhookProcessor };
//# sourceMappingURL=webhookProcessor.d.ts.map