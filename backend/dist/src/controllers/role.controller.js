"use strict";
/**
 * @fileoverview Role Management Controller
 *
 * @business_rule
 * - GET /roles: Authenticated users can list roles (for dropdowns)
 * - POST/DELETE: ADMIN role only
 * - System roles (id <= 5) cannot be deleted
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPermissionOptions = exports.deleteRole = exports.updateRolePermissions = exports.createRole = exports.getRoleById = exports.getRoles = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const asyncHandler_1 = require("../middleware/asyncHandler");
const errors_1 = require("../utils/errors");
const createRoleSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(50),
});
/**
 * Feature modules - Control Header/navigation visibility
 * These are the main sections of the application
 */
const VALID_MODULES = [
    'pos', // Punto de Venta
    'tables', // Mesas
    'cash', // Caja
    'kds', // Kitchen Display System (Cocina)
    'delivery', // Delivery
    'admin' // Panel Administración
];
/**
 * Resources for CRUD operations within modules
 * These are data entities that can have CRUD permissions
 */
const VALID_RESOURCES = [
    'products', 'categories', 'orders', 'stock', 'users',
    'clients', 'analytics', 'suppliers', 'settings', 'roles'
];
/**
 * All permissionable items (modules + resources)
 */
const ALL_PERMISSIONABLES = [...VALID_MODULES, ...VALID_RESOURCES];
/**
 * Actions for RBAC
 * - access: Can see the module in navigation
 * - create/read/update/delete: CRUD operations
 */
const VALID_ACTIONS = ['access', 'create', 'read', 'update', 'delete'];
/**
 * Zod schema for permissions object
 * Structure: { [module_or_resource]: [action1, action2, ...] }
 * Keys are validated manually to ensure they are valid
 */
const permissionsSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.array(zod_1.z.enum(VALID_ACTIONS)));
const updatePermissionsSchema = zod_1.z.object({
    permissions: permissionsSchema
});
/**
 * Get all roles
 */
exports.getRoles = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const roles = await prisma_1.prisma.role.findMany({
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
exports.getRoleById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        throw new errors_1.ValidationError('Invalid role ID');
    }
    const role = await prisma_1.prisma.role.findUnique({
        where: { id },
        include: {
            _count: {
                select: { users: true }
            }
        }
    });
    if (!role) {
        throw new errors_1.NotFoundError('Role');
    }
    res.json({ success: true, data: role });
});
/**
 * Create a new role
 * Permissions will be set to empty object {} by default
 */
exports.createRole = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { name } = createRoleSchema.parse(req.body);
    // Check if role with same name exists
    const existing = await prisma_1.prisma.role.findUnique({ where: { name } });
    if (existing) {
        throw new errors_1.ConflictError('Role name already exists');
    }
    const role = await prisma_1.prisma.role.create({
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
exports.updateRolePermissions = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        throw new errors_1.ValidationError('Invalid role ID');
    }
    // Validate basic structure
    const { permissions } = updatePermissionsSchema.parse(req.body);
    // Validate that all keys are valid modules or resources
    const validPermissionables = new Set(ALL_PERMISSIONABLES);
    const invalidKeys = Object.keys(permissions).filter(key => !validPermissionables.has(key));
    if (invalidKeys.length > 0) {
        throw new errors_1.ValidationError(`Invalid keys: ${invalidKeys.join(', ')}. Valid options: ${ALL_PERMISSIONABLES.join(', ')}`);
    }
    // Check role exists
    const role = await prisma_1.prisma.role.findUnique({ where: { id } });
    if (!role) {
        throw new errors_1.NotFoundError('Role');
    }
    // Update permissions
    const updatedRole = await prisma_1.prisma.role.update({
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
exports.deleteRole = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const idString = req.params.id || '';
    const id = parseInt(idString);
    if (isNaN(id)) {
        throw new errors_1.ValidationError('Invalid role ID');
    }
    // Protect system roles
    if (id <= 5) {
        throw new errors_1.ForbiddenError('Cannot delete system roles');
    }
    // Check if role has users
    const usersCount = await prisma_1.prisma.user.count({ where: { roleId: id } });
    if (usersCount > 0) {
        throw new errors_1.ValidationError(`Cannot delete role: ${usersCount} users are assigned to this role`);
    }
    await prisma_1.prisma.role.delete({ where: { id } });
    res.json({ success: true, message: 'Role deleted successfully' });
});
/**
 * Get available modules, resources and actions for UI
 */
exports.getPermissionOptions = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    res.json({
        success: true,
        data: {
            modules: VALID_MODULES,
            resources: VALID_RESOURCES,
            actions: VALID_ACTIONS
        }
    });
});
//# sourceMappingURL=role.controller.js.map