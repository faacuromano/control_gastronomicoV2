/**
 * @fileoverview HMAC Validation Middleware
 *
 * Middleware para validar firmas HMAC de webhooks entrantes.
 * CRÍTICO PARA SEGURIDAD: Previene inyección de pedidos falsos.
 *
 * FLUJO:
 * 1. Leer raw body (buffer, no parseado)
 * 2. Obtener signature del header apropiado según plataforma
 * 3. Validar con el adapter correspondiente
 * 4. Si válido, continuar; si no, 401 Unauthorized
 *
 * @module integrations/delivery/webhooks/hmac.middleware
 */
import type { Request, Response, NextFunction } from 'express';
/**
 * Crea un middleware de validación HMAC para una plataforma específica.
 *
 * @param platformCode - Código de la plataforma (RAPPI, GLOVO, etc.)
 * @returns Express middleware
 *
 * @example
 * ```typescript
 * router.post(
 *   '/webhook/rappi',
 *   express.raw({ type: 'application/json' }),  // IMPORTANTE: raw body
 *   validateHmac('RAPPI'),
 *   webhookController.handleRappiWebhook
 * );
 * ```
 */
export declare function validateHmac(platformCode: string): (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
/**
 * Middleware genérico que detecta la plataforma desde el path.
 * Para rutas como /webhook/:platform
 */
export declare function validateHmacDynamic(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
/**
 * Middleware de bypass para desarrollo local.
 * NUNCA usar en producción.
 */
export declare function skipHmacInDevelopment(req: Request, res: Response, next: NextFunction): void | Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=hmac.middleware.d.ts.map