import api from '../lib/api';

export interface TenantConfig {
    businessName: string;
    currencySymbol: string;
    features: {
        enableStock: boolean;
        enableDelivery: boolean;
        enableKDS: boolean;
        enableFiscal: boolean;
        enableDigital: boolean;
    };
}

// Cache to avoid repeated API calls
let configCache: TenantConfig | null = null;

export const configService = {
    getConfig: async (): Promise<TenantConfig> => {
        if (configCache) return configCache;
        
        const response = await api.get('/config');
        configCache = response.data.data;
        return configCache!;
    },
    
    updateConfig: async (updates: Partial<TenantConfig>): Promise<TenantConfig> => {
        const response = await api.patch('/config', updates);
        configCache = response.data.data;
        return configCache!;
    },
    
    clearCache: () => {
        configCache = null;
    }
};
