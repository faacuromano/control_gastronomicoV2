import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_TTL_SECONDS = 300; // 5 minutes (for Redis SETEX)
const CACHE_MAX_SIZE = 10_000;

// =============================================================================
// Cache Interface + Implementations
// =============================================================================

interface IdempotencyCache {
    get(key: string): Promise<{ response: any; status: number } | null>;
    set(key: string, value: { response: any; status: number }): Promise<void>;
}

/**
 * In-memory fallback cache.
 * Used when Redis is not available.
 */
class MemoryCache implements IdempotencyCache {
    private cache = new Map<string, { response: any; status: number; expiry: number }>();

    constructor() {
        // Cleanup expired entries every minute
        setInterval(() => {
            const now = Date.now();
            for (const [key, entry] of this.cache) {
                if (entry.expiry < now) this.cache.delete(key);
            }
        }, 60 * 1000).unref();
    }

    async get(key: string): Promise<{ response: any; status: number } | null> {
        const entry = this.cache.get(key);
        if (entry && entry.expiry > Date.now()) {
            return { response: entry.response, status: entry.status };
        }
        if (entry) this.cache.delete(key);
        return null;
    }

    async set(key: string, value: { response: any; status: number }): Promise<void> {
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
 * Redis-backed cache for multi-pod deployments.
 * Uses SETEX for automatic TTL-based expiration.
 */
class RedisCache implements IdempotencyCache {
    private redis: any; // ioredis instance
    private prefix = 'idempotency:';

    constructor(redis: any) {
        this.redis = redis;
    }

    async get(key: string): Promise<{ response: any; status: number } | null> {
        try {
            const raw = await this.redis.get(this.prefix + key);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (err) {
            logger.warn('Redis idempotency get failed, skipping cache', { error: (err as Error).message });
            return null;
        }
    }

    async set(key: string, value: { response: any; status: number }): Promise<void> {
        try {
            await this.redis.setex(this.prefix + key, CACHE_TTL_SECONDS, JSON.stringify(value));
        } catch (err) {
            logger.warn('Redis idempotency set failed', { error: (err as Error).message });
        }
    }
}

// =============================================================================
// Cache Initialization
// =============================================================================

let cache: IdempotencyCache;

function getCache(): IdempotencyCache {
    if (cache) return cache;

    // Try to connect to Redis
    const redisHost = process.env.REDIS_HOST;
    if (redisHost) {
        try {
            // Dynamic import to avoid hard dependency
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
 * Idempotency middleware for POST endpoints.
 * Uses X-Idempotency-Key header to detect and deduplicate retried requests.
 *
 * If the same key is seen again within the TTL, returns the cached response
 * instead of processing the request again.
 *
 * Supports Redis (multi-pod) with automatic fallback to in-memory (single-pod).
 */
export function idempotency(req: Request, res: Response, next: NextFunction): void {
    const key = req.headers['x-idempotency-key'] as string;

    // If no idempotency key provided, skip (backwards compatible)
    if (!key) {
        next();
        return;
    }

    // Scope the key to the authenticated user + tenant to prevent cross-tenant collisions
    const user = (req as any).user;
    const scopedKey = user ? `${user.tenantId}:${user.id}:${key}` : key;

    const store = getCache();

    // Check cache (async)
    store.get(scopedKey).then(cached => {
        if (cached) {
            logger.debug('Idempotency cache hit', { key: scopedKey });
            res.status(cached.status).json(cached.response);
            return;
        }

        // Intercept the response to cache it
        const originalJson = res.json.bind(res);
        res.json = (body: any) => {
            // Only cache successful responses (2xx)
            if (res.statusCode >= 200 && res.statusCode < 300) {
                store.set(scopedKey, {
                    response: body,
                    status: res.statusCode
                }).catch(() => { /* fire-and-forget */ });
            }
            return originalJson(body);
        };

        next();
    }).catch(() => {
        // If cache check fails, proceed without idempotency
        next();
    });
}
