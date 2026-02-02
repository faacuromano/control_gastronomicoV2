/**
 * @fileoverview Role Management Controller
 *
 * @business_rule
 * - GET /roles: Authenticated users can list roles (for dropdowns)
 * - POST/DELETE: ADMIN role only
 * - System roles (ADMIN, CASHIER, WAITER, KITCHEN) cannot be deleted
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { AuditAction } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../middleware/asyncHandler';
import { ForbiddenError, ValidationError, ConflictError, NotFoundError } from '../utils/errors';
import { auditService } from '../services/audit.service';
import { sendSuccess } from '../utils/response';

const createRoleSchema = z.object({
    name: z.string().min(2).max(50),
});

/**
 * Feature modules - Control Header/navigation visibility
 * These are the main sections of the application
 */
/**
 * System role names that cannot be deleted (seeded per tenant).
 */
const SYSTEM_ROLE_NAMES = ['ADMIN', 'CASHIER', 'WAITER', 'KITCHEN'] as const;

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
 * Get all roles with pagination
 */
export const getRoles = asyncHandler(async (req: Request, res: Response) => {
    const { page: pageStr, limit: limitStr } = req.query;

    // Parse pagination params
    const page = Math.max(1, parseInt(pageStr as string) || 1);
    const limit = Math.max(1, parseInt(limitStr as string) || 50);
    const skip = (page - 1) * limit;

    const where = { tenantId: req.user!.tenantId! };

    // Get total count for pagination
    const total = await prisma.role.count({ where });

    const roles = await prisma.role.findMany({
        where,
        select: {
            id: true,
            name: true,
            permissions: true
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit
    });

    sendSuccess(res, roles, { page, limit, total, totalPages: Math.ceil(total / limit) });
});

/**
 * Get role by ID with user count
 */
export const getRoleById = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    
    if (isNaN(id)) {
        throw new ValidationError('Invalid role ID');
    }

    const role = await prisma.role.findFirst({
        where: { id, tenantId: req.user!.tenantId! },
        include: {
            _count: {
                select: { users: true }
            }
        }
    });

    if (!role) {
        throw new NotFoundError('Role');
    }

    sendSuccess(res, role);
});

/**
 * Create a new role
 * Permissions will be set to empty object {} by default
 */
export const createRole = asyncHandler(async (req: Request, res: Response) => {
    const { name } = createRoleSchema.parse(req.body);

    // Check if role with same name exists
    // FIX: Role name is unique per Tenant. Use findFirst.
    const existing = await prisma.role.findFirst({ 
        where: { 
            name, 
            tenantId: req.user!.tenantId! 
        } 
    });
    if (existing) {
        throw new ConflictError('Role name already exists');
    }

    const role = await prisma.role.create({
        data: {
            tenantId: req.user!.tenantId!,
            name,
            permissions: {} // Placeholder for future RBAC implementation
        }
    });

    // Audit log - after successful creation
    auditService.log(
        AuditAction.ROLE_CREATED,
        'Role',
        role.id,
        {
            userId: req.user!.id!,
            tenantId: req.user!.tenantId!,
            ipAddress: String(req.ip),
            userAgent: req.headers['user-agent'] ?? 'unknown'
        },
        { name: role.name }
    );

    sendSuccess(res, role, undefined, 201);
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
    // Check role exists and belongs to tenant
    const role = await prisma.role.findFirst({ 
        where: { id, tenantId: req.user!.tenantId! } 
    });
    if (!role) {
        throw new NotFoundError('Role');
    }

    // Update permissions with tenantId guard
    await prisma.role.updateMany({
        where: { id, tenantId: req.user!.tenantId! },
        data: { permissions }
    });

    const updatedRole = await prisma.role.findFirst({
        where: { id, tenantId: req.user!.tenantId! }
    });

    // Audit log - after successful permissions update
    auditService.log(
        AuditAction.ROLE_PERMISSIONS_UPDATED,
        'Role',
        id,
        {
            userId: req.user!.id!,
            tenantId: req.user!.tenantId!,
            ipAddress: String(req.ip),
            userAgent: req.headers['user-agent'] ?? 'unknown'
        },
        { roleName: role.name, permissions }
    );

    sendSuccess(res, updatedRole);
});

/**
 * Delete a role
 * System roles (ADMIN, CASHIER, WAITER, KITCHEN) are protected
 */
export const deleteRole = asyncHandler(async (req: Request, res: Response) => {
    const idString = (req.params.id as string) || '';
    const id = parseInt(idString);

    if (isNaN(id)) {
        throw new ValidationError('Invalid role ID');
    }

    // Check role ownership
    const role = await prisma.role.findFirst({
        where: { id, tenantId: req.user!.tenantId! }
    });
    if (!role) {
        throw new NotFoundError('Role');
    }

    // Protect system roles by name (works for all tenants)
    if (SYSTEM_ROLE_NAMES.includes(role.name as typeof SYSTEM_ROLE_NAMES[number])) {
        throw new ForbiddenError('Cannot delete system roles');
    }

    // Check if role has users (scoped to tenant)
    const usersCount = await prisma.user.count({
        where: {
            roleId: id,
            tenantId: req.user!.tenantId!
        }
    });
    if (usersCount > 0) {
        throw new ValidationError(`Cannot delete role: ${usersCount} users are assigned to this role`);
    }

    // Use deleteMany with tenantId for defense-in-depth (P0-005 fix)
    await prisma.role.deleteMany({ where: { id, tenantId: req.user!.tenantId! } });

    // Audit log - after successful deletion
    auditService.log(
        AuditAction.ROLE_DELETED,
        'Role',
        id,
        {
            userId: req.user!.id!,
            tenantId: req.user!.tenantId!,
            ipAddress: String(req.ip),
            userAgent: req.headers['user-agent'] ?? 'unknown'
        },
        { roleName: role.name }
    );

    sendSuccess(res, { message: 'Role deleted successfully' });
});

/**
 * Get available modules, resources and actions for UI
 */
export const getPermissionOptions = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, {
        modules: VALID_MODULES,
        resources: VALID_RESOURCES,
        actions: VALID_ACTIONS
    });
});
