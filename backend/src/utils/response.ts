import { Response } from 'express';

interface ApiResponse<T> {
    success: boolean;
    data?: T | undefined;
    error?: {
        code: string;
        message: string;
        details?: Record<string, unknown> | any[] | null | undefined;
    } | undefined;
    meta?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    } | undefined;
}

export const sendSuccess = <T>(res: Response, data: T, meta?: ApiResponse<T>['meta'], statusCode = 200) => {
    const response: ApiResponse<T> = {
        success: true,
        data,
        meta,
    };
    return res.status(statusCode).json(response);
};

export const sendError = (res: Response, code: string, message: string, details?: Record<string, unknown> | any[] | null, statusCode = 400) => {
    const response: ApiResponse<null> = {
        success: false,
        error: {
            code,
            message,
            details: details || undefined,
        },
    };
    return res.status(statusCode).json(response);
};
