import { Request, Response, NextFunction } from 'express';

/**
 * Funcion de orden superior que envuelve controladores de ruta asincronos.
 * Captura cualquier error lanzado dentro del handler y lo pasa automaticamente
 * al siguiente middleware de manejo de errores de Express (error.ts).
 *
 * Esto evita tener que escribir bloques try/catch en cada controlador,
 * ya que Promise.resolve().catch(next) delega el error al error handler global.
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
