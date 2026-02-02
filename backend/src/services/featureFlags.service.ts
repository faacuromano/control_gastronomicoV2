/**
 * @fileoverview Servicio de Feature Flags (Banderas de Funcionalidad)
 *
 * Gestiona la configuracion del tenant (TenantConfig) y provee helpers para
 * ejecutar logica condicionalmente segun las funcionalidades habilitadas.
 *
 * Cada tenant puede activar/desactivar modulos como stock, delivery, KDS, fiscal, etc.
 * Este servicio centraliza esa logica y cachea la configuracion para evitar consultas
 * repetitivas a la base de datos.
 *
 * @module services/featureFlags.service
 */

import { TenantConfig } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

// Cache en memoria indexado por tenantId para evitar lecturas repetidas a la BD.
// Se usa un Map con TTL por entrada para invalidar automaticamente.
const MAX_CACHE_SIZE = 500;
const configCache = new Map<number, { config: TenantConfig; expiry: number }>();
const CACHE_TTL_MS = parseInt(process.env.FEATURE_FLAGS_CACHE_TTL_MS || '60000', 10);

/**
 * Obtiene la configuracion actual del tenant.
 * Si no existe una configuracion en la BD, crea una con valores por defecto.
 * Utiliza cache en memoria con TTL configurable para optimizar rendimiento.
 */
export async function getTenantConfig(tenantId: number): Promise<TenantConfig> {
    const now = Date.now();

    // Verificar si existe en cache y no ha expirado
    const cached = configCache.get(tenantId);
    if (cached && cached.expiry > now) {
        return cached.config;
    }

    // Buscar en base de datos
    let config = await prisma.tenantConfig.findFirst({ where: { tenantId } });

    // Crear configuracion por defecto si el tenant aun no tiene una
    if (!config) {
        config = await prisma.tenantConfig.create({
            data: {
                tenantId,
                businessName: 'Mi Negocio',
                enableStock: true,
                enableDelivery: false,
                enableKDS: false,
                enableFiscal: false,
                enableDigital: false,
                currencySymbol: '$'
            }
        });
    }

    // Politica de eviccion: si el cache esta lleno, eliminar la entrada mas antigua (FIFO)
    if (configCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = configCache.keys().next().value;
        if (oldestKey !== undefined) configCache.delete(oldestKey);
    }

    // Guardar en cache con timestamp de expiracion
    configCache.set(tenantId, { config, expiry: now + CACHE_TTL_MS });

    return config;
}

/**
 * Verifica si una funcionalidad especifica esta habilitada para un tenant.
 * Consulta la configuracion (con cache) y retorna el valor booleano del flag.
 */
export async function isFeatureEnabled(
    flag: keyof Omit<TenantConfig, 'id' | 'businessName' | 'currencySymbol' | 'tenantId'>,
    tenantId: number
): Promise<boolean> {
    const config = await getTenantConfig(tenantId);
    return Boolean(config[flag]);
}

/**
 * Ejecuta una funcion solo si la funcionalidad indicada esta habilitada.
 * Retorna el valor de fallback si la funcionalidad esta desactivada o si ocurre un error.
 *
 * Este patron permite que modulos opcionales fallen graciosamente sin afectar
 * la funcionalidad principal del sistema (ej: si KDS falla, la orden igual se crea).
 *
 * IMPORTANTE: Los flags criticos (stock, fiscal) NO se silencian — si fallan,
 * el error se propaga porque podrian causar desincronizacion de inventario o fiscal.
 *
 * @example
 * await executeIfEnabled('enableStock', () => stockService.decrementForOrder(items));
 */
export async function executeIfEnabled<T>(
    flag: keyof Omit<TenantConfig, 'id' | 'businessName' | 'currencySymbol' | 'tenantId'>,
    fn: () => Promise<T>,
    tenantId: number,
    fallback?: T
): Promise<T | undefined> {
    const enabled = await isFeatureEnabled(flag, tenantId);

    if (!enabled) {
        return fallback;
    }

    try {
        return await fn();
    } catch (error) {
        // ERR-011: Loggear con contexto completo; funcionalidades criticas (stock, fiscal)
        // no deben fallar silenciosamente porque causan drift de inventario o inconsistencias fiscales
        const isCritical = flag === 'enableStock' || flag === 'enableFiscal';
        const level = isCritical ? 'error' : 'warn';
        logger[level](`FEATURE_FLAG_EXECUTION_FAILED`, {
            flag,
            tenantId,
            critical: isCritical,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        if (isCritical) {
            throw error; // No silenciar errores de stock/fiscal — causan drift de inventario
        }
        return fallback;
    }
}

/**
 * Actualiza la configuracion de un tenant.
 * Acepta campos planos o una estructura anidada { features: {...} } desde el frontend.
 * Solo permite actualizar campos conocidos de TenantConfig (whitelist) para evitar
 * inyeccion de campos no autorizados.
 */
export async function updateTenantConfig(
    updates: Record<string, unknown>,
    tenantId: number
): Promise<TenantConfig> {
    const config = await getTenantConfig(tenantId);

    // Aplanar el objeto "features" anidado a columnas de nivel superior,
    // ya que el frontend puede enviar { features: { enableStock: true } }
    const { features, ...rest } = updates;
    const flatUpdates: Record<string, unknown> = { ...rest };
    if (features && typeof features === 'object') {
        for (const [key, value] of Object.entries(features)) {
            flatUpdates[key] = value;
        }
    }

    // Whitelist: solo permitir campos conocidos de TenantConfig para prevenir escrituras no autorizadas
    const allowedFields = new Set([
        'businessName', 'currencySymbol',
        'enableStock', 'enableDelivery', 'enableKDS', 'enableFiscal', 'enableDigital', 'enableBlindCount',
        'qrMenuEnabled', 'qrMenuMode', 'qrSelfOrderEnabled', 'qrMenuPdfUrl', 'qrMenuBannerUrl', 'qrMenuTheme',
    ]);
    const safeUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(flatUpdates)) {
        if (allowedFields.has(key)) {
            safeUpdates[key] = value;
        }
    }

    const updated = await prisma.tenantConfig.update({
        where: { id: config.id },
        data: safeUpdates
    });

    // Invalidar cache de este tenant para que la proxima lectura obtenga datos frescos
    configCache.delete(tenantId);

    return updated;
}

/**
 * Limpia el cache de configuracion completo.
 * Util para testing y para forzar recarga de configuraciones.
 */
export function clearConfigCache(): void {
    configCache.clear();
}
