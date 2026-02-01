/**
 * Error Handling Utilities
 *
 * Provides consistent error message extraction from API responses.
 */

import { AxiosError } from 'axios';

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
    error: any,
    fallback = 'An unexpected error occurred. Please try again.'
): string => {
    // Handle AxiosError
    if (error.response) {
        const data = error.response.data as ApiErrorResponse;

        // Try multiple paths for error message
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
    if (error.message === 'Network Error') {
        return 'Network error. Please check your internet connection.';
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED') {
        return 'Request timeout. Please try again.';
    }

    // Generic error message
    if (error.message) {
        return error.message;
    }

    return fallback;
};

/**
 * Get HTTP status code from error
 */
export const getErrorStatus = (error: any): number | null => {
    return error.response?.status || null;
};

/**
 * Check if error is a specific HTTP status
 */
export const isErrorStatus = (error: any, status: number): boolean => {
    return getErrorStatus(error) === status;
};

/**
 * Get user-friendly message for common HTTP status codes
 */
export const getStatusMessage = (status: number): string => {
    switch (status) {
        case 400:
            return 'Invalid request. Please check your input.';
        case 401:
            return 'Unauthorized. Please log in again.';
        case 403:
            return 'Access denied. You do not have permission for this action.';
        case 404:
            return 'Resource not found.';
        case 409:
            return 'Conflict. This resource already exists.';
        case 429:
            return 'Too many requests. Please try again later.';
        case 500:
            return 'Server error. Please contact support if this persists.';
        case 503:
            return 'Service temporarily unavailable. Please try again later.';
        default:
            return `Error ${status}. Please try again.`;
    }
};

/**
 * Enhanced error extraction with status code handling
 *
 * @param error - Error object
 * @param fallback - Fallback message
 * @returns User-friendly error message
 */
export const getErrorMessage = (error: any, fallback?: string): string => {
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
export const isAuthError = (error: any): boolean => {
    const status = getErrorStatus(error);
    return status === 401 || status === 403;
};

/**
 * Check if error is a validation error (400)
 */
export const isValidationError = (error: any): boolean => {
    return isErrorStatus(error, 400);
};

/**
 * Check if error is a network/connectivity error
 */
export const isNetworkError = (error: any): boolean => {
    return (
        error.message === 'Network Error' ||
        error.code === 'ECONNABORTED' ||
        !error.response
    );
};
