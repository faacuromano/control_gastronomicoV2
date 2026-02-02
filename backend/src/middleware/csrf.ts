import { Request, Response, NextFunction } from 'express';

/**
 * Middleware de proteccion contra CSRF (Cross-Site Request Forgery).
 * Requiere el header X-Requested-With en solicitudes que modifican estado.
 *
 * La aplicacion usa cookies HttpOnly con SameSite=lax para la autenticacion.
 * Esta verificacion de header personalizado proporciona defensa en profundidad
 * contra ataques CSRF: los navegadores no agregan headers personalizados
 * en envios de formularios cross-origin, por lo que un atacante no puede
 * falsificar este header desde un sitio externo.
 *
 * El frontend (Axios) envia automaticamente X-Requested-With: XMLHttpRequest
 * en cada solicitud, por lo que este middleware es transparente para el cliente.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
    // Los metodos seguros (solo lectura) no necesitan proteccion CSRF
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        next();
        return;
    }

    const xRequestedWith = req.headers['x-requested-with'];
    if (xRequestedWith !== 'XMLHttpRequest') {
        res.status(403).json({
            success: false,
            error: { code: 'CSRF_FAILED', message: 'Missing or invalid X-Requested-With header' }
        });
        return;
    }

    next();
}
