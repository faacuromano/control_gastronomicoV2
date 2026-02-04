/**
 * Error Handling Utilities
 *
 * Provides consistent error message extraction from API responses.
 */


/**
 * Standard API error response format
 */
interface ApiErrorResponse {
    success: false;
    error?: string | { message?: string };
    message?: string;
    code?: string;
}

/**
 * Extract user-friendly error message from API error
 *
 * Handles various error response formats:
 * - { success: false, error: "message" }
 * - { success: false, error: { message: "..." } }
 * - { error: { message: "..." }, message: "..." }
 * - Axios network errors
 * - Generic errors
 *
 * @param error - Error object from API call
 * @param fallback - Default message if none found
 * @returns User-friendly error message
 */
export const extractErrorMessage = (
    error: unknown,
    fallback = 'Ocurrió un error inesperado. Por favor intenta de nuevo.'
): string => {
    // FE-002b: Acepta unknown con type narrowing seguro
    if (!error || typeof error !== 'object') return fallback;

    const err = error as Record<string, unknown>;

    // Handle AxiosError
    if (err.response && typeof err.response === 'object') {
        const resp = err.response as Record<string, unknown>;
        const data = resp.data as ApiErrorResponse | undefined;

        if (typeof data?.error === 'string') {
            return data.error;
        }
        if (typeof data?.error === 'object' && data.error?.message) {
            return data.error.message;
        }
        if (data?.message) {
            return data.message;
        }
    }

    // Handle network errors
    if ((err as Error).message === 'Network Error') {
        return 'Error de red. Verifica tu conexión a internet.';
    }

    // Handle timeout errors
    if (err.code === 'ECONNABORTED') {
        return 'Tiempo de espera agotado. Por favor intenta de nuevo.';
    }

    // Generic error message
    if (typeof (err as Error).message === 'string') {
        return (err as Error).message;
    }

    return fallback;
};

/**
 * Get HTTP status code from error
 */
export const getErrorStatus = (error: unknown): number | null => {
    if (!error || typeof error !== 'object') return null;
    const resp = (error as Record<string, unknown>).response;
    if (resp && typeof resp === 'object') {
        const status = (resp as Record<string, unknown>).status;
        return typeof status === 'number' ? status : null;
    }
    return null;
};

/**
 * Check if error is a specific HTTP status
 */
export const isErrorStatus = (error: unknown, status: number): boolean => {
    return getErrorStatus(error) === status;
};

/**
 * Get user-friendly message for common HTTP status codes
 */
export const getStatusMessage = (status: number): string => {
    switch (status) {
        case 400:
            return 'Solicitud inválida. Verifica los datos ingresados.';
        case 401:
            return 'No autorizado. Por favor inicia sesión nuevamente.';
        case 403:
            return 'Acceso denegado. No tienes permiso para esta acción.';
        case 404:
            return 'Recurso no encontrado.';
        case 409:
            return 'Conflicto. Este recurso ya existe.';
        case 429:
            return 'Demasiadas solicitudes. Intenta de nuevo más tarde.';
        case 500:
            return 'Error del servidor. Contacta soporte si el problema persiste.';
        case 503:
            return 'Servicio temporalmente no disponible. Intenta más tarde.';
        default:
            return `Error ${status}. Por favor intenta de nuevo.`;
    }
};

/**
 * Enhanced error extraction with status code handling
 *
 * @param error - Error object
 * @param fallback - Fallback message
 * @returns User-friendly error message
 */
export const getErrorMessage = (error: unknown, fallback?: string): string => {
    const status = getErrorStatus(error);

    // For specific status codes, use status message if no custom message
    if (status) {
        const customMessage = extractErrorMessage(error, '');
        if (customMessage && customMessage !== fallback) {
            return customMessage;
        }
        return getStatusMessage(status);
    }

    return extractErrorMessage(error, fallback);
};

/**
 * Check if error is authentication-related (401 or 403)
 */
export const isAuthError = (error: unknown): boolean => {
    const status = getErrorStatus(error);
    return status === 401 || status === 403;
};

/**
 * Check if error is a validation error (400)
 */
export const isValidationError = (error: unknown): boolean => {
    return isErrorStatus(error, 400);
};

/**
 * Check if error is a network/connectivity error
 */
export const isNetworkError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return true;
    const err = error as Record<string, unknown>;
    return (
        (err as Error).message === 'Network Error' ||
        err.code === 'ECONNABORTED' ||
        !err.response
    );
};
