/**
 * Feature Flags Service
 * Manages TenantConfig and provides helpers for conditional feature execution
 */

import { TenantConfig } from '@prisma/client';
import { prisma } from '../lib/prisma';

// Cache for tenant config (simple in-memory cache)
let configCache: TenantConfig | null = null;
let cacheExpiry: number = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

/**
 * Get the current tenant configuration
 * Creates default config if none exists
 */
export async function getTenantConfig(): Promise<TenantConfig> {
    const now = Date.now();
    
    // Return cached config if still valid
    if (configCache && cacheExpiry > now) {
        return configCache;
    }
    
    // Fetch from database
    let config = await prisma.tenantConfig.findFirst();
    
    // Create default config if none exists
    if (!config) {
        config = await prisma.tenantConfig.create({
            data: {
                businessName: 'Mi Negocio',
                enableStock: true,
                enableDelivery: false, // FROZEN: Delivery module incomplete for MVP
                enableKDS: false,
                enableFiscal: false,
                enableDigital: false,
                currencySymbol: '$'
            }
        });
    }
    
    // Update cache
    configCache = config;
    cacheExpiry = now + CACHE_TTL_MS;
    
    return config;
}

/**
 * Check if a specific feature is enabled
 */
export async function isFeatureEnabled(
    flag: keyof Omit<TenantConfig, 'id' | 'businessName' | 'currencySymbol'>
): Promise<boolean> {
    const config = await getTenantConfig();
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
    flag: keyof Omit<TenantConfig, 'id' | 'businessName' | 'currencySymbol'>,
    fn: () => Promise<T>,
    fallback?: T
): Promise<T | undefined> {
    const enabled = await isFeatureEnabled(flag);
    
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
 */
export async function updateTenantConfig(
    updates: Record<string, any>
): Promise<TenantConfig> {
    const config = await getTenantConfig();
    
    const updated = await prisma.tenantConfig.update({
        where: { id: config.id },
        data: updates
    });
    
    // Invalidate cache
    configCache = null;
    cacheExpiry = 0;
    
    return updated;
}

/**
 * Clear the config cache (useful for testing)
 */
export function clearConfigCache(): void {
    configCache = null;
    cacheExpiry = 0;
}
