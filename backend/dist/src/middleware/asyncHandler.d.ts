import { Request, Response, NextFunction } from 'express';
/**
 * Higher-order function to wrap asynchronous route handlers.
 * It catches any errors and passes them to the next error-handling middleware.
 */
export declare const asyncHandler: (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=asyncHandler.d.ts.map