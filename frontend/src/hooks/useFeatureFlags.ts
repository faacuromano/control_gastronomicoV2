/**
 * Feature Flags Hook
 * Provides access to tenant configuration and feature flags.
 * Persists to localStorage so offline navigation works.
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { isOnline } from '../lib/connectivity';

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

const STORAGE_KEY = 'pentiumpos-feature-flags';

// Global in-memory cache for feature flags
let cachedConfig: TenantConfig | null = null;

/**
 * Read persisted config from localStorage (survives reload)
 */
function readPersistedConfig(): TenantConfig | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

/**
 * Persist config to localStorage
 */
function persistConfig(config: TenantConfig) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
        // localStorage full or unavailable - non-critical
    }
}

// Initialize in-memory cache from localStorage on module load
if (!cachedConfig) {
    cachedConfig = readPersistedConfig();
}

export const useFeatureFlags = () => {
    const [config, setConfig] = useState<TenantConfig | null>(cachedConfig);
    const [loading, setLoading] = useState(!cachedConfig);
    const [error, setError] = useState<string | null>(null);

    const fetchConfig = useCallback(async () => {
        // Use cached value for immediate render (avoids flash)
        if (cachedConfig) {
            setConfig(cachedConfig);
            setLoading(false);
        }

        // If offline, use localStorage fallback only
        if (!isOnline()) {
            if (!cachedConfig) {
                const persisted = readPersistedConfig();
                if (persisted) {
                    cachedConfig = persisted;
                    setConfig(persisted);
                }
                setLoading(false);
            }
            return;
        }

        try {
            if (!cachedConfig) setLoading(true);
            const response = await api.get('/config');
            const fresh = response.data.data as TenantConfig;
            cachedConfig = fresh;
            setConfig(fresh);
            persistConfig(fresh);
            setError(null);
        } catch (err: unknown) {
            // On fetch failure, use cached/persisted data if available
            if (!cachedConfig) {
                const persisted = readPersistedConfig();
                if (persisted) {
                    cachedConfig = persisted;
                    setConfig(persisted);
                } else {
                    const message = err instanceof Error ? err.message : 'Failed to load configuration';
                    setError(message);
                    console.error('Failed to fetch feature flags:', err);
                }
            }
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
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // non-critical
    }
};
