import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const CACHE_TTL_SECONDS = parseInt(process.env.IDEMPOTENCY_CACHE_TTL_SECONDS || '300', 10);
const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000;
const CACHE_MAX_SIZE = 10_000;

// =============================================================================
// Interfaz de Cache e Implementaciones
// =============================================================================

interface CachedResponse {
    response: unknown;
    status: number;
}

interface IdempotencyCache {
    get(key: string): Promise<CachedResponse | null>;
    set(key: string, value: CachedResponse): Promise<void>;
}

/**
 * Cache en memoria como respaldo.
 * Se usa cuando Redis no esta disponible (entorno de desarrollo o fallo de conexion).
 *
 * Limitaciones: solo funciona en un unico pod/instancia del servidor.
 * Los datos se pierden al reiniciar el proceso.
 */
class MemoryCache implements IdempotencyCache {
    private cache = new Map<string, CachedResponse & { expiry: number }>();

    constructor() {
        // Limpieza periodica de entradas expiradas cada 60 segundos.
        // .unref() evita que este intervalo mantenga vivo el proceso de Node.
        setInterval(() => {
            const now = Date.now();
            for (const [key, entry] of this.cache) {
                if (entry.expiry < now) this.cache.delete(key);
            }
        }, 60 * 1000).unref();
    }

    async get(key: string): Promise<CachedResponse | null> {
        const entry = this.cache.get(key);
        if (entry && entry.expiry > Date.now()) {
            return { response: entry.response, status: entry.status };
        }
        if (entry) this.cache.delete(key);
        return null;
    }

    async set(key: string, value: CachedResponse): Promise<void> {
        // Eviccion del elemento mas antiguo si se alcanza el limite maximo
        if (this.cache.size >= CACHE_MAX_SIZE) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) this.cache.delete(oldestKey);
        }
        this.cache.set(key, {
            ...value,
            expiry: Date.now() + CACHE_TTL_MS
        });
    }
}

/**
 * Cache respaldado por Redis para despliegues multi-pod.
 * Usa SETEX para expiracion automatica basada en TTL, delegando la
 * limpieza de entradas expiradas a Redis en lugar de gestionarla manualmente.
 */
/** Interfaz minima compatible con ioredis para el cache de idempotencia */
interface RedisLike {
    get(key: string): Promise<string | null>;
    setex(key: string, seconds: number, value: string): Promise<string>;
}

class RedisCache implements IdempotencyCache {
    private redis: RedisLike;
    private prefix = 'idempotency:';

    constructor(redis: RedisLike) {
        this.redis = redis;
    }

    async get(key: string): Promise<CachedResponse | null> {
        try {
            const raw = await this.redis.get(this.prefix + key);
            if (!raw) return null;
            return JSON.parse(raw) as CachedResponse;
        } catch (err) {
            logger.warn('Redis idempotency get failed, skipping cache', { error: (err as Error).message });
            return null;
        }
    }

    async set(key: string, value: CachedResponse): Promise<void> {
        try {
            await this.redis.setex(this.prefix + key, CACHE_TTL_SECONDS, JSON.stringify(value));
        } catch (err) {
            logger.warn('Redis idempotency set failed', { error: (err as Error).message });
        }
    }
}

// =============================================================================
// Inicializacion del Cache
// =============================================================================

let cache: IdempotencyCache;

/**
 * Obtiene o inicializa la instancia del cache de idempotencia.
 * Intenta conectar a Redis primero; si no esta disponible o falla la conexion,
 * cae automaticamente al cache en memoria como respaldo seguro.
 */
function getCache(): IdempotencyCache {
    if (cache) return cache;

    // Intentar conectar a Redis si esta configurado en las variables de entorno
    const redisHost = process.env.REDIS_HOST;
    if (redisHost) {
        try {
            // Import dinamico para evitar dependencia dura con ioredis
            const Redis = require('ioredis');
            const redis = new Redis({
                host: redisHost,
                port: parseInt(process.env.REDIS_PORT || '6379', 10),
                ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
                maxRetriesPerRequest: 3,
                lazyConnect: true,
                keyPrefix: '',
            });

            redis.connect().then(() => {
                logger.info('[Idempotency] Using Redis cache');
            }).catch((err: Error) => {
                logger.warn('[Idempotency] Redis connect failed, falling back to memory', { error: err.message });
                cache = new MemoryCache();
            });

            cache = new RedisCache(redis);
            return cache;
        } catch {
            logger.warn('[Idempotency] ioredis not available, using memory cache');
        }
    }

    cache = new MemoryCache();
    logger.info('[Idempotency] Using in-memory cache (single-pod only)');
    return cache;
}

// =============================================================================
// Middleware
// =============================================================================

/**
 * Middleware de idempotencia para endpoints POST.
 * Usa el header X-Idempotency-Key para detectar y deduplicar solicitudes reintentadas.
 *
 * Cuando el frontend reintenta una solicitud POST (por timeout o error de red),
 * este middleware devuelve la respuesta cacheada en lugar de procesar la operacion
 * de nuevo, evitando duplicados (ej: cobros dobles, ordenes duplicadas).
 *
 * Flujo:
 * 1. Si no hay clave de idempotencia, continuar normalmente (compatibilidad retroactiva)
 * 2. Generar clave con scope de tenant+usuario para prevenir colisiones entre tenants
 * 3. Si la clave ya existe en cache, devolver la respuesta cacheada
 * 4. Si no existe, interceptar res.json() para cachear la respuesta exitosa (2xx)
 *
 * Soporta Redis (multi-pod) con respaldo automatico a memoria (single-pod).
 */
export function idempotency(req: Request, res: Response, next: NextFunction): void {
    const key = req.headers['x-idempotency-key'] as string;

    // Si no se proporciono clave de idempotencia, omitir (compatibilidad retroactiva)
    if (!key) {
        next();
        return;
    }

    // Acotar la clave al usuario + tenant autenticado para prevenir colisiones cross-tenant
    const user = req.user;
    const scopedKey = user ? `${user.tenantId}:${user.id}:${key}` : key;

    const store = getCache();

    // Verificar cache (asincrono)
    store.get(scopedKey).then(cached => {
        if (cached) {
            logger.debug('Idempotency cache hit', { key: scopedKey });
            res.status(cached.status).json(cached.response);
            return;
        }

        // Interceptar la respuesta para cachearla antes de enviarla al cliente
        const originalJson = res.json.bind(res);
        res.json = (body: unknown) => {
            // Solo cachear respuestas exitosas (2xx) para evitar cachear errores transitorios
            if (res.statusCode >= 200 && res.statusCode < 300) {
                store.set(scopedKey, {
                    response: body,
                    status: res.statusCode
                }).catch(() => { /* fire-and-forget: no bloquear la respuesta */ });
            }
            return originalJson(body);
        };

        next();
    }).catch(() => {
        // Si la verificacion del cache falla, continuar sin idempotencia
        next();
    });
}
