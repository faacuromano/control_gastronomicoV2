import { Request, Response, NextFunction } from 'express';
export declare const authenticateToken: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const authenticate: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const authorize: (allowedRoles: string[]) => (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Middleware to enforce granular permissions based on RBAC.
 * Verifies if the authenticated user has the specific action allowed on the resource.
 *
 * @business_rule
 * - ADMIN role has full access to all resources and actions (bypass)
 * - Other roles require explicit permissions in the token/user object
 *
 * @param resource - The resource identifier (e.g. 'orders', 'products')
 * @param action - The action attempted (e.g. 'create', 'delete')
 */
export declare const requirePermission: (resource: string, action: string) => (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
//# sourceMappingURL=auth.d.ts.map