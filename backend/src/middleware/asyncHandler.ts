import { Request, Response, NextFunction } from 'express';

/**
 * Higher-order function to wrap asynchronous route handlers.
 * It catches any errors and passes them to the next error-handling middleware.
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
