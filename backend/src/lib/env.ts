/**
 * @fileoverview Validación centralizada de variables de entorno con Zod (CFG-003)
 *
 * Valida todas las variables de entorno requeridas al arranque del servidor.
 * Si alguna variable falta o tiene un formato inválido, el servidor no arranca
 * y muestra un mensaje de error claro indicando qué variable está mal configurada.
 *
 * Uso: importar `env` en vez de acceder a `process.env` directamente.
 * Esto garantiza tipado fuerte y validación centralizada.
 *
 * @module lib/env
 */

import { z } from 'zod';

const envSchema = z.object({
    // Requeridas siempre
    DATABASE_URL: z.string().min(1, 'DATABASE_URL es requerida'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),

    // Servidor
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('3001'),

    // CORS — requerido en producción
    CORS_ORIGINS: z.string().optional(),

    // Redis — requerido si ENABLE_QUEUE_WORKERS=true
    REDIS_HOST: z.string().optional(),
    REDIS_PORT: z.string().default('6379'),
    REDIS_PASSWORD: z.string().optional(),
    ENABLE_QUEUE_WORKERS: z.string().optional(),

    // Seguridad opcional
    PIN_HMAC_SECRET: z.string().optional(),
    DISABLE_RATE_LIMIT: z.string().optional(),
    FIELD_ENCRYPTION_KEY: z.string().optional(), // SEC-009: clave para cifrado de campos sensibles en DB

    // Delivery integrations
    RAPPI_HMAC_SECRET: z.string().optional(),
    GLOVO_HMAC_SECRET: z.string().optional(),
    PEDIDOSYA_HMAC_SECRET: z.string().optional(),
});

/**
 * Valida y parsea las variables de entorno.
 * Lanza un error descriptivo si la validación falla.
 */
function validateEnv() {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        const formatted = result.error.issues
            .map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
            .join('\n');
        throw new Error(
            `CRITICAL: Validación de variables de entorno fallida:\n${formatted}\n\n` +
            `Revisa tu archivo .env y asegúrate de que todas las variables requeridas estén configuradas.`
        );
    }

    // Validaciones condicionales
    const data = result.data;

    if (data.NODE_ENV === 'production' && !data.CORS_ORIGINS) {
        throw new Error('CRITICAL: CORS_ORIGINS es requerida en producción');
    }

    if (data.ENABLE_QUEUE_WORKERS === 'true' && !data.REDIS_HOST) {
        throw new Error('CRITICAL: REDIS_HOST es requerida cuando ENABLE_QUEUE_WORKERS=true');
    }

    return data;
}

export const env = validateEnv();
export type Env = z.infer<typeof envSchema>;
