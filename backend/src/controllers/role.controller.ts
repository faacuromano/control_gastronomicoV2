/**
 * @fileoverview Controlador de Gestión de Roles (RBAC)
 *
 * Gestiona los roles y permisos del sistema de control de acceso basado en roles.
 * Cada tenant tiene sus propios roles con permisos configurables que controlan:
 * - Acceso a módulos de navegación (pos, tables, cash, kds, delivery, admin)
 * - Operaciones CRUD sobre recursos de datos (products, orders, users, etc.)
 *
 * Reglas de negocio:
 * - GET /roles: Cualquier usuario autenticado puede listar roles (para dropdowns)
 * - POST/DELETE: Solo rol ADMIN
 * - Los roles de sistema (ADMIN, CASHIER, WAITER, KITCHEN) no pueden eliminarse
 *
 * @module controllers/role.controller
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
 * Nombres de roles de sistema que no se pueden eliminar.
 * Se crean automáticamente con el seed de cada tenant.
 */
const SYSTEM_ROLE_NAMES = ['ADMIN', 'CASHIER', 'WAITER', 'KITCHEN'] as const;

/**
 * Módulos de funcionalidad: controlan la visibilidad en el header/navegación.
 * Representan las secciones principales de la aplicación.
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
 * Recursos para operaciones CRUD dentro de los módulos.
 * Son las entidades de datos sobre las que se pueden otorgar permisos granulares.
 */
const VALID_RESOURCES = [
    'products', 'categories', 'orders', 'stock', 'users',
    'clients', 'analytics', 'suppliers', 'settings', 'roles'
] as const;

/** Unión de todos los elementos sobre los que se pueden asignar permisos */
const ALL_PERMISSIONABLES = [...VALID_MODULES, ...VALID_RESOURCES] as const;

/**
 * Acciones del sistema RBAC:
 * - access: Puede ver el módulo en la navegación
 * - create/read/update/delete: Operaciones CRUD sobre recursos
 */
const VALID_ACTIONS = ['access', 'create', 'read', 'update', 'delete'] as const;

/**
 * Esquema Zod para el objeto de permisos.
 * Estructura: { [modulo_o_recurso]: [accion1, accion2, ...] }
 * Las claves se validan manualmente para asegurar que sean válidas.
 */
const permissionsSchema = z.record(
    z.string(),
    z.array(z.enum(VALID_ACTIONS))
);

const updatePermissionsSchema = z.object({
    permissions: permissionsSchema
});

/** Lista todos los roles del tenant con paginación */
export const getRoles = asyncHandler(async (req: Request, res: Response) => {
    const { page: pageStr, limit: limitStr } = req.query;

    // Parsear parámetros de paginación
    const page = Math.max(1, parseInt(pageStr as string) || 1);
    const limit = Math.max(1, parseInt(limitStr as string) || 50);
    const skip = (page - 1) * limit;

    const where = { tenantId: req.user!.tenantId! };

    // Obtener total para metadatos de paginación
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

/** Obtiene un rol por ID incluyendo la cantidad de usuarios asignados */
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
 * Crea un nuevo rol con permisos vacíos por defecto.
 * Los permisos se configuran posteriormente con updateRolePermissions.
 */
export const createRole = asyncHandler(async (req: Request, res: Response) => {
    const { name } = createRoleSchema.parse(req.body);

    // Verificar unicidad del nombre dentro del tenant (FIX: usar findFirst en vez de findUnique)
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
            permissions: {} // Se configura luego con la UI de permisos
        }
    });

    // Auditoría: registrar creación del rol
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
 * Actualiza los permisos de un rol existente.
 * Valida que todas las claves sean módulos o recursos válidos.
 */
export const updateRolePermissions = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);

    if (isNaN(id)) {
        throw new ValidationError('Invalid role ID');
    }

    // Validar estructura básica del cuerpo
    const { permissions } = updatePermissionsSchema.parse(req.body);

    // Validar que todas las claves sean módulos o recursos válidos
    const validPermissionables = new Set<string>(ALL_PERMISSIONABLES);
    const invalidKeys = Object.keys(permissions).filter(key => !validPermissionables.has(key));

    if (invalidKeys.length > 0) {
        throw new ValidationError(`Invalid keys: ${invalidKeys.join(', ')}. Valid options: ${ALL_PERMISSIONABLES.join(', ')}`);
    }

    // Verificar que el rol exista y pertenezca al tenant
    const role = await prisma.role.findFirst({
        where: { id, tenantId: req.user!.tenantId! }
    });
    if (!role) {
        throw new NotFoundError('Role');
    }

    // Actualizar permisos con guardia de tenantId
    await prisma.role.updateMany({
        where: { id, tenantId: req.user!.tenantId! },
        data: { permissions }
    });

    const updatedRole = await prisma.role.findFirst({
        where: { id, tenantId: req.user!.tenantId! }
    });

    // Auditoría: registrar actualización de permisos
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
 * Elimina un rol personalizado.
 * Protecciones:
 * - Los roles de sistema (ADMIN, CASHIER, WAITER, KITCHEN) no se pueden eliminar
 * - No se puede eliminar un rol que tenga usuarios asignados
 * - Usa deleteMany con tenantId como defensa en profundidad (P0-005)
 */
export const deleteRole = asyncHandler(async (req: Request, res: Response) => {
    const idString = (req.params.id as string) || '';
    const id = parseInt(idString);

    if (isNaN(id)) {
        throw new ValidationError('Invalid role ID');
    }

    // Verificar que el rol exista y pertenezca al tenant
    const role = await prisma.role.findFirst({
        where: { id, tenantId: req.user!.tenantId! }
    });
    if (!role) {
        throw new NotFoundError('Role');
    }

    // Proteger roles de sistema por nombre (funciona para todos los tenants)
    if (SYSTEM_ROLE_NAMES.includes(role.name as typeof SYSTEM_ROLE_NAMES[number])) {
        throw new ForbiddenError('Cannot delete system roles');
    }

    // Verificar que no haya usuarios asignados a este rol (dentro del tenant)
    const usersCount = await prisma.user.count({
        where: {
            roleId: id,
            tenantId: req.user!.tenantId!
        }
    });
    if (usersCount > 0) {
        throw new ValidationError(`Cannot delete role: ${usersCount} users are assigned to this role`);
    }

    // Defensa en profundidad: deleteMany con tenantId (fix P0-005)
    await prisma.role.deleteMany({ where: { id, tenantId: req.user!.tenantId! } });

    // Auditoría: registrar eliminación del rol
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

/** Devuelve los módulos, recursos y acciones válidas para la UI de configuración de permisos */
export const getPermissionOptions = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, {
        modules: VALID_MODULES,
        resources: VALID_RESOURCES,
        actions: VALID_ACTIONS
    });
});
