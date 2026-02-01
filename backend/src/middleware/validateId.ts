import { Request, Response, NextFunction } from 'express';

/**
 * Validates that route parameters are positive integers before reaching the controller.
 * Prevents NaN from reaching Prisma when parseInt("abc") returns NaN.
 *
 * Usage in routes:
 *   router.get('/:id', authenticate, validateId(), controller.get);
 *   router.get('/:orderId/items/:itemId', authenticate, validateId('orderId', 'itemId'), controller.get);
 */
export function validateId(...paramNames: string[]) {
  const names = paramNames.length > 0 ? paramNames : ['id'];

  return (req: Request, res: Response, next: NextFunction) => {
    for (const name of names) {
      const raw = req.params[name];
      if (raw === undefined) continue; // param not in this route
      if (Array.isArray(raw)) {
        return res.status(400).json({ success: false, error: `Invalid ${name}: unexpected array` });
      }

      const value = parseInt(raw, 10);
      if (isNaN(value) || value <= 0 || String(value) !== raw) {
        return res.status(400).json({
          success: false,
          error: `Invalid ${name}: must be a positive integer`,
        });
      }
    }
    next();
  };
}
