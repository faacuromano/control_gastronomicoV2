import { Request, Response, NextFunction } from 'express';

/**
 * Valida que los parametros de ruta sean enteros positivos antes de llegar al controlador.
 *
 * Previene que NaN llegue a Prisma cuando parseInt("abc") retorna NaN,
 * lo cual causaria errores de base de datos confusos o consultas inesperadas.
 * Tambien rechaza valores negativos, cero, y numeros con decimales o caracteres extra.
 *
 * La verificacion String(value) !== raw asegura que el string original sea
 * exactamente un numero entero (ej: "123" pasa, "123abc" o "12.5" no).
 *
 * Uso en rutas:
 *   router.get('/:id', authenticate, validateId(), controller.get);
 *   router.get('/:orderId/items/:itemId', authenticate, validateId('orderId', 'itemId'), controller.get);
 */
export function validateId(...paramNames: string[]) {
  // Si no se especifican nombres, por defecto validar el parametro 'id'
  const names = paramNames.length > 0 ? paramNames : ['id'];

  return (req: Request, res: Response, next: NextFunction) => {
    for (const name of names) {
      const raw = req.params[name];
      if (raw === undefined) continue; // El parametro no existe en esta ruta, omitir
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
    return next();
  };
}
