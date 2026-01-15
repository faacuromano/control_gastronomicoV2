import { Request, Response, NextFunction } from 'express';
/**
 * Global Error Handler Middleware
 * Handles all errors and sends consistent API responses
 */
export declare const errorHandler: (err: Error, req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
/**
 * 404 Handler for undefined routes
 */
export declare const notFoundHandler: (req: Request, res: Response) => Response<any, Record<string, any>>;
//# sourceMappingURL=error.d.ts.map