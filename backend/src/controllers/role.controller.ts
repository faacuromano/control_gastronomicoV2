/**
 * @fileoverview Role Management Controller
 * 
 * @business_rule
 * - GET /roles: Authenticated users can list roles (for dropdowns)
 * - POST/DELETE: ADMIN role only
 * - System roles (id <= 5) cannot be deleted
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../middleware/asyncHandler';
import { ForbiddenError, ValidationError, ConflictError, NotFoundError } from '../utils/errors';

const createRoleSchema = z.object({
    name: z.string().min(2).max(50),
});

/**
 * Feature modules - Control Header/navigation visibility
 * These are the main sections of the application
 */
const VALID_MODULES = [
    'pos',      // Punto de Venta
    'tables',   // Mesas
    'cash',     // Caja
    'kds',      // Kitchen Display System (Cocina)
    'delivery', // Delivery
    'admin'     // Panel Administración
] as const;

/**
 * Resources for CRUD operations within modules
 * These are data entities that can have CRUD permissions
 */
const VALID_RESOURCES = [
    'products', 'categories', 'orders', 'stock', 'users', 
    'clients', 'analytics', 'suppliers', 'settings', 'roles'
] as const;

/**
 * All permissionable items (modules + resources)
 */
const ALL_PERMISSIONABLES = [...VALID_MODULES, ...VALID_RESOURCES] as const;

/**
 * Actions for RBAC
 * - access: Can see the module in navigation
 * - create/read/update/delete: CRUD operations
 */
const VALID_ACTIONS = ['access', 'create', 'read', 'update', 'delete'] as const;

/**
 * Zod schema for permissions object
 * Structure: { [module_or_resource]: [action1, action2, ...] }
 * Keys are validated manually to ensure they are valid
 */
const permissionsSchema = z.record(
    z.string(),
    z.array(z.enum(VALID_ACTIONS))
);

const updatePermissionsSchema = z.object({
    permissions: permissionsSchema
});

/**
 * Get all roles
 */
export const getRoles = asyncHandler(async (req: Request, res: Response) => {
    const roles = await prisma.role.findMany({
        select: {
            id: true,
            name: true,
            permissions: true
        },
        orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: roles });
});

/**
 * Get role by ID with user count
 */
export const getRoleById = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    
    if (isNaN(id)) {
        throw new ValidationError('Invalid role ID');
    }

    const role = await prisma.role.findUnique({
        where: { id },
        include: {
            _count: {
                select: { users: true }
            }
        }
    });

    if (!role) {
        throw new NotFoundError('Role');
    }

    res.json({ success: true, data: role });
});

/**
 * Create a new role
 * Permissions will be set to empty object {} by default
 */
export const createRole = asyncHandler(async (req: Request, res: Response) => {
    const { name } = createRoleSchema.parse(req.body);

    // Check if role with same name exists
    const existing = await prisma.role.findUnique({ where: { name } });
    if (existing) {
        throw new ConflictError('Role name already exists');
    }

    const role = await prisma.role.create({
        data: {
            name,
            permissions: {} // Placeholder for future RBAC implementation
        }
    });

    res.status(201).json({ success: true, data: role });
});

/**
 * Update role permissions
 * @param id - Role ID
 * @body permissions - Object with resource keys and action arrays
 */
export const updateRolePermissions = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    
    if (isNaN(id)) {
        throw new ValidationError('Invalid role ID');
    }

    // Validate basic structure
    const { permissions } = updatePermissionsSchema.parse(req.body);

    // Validate that all keys are valid modules or resources
    const validPermissionables = new Set<string>(ALL_PERMISSIONABLES);
    const invalidKeys = Object.keys(permissions).filter(key => !validPermissionables.has(key));
    
    if (invalidKeys.length > 0) {
        throw new ValidationError(`Invalid keys: ${invalidKeys.join(', ')}. Valid options: ${ALL_PERMISSIONABLES.join(', ')}`);
    }

    // Check role exists
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) {
        throw new NotFoundError('Role');
    }

    // Update permissions
    const updatedRole = await prisma.role.update({
        where: { id },
        data: { permissions }
    });

    res.json({ 
        success: true, 
        data: updatedRole,
        message: 'Permissions updated successfully'
    });
});

/**
 * Delete a role
 * System roles (id <= 5) are protected
 */
export const deleteRole = asyncHandler(async (req: Request, res: Response) => {
    const idString = (req.params.id as string) || '';
    const id = parseInt(idString);
    
    if (isNaN(id)) {
        throw new ValidationError('Invalid role ID');
    }

    // Protect system roles
    if (id <= 5) {
        throw new ForbiddenError('Cannot delete system roles');
    }

    // Check if role has users
    const usersCount = await prisma.user.count({ where: { roleId: id } });
    if (usersCount > 0) {
        throw new ValidationError(`Cannot delete role: ${usersCount} users are assigned to this role`);
    }

    await prisma.role.delete({ where: { id } });
    res.json({ success: true, message: 'Role deleted successfully' });
});

/**
 * Get available modules, resources and actions for UI
 */
export const getPermissionOptions = asyncHandler(async (req: Request, res: Response) => {
    res.json({
        success: true,
        data: {
            modules: VALID_MODULES,
            resources: VALID_RESOURCES,
            actions: VALID_ACTIONS
        }
    });
});
