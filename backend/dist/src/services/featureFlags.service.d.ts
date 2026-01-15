/**
 * Feature Flags Service
 * Manages TenantConfig and provides helpers for conditional feature execution
 */
import { TenantConfig } from '@prisma/client';
/**
 * Get the current tenant configuration
 * Creates default config if none exists
 */
export declare function getTenantConfig(): Promise<TenantConfig>;
/**
 * Check if a specific feature is enabled
 */
export declare function isFeatureEnabled(flag: keyof Omit<TenantConfig, 'id' | 'businessName' | 'currencySymbol'>): Promise<boolean>;
/**
 * Execute a function only if the specified feature is enabled
 * Returns the fallback value if the feature is disabled or throws
 *
 * This pattern allows optional modules to fail gracefully without affecting core functionality.
 *
 * @example
 * await executeIfEnabled('enableStock', () => stockService.decrementForOrder(items));
 */
export declare function executeIfEnabled<T>(flag: keyof Omit<TenantConfig, 'id' | 'businessName' | 'currencySymbol'>, fn: () => Promise<T>, fallback?: T): Promise<T | undefined>;
/**
 * Update tenant configuration
 */
export declare function updateTenantConfig(updates: Partial<Omit<TenantConfig, 'id'>>): Promise<TenantConfig>;
/**
 * Clear the config cache (useful for testing)
 */
export declare function clearConfigCache(): void;
//# sourceMappingURL=featureFlags.service.d.ts.map