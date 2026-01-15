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
export declare const sendSuccess: <T>(res: Response, data: T, meta?: ApiResponse<T>["meta"], statusCode?: number) => Response<any, Record<string, any>>;
export declare const sendError: (res: Response, code: string, message: string, details?: Record<string, unknown> | any[] | null, statusCode?: number) => Response<any, Record<string, any>>;
export {};
//# sourceMappingURL=response.d.ts.map