/**
 * @fileoverview Webhook Controller
 *
 * Controller para recibir y procesar webhooks de plataformas de delivery.
 * Implementa procesamiento asíncrono via Queue para resiliencia.
 *
 * FLUJO:
 * 1. Recibir webhook (validado por HMAC middleware)
 * 2. Encolar para procesamiento asíncrono
 * 3. Responder 200 OK inmediatamente (< 100ms)
 * 4. Worker procesa y crea/actualiza orden
 *
 * @module integrations/delivery/webhooks/webhook.controller
 */
import type { Request, Response } from 'express';
declare class WebhookController {
    /**
     * Handler genérico para webhooks de cualquier plataforma.
     * Detecta la plataforma desde el parámetro de la ruta.
     *
     * @route POST /api/v1/webhooks/:platform
     */
    handleWebhook(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Handler específico para Rappi.
     * Alias para handleWebhook con platform forzado.
     *
     * @route POST /api/v1/webhooks/rappi
     */
    handleRappiWebhook(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Handler específico para Glovo.
     *
     * @route POST /api/v1/webhooks/glovo
     */
    handleGlovoWebhook(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Handler específico para PedidosYa.
     *
     * @route POST /api/v1/webhooks/pedidosya
     */
    handlePedidosYaWebhook(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Health check para verificar que los webhooks funcionan.
     * Útil para configurar en las plataformas.
     *
     * @route GET /api/v1/webhooks/health
     */
    healthCheck(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
export declare const webhookController: WebhookController;
export {};
//# sourceMappingURL=webhook.controller.d.ts.map