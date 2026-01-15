/**
 * Feature Flags Hook
 * Provides access to tenant configuration and feature flags
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

export interface FeatureFlags {
    enableStock: boolean;
    enableDelivery: boolean;
    enableKDS: boolean;
    enableFiscal: boolean;
    enableDigital: boolean;
}

export interface TenantConfig {
    businessName: string;
    currencySymbol: string;
    features: FeatureFlags;
}

// Global cache for feature flags
let cachedConfig: TenantConfig | null = null;

export const useFeatureFlags = () => {
    const [config, setConfig] = useState<TenantConfig | null>(cachedConfig);
    const [loading, setLoading] = useState(!cachedConfig);
    const [error, setError] = useState<string | null>(null);

    const fetchConfig = useCallback(async () => {
        // If already cached, use it
        if (cachedConfig) {
            setConfig(cachedConfig);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const response = await api.get('/config');
            cachedConfig = response.data.data;
            setConfig(cachedConfig);
            setError(null);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to load configuration';
            setError(message);
            console.error('Failed to fetch feature flags:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    /**
     * Check if a specific feature is enabled
     */
    const isEnabled = useCallback((flag: keyof FeatureFlags): boolean => {
        return config?.features[flag] ?? false;
    }, [config]);

    /**
     * Refresh feature flags from server
     */
    const refresh = useCallback(async () => {
        cachedConfig = null;
        await fetchConfig();
    }, [fetchConfig]);

    return {
        config,
        features: config?.features,
        loading,
        error,
        isEnabled,
        refresh,
        // Convenience getters
        businessName: config?.businessName ?? 'PentiumPOS',
        currencySymbol: config?.currencySymbol ?? '$',
    };
};

/**
 * Clear the cached config (useful when logging out)
 */
export const clearFeatureFlagsCache = () => {
    cachedConfig = null;
};
