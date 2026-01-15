"use strict";
/**
 * Feature Flags Service
 * Manages TenantConfig and provides helpers for conditional feature execution
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantConfig = getTenantConfig;
exports.isFeatureEnabled = isFeatureEnabled;
exports.executeIfEnabled = executeIfEnabled;
exports.updateTenantConfig = updateTenantConfig;
exports.clearConfigCache = clearConfigCache;
const prisma_1 = require("../lib/prisma");
// Cache for tenant config (simple in-memory cache)
let configCache = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache
/**
 * Get the current tenant configuration
 * Creates default config if none exists
 */
async function getTenantConfig() {
    const now = Date.now();
    // Return cached config if still valid
    if (configCache && cacheExpiry > now) {
        return configCache;
    }
    // Fetch from database
    let config = await prisma_1.prisma.tenantConfig.findFirst();
    // Create default config if none exists
    if (!config) {
        config = await prisma_1.prisma.tenantConfig.create({
            data: {
                businessName: 'Mi Negocio',
                enableStock: true,
                enableDelivery: true,
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
async function isFeatureEnabled(flag) {
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
async function executeIfEnabled(flag, fn, fallback) {
    const enabled = await isFeatureEnabled(flag);
    if (!enabled) {
        return fallback;
    }
    try {
        return await fn();
    }
    catch (error) {
        console.error(`[Feature Flag] Optional module ${flag} failed:`, error);
        return fallback;
    }
}
/**
 * Update tenant configuration
 */
async function updateTenantConfig(updates) {
    const config = await getTenantConfig();
    const updated = await prisma_1.prisma.tenantConfig.update({
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
function clearConfigCache() {
    configCache = null;
    cacheExpiry = 0;
}
//# sourceMappingURL=featureFlags.service.js.map