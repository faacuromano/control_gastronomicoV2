import { Request, Response, NextFunction } from 'express';

/**
 * CSRF protection middleware.
 * Requires X-Requested-With header on state-changing requests.
 *
 * Since the app uses HttpOnly cookies with SameSite=lax, this custom header
 * check provides defense-in-depth against CSRF attacks. Browsers won't
 * add custom headers on cross-origin form submissions.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
    // Safe methods don't need CSRF protection
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
