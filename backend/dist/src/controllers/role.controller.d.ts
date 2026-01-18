/**
 * @fileoverview Role Management Controller
 *
 * @business_rule
 * - GET /roles: Authenticated users can list roles (for dropdowns)
 * - POST/DELETE: ADMIN role only
 * - System roles (id <= 5) cannot be deleted
 */
import { Request, Response } from 'express';
/**
 * Get all roles
 */
export declare const getRoles: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get role by ID with user count
 */
export declare const getRoleById: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Create a new role
 * Permissions will be set to empty object {} by default
 */
export declare const createRole: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Update role permissions
 * @param id - Role ID
 * @body permissions - Object with resource keys and action arrays
 */
export declare const updateRolePermissions: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Delete a role
 * System roles (id <= 5) are protected
 */
export declare const deleteRole: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get available modules, resources and actions for UI
 */
export declare const getPermissionOptions: (req: Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=role.controller.d.ts.map