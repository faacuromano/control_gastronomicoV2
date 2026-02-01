/**
 * Feature Flags Service
 * Manages TenantConfig and provides helpers for conditional feature execution
 */

import { TenantConfig } from '@prisma/client';
import { prisma } from '../lib/prisma';

// Cache for tenant configs keyed by tenantId
const configCache = new Map<number, { config: TenantConfig; expiry: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

/**
 * Get the current tenant configuration
 * Creates default config if none exists
 */
export async function getTenantConfig(tenantId: number): Promise<TenantConfig> {
    const now = Date.now();

    // Check per-tenant cache
    const cached = configCache.get(tenantId);
    if (cached && cached.expiry > now) {
        return cached.config;
    }

    // Fetch from database
    let config = await prisma.tenantConfig.findFirst({ where: { tenantId } });

    // Create default config if none exists
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

    // Update cache
    configCache.set(tenantId, { config, expiry: now + CACHE_TTL_MS });

    return config;
}

/**
 * Check if a specific feature is enabled
 */
export async function isFeatureEnabled(
    flag: keyof Omit<TenantConfig, 'id' | 'businessName' | 'currencySymbol' | 'tenantId'>,
    tenantId: number
): Promise<boolean> {
    const config = await getTenantConfig(tenantId);
    return Boolean(config[flag]);
}

/**
 * Execute a function only if the specified feature is enabled
 * Returns the fallback value if the feature is disabled or throws
 *
 * This pattern allows optional modules to fail gracefully without affecting core functionality.
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
        console.error(`[Feature Flag] Optional module ${flag} failed:`, error);
        return fallback;
    }
}

/**
 * Update tenant configuration
 * Accepts either flat fields or a nested { features: {...} } structure from the frontend.
 */
export async function updateTenantConfig(
    updates: Record<string, any>,
    tenantId: number
): Promise<TenantConfig> {
    const config = await getTenantConfig(tenantId);

    // Flatten nested "features" object into top-level columns
    const { features, ...rest } = updates;
    const flatUpdates: Record<string, any> = { ...rest };
    if (features && typeof features === 'object') {
        for (const [key, value] of Object.entries(features)) {
            flatUpdates[key] = value;
        }
    }

    // Only allow known TenantConfig fields
    const allowedFields = new Set([
        'businessName', 'currencySymbol',
        'enableStock', 'enableDelivery', 'enableKDS', 'enableFiscal', 'enableDigital', 'enableBlindCount',
        'qrMenuEnabled', 'qrMenuMode', 'qrSelfOrderEnabled', 'qrMenuPdfUrl', 'qrMenuBannerUrl', 'qrMenuTheme',
    ]);
    const safeUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(flatUpdates)) {
        if (allowedFields.has(key)) {
            safeUpdates[key] = value;
        }
    }

    const updated = await prisma.tenantConfig.update({
        where: { id: config.id },
        data: safeUpdates
    });

    // Invalidate cache for this tenant
    configCache.delete(tenantId);

    return updated;
}

/**
 * Clear the config cache (useful for testing)
 */
export function clearConfigCache(): void {
    configCache.clear();
}
