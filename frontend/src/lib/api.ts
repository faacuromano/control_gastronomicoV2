import axios, { type AxiosError } from 'axios';
import { useAuthStore } from '../store/auth.store';
import { clearFeatureFlagsCache } from '../hooks/useFeatureFlags';

/**
 * API Error Response structure from backend
 */
interface ApiErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}

/**
 * Configured Axios instance for API calls
 */
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1',
    timeout: 10000, // 10 second timeout
});

/**
 * Request interceptor - adds auth token to all requests
 */
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

/**
 * Response interceptor - handles errors globally
 */
api.interceptors.response.use(
    // Success handler
    (response) => response,
    
    // Error handler
    (error: AxiosError<ApiErrorResponse>) => {
        const status = error.response?.status;
        const errorData = error.response?.data?.error;
        
        // Log error for debugging (in development)
        if (import.meta.env.DEV) {
            console.error('[API Error]', {
                status,
                code: errorData?.code,
                message: errorData?.message,
                url: error.config?.url
            });
        }
        
        // Handle specific status codes
        switch (status) {
            case 401:
                // Unauthorized - clear auth state and redirect to login
                useAuthStore.getState().logout();
                clearFeatureFlagsCache();
                break;
                
            case 403:
                // Forbidden - user doesn't have permission
                console.warn('Access denied:', errorData?.message);
                break;
                
            case 429:
                // Rate limited
                console.warn('Rate limited:', errorData?.message);
                break;
                
            case 503:
                // Service unavailable
                console.error('Service unavailable');
                break;
        }
        
        // Create a more informative error object
        const enhancedError = {
            ...error,
            userMessage: getUserFriendlyMessage(status, errorData?.code, errorData?.message)
        };
        
        return Promise.reject(enhancedError);
    }
);

/**
 * Get user-friendly error message based on error code
 */
function getUserFriendlyMessage(
    status: number | undefined, 
    _code: string | undefined, // Prefixed with _ to indicate intentionally unused
    message: string | undefined
): string {
    // Use backend message if available
    if (message) return message;
    
    // Fallback messages by status
    switch (status) {
        case 400: return 'Datos inválidos. Por favor verifica la información.';
        case 401: return 'Sesión expirada. Por favor inicia sesión nuevamente.';
        case 403: return 'No tienes permiso para realizar esta acción.';
        case 404: return 'El recurso solicitado no existe.';
        case 409: return 'Este registro ya existe.';
        case 429: return 'Demasiadas solicitudes. Por favor espera un momento.';
        case 500: return 'Error del servidor. Por favor intenta más tarde.';
        case 503: return 'Servicio temporalmente no disponible.';
        default: return 'Ha ocurrido un error inesperado.';
    }
}

export default api;

/**
 * Type guard to check if error has userMessage
 */
export function hasUserMessage(error: unknown): error is { userMessage: string } {
    return typeof error === 'object' && error !== null && 'userMessage' in error;
}

