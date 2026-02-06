/**
 * @fileoverview Controlador de Gestión de Usuarios
 *
 * Maneja las operaciones CRUD para los usuarios del sistema.
 * Cada usuario pertenece a un tenant y tiene un rol asignado que
 * determina sus permisos. Soporta dos métodos de autenticación:
 * PIN (6 dígitos, para acceso rápido en POS) y email+contraseña.
 *
 * Reglas de negocio:
 * - La gestión de usuarios está restringida al rol ADMIN (excepto listado)
 * - Un usuario no puede eliminarse a sí mismo para evitar bloqueo del sistema
 * - Email y PIN deben ser únicos dentro del tenant
 * - La eliminación es lógica (soft-delete via isActive=false)
 *
 * @module controllers/user.controller
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { Prisma, AuditAction } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { ValidationError, NotFoundError, ConflictError, UnauthorizedError, ApiError } from '../utils/errors';
import { BCRYPT_SALT_ROUNDS, generatePinLookup } from '../services/auth.service';
import { auditService } from '../services/audit.service';
import { sendSuccess } from '../utils/response';

/** Esquema de validación para crear un nuevo usuario */
const CreateUserSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.union([z.string().email('Invalid email'), z.literal('')]).optional().transform(v => v || undefined),
    pinCode: z.string().length(6, 'PIN must be 6 digits').optional(),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[a-z]/, 'Must contain lowercase')
        .regex(/[A-Z]/, 'Must contain uppercase')
        .regex(/[0-9]/, 'Must contain number')
        .optional(),
    roleId: z.number().int().positive('Invalid Role ID')
});

/** Esquema de validación para actualizar un usuario existente (todos los campos opcionales) */
const UpdateUserSchema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    pinCode: z.string().length(6).optional(),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[a-z]/, 'Must contain lowercase')
        .regex(/[A-Z]/, 'Must contain uppercase')
        .regex(/[0-9]/, 'Must contain number')
        .optional(),
    roleId: z.number().int().positive().optional(),
    isActive: z.boolean().optional()
});

/**
 * Lista todos los usuarios activos del tenant con filtro opcional por rol.
 * Usado en dropdowns de asignación (ej: asignar mozo a mesa, cajero a turno).
 *
 * @route GET /api/v1/users
 * @query role - Filtrar por nombre de rol (ej: WAITER, CASHIER)
 * @query includeInactive - Si es 'true', incluye usuarios desactivados
 * @query page, limit - Paginación
 */
export const listUsers = asyncHandler(async (req: Request, res: Response) => {
    const { role, includeInactive, page: pageStr, limit: limitStr } = req.query;

    // Parsear parámetros de paginación
    const page = Math.max(1, parseInt(pageStr as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(limitStr as string) || 50), 100);
    const skip = (page - 1) * limit;

    // Construir cláusula WHERE con tipado Prisma correcto
    const where: Prisma.UserWhereInput = {
        tenantId: req.user!.tenantId!
    };

    // Solo mostrar usuarios activos a menos que se pida explícitamente lo contrario
    if (includeInactive !== 'true') {
        where.isActive = true;
    }

    if (role && typeof role === 'string') {
        where.role = { name: role };
    }

    // Obtener total para metadatos de paginación
    const total = await prisma.user.count({ where });

    const users = await prisma.user.findMany({
        where,
        select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
            createdAt: true,
            role: {
                select: { id: true, name: true }
            }
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit
    });

    sendSuccess(res, users, { page, limit, total, totalPages: Math.ceil(total / limit) });
});

/**
 * Obtiene usuarios con una capacidad específica basada en keywords del nombre de rol.
 * Permite búsqueda flexible por tipo de rol (delivery, kitchen, cashier, waiter)
 * sin depender de nombres de rol exactos (soporta español e inglés).
 *
 * @route GET /api/v1/users/with-capability
 * @query type - Tipo de capacidad: 'delivery', 'kitchen', 'cashier', 'waiter'
 */
export const getUsersWithCapability = asyncHandler(async (req: Request, res: Response) => {
    const { type } = req.query;

    if (!type || typeof type !== 'string') {
        throw new ValidationError('Capability type is required');
    }

    // Keywords para cada tipo de capacidad (soporta español e inglés)
    const capabilityKeywords: Record<string, string[]> = {
        delivery: ['DRIVER', 'REPARTIDOR', 'DELIVERY', 'ENVIO', 'CADETE'],
        kitchen: ['KITCHEN', 'COCINA', 'COCINERO', 'CHEF'],
        cashier: ['CASHIER', 'CAJERO', 'CAJA'],
        waiter: ['WAITER', 'MESERO', 'MOZO', 'CAMARERO']
    };

    const keywords = capabilityKeywords[type.toLowerCase()];
    if (!keywords) {
        throw new ValidationError(`Invalid capability type: ${type}`);
    }

    // Buscar usuarios cuyo nombre de rol coincida con algún keyword (case-insensitive)
    const users = await prisma.user.findMany({
        where: {
            tenantId: req.user!.tenantId!,
            isActive: true,
            role: {
                OR: keywords.map(keyword => ({
                    name: { contains: keyword }
                }))
            }
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: {
                select: { id: true, name: true }
            }
        },
        orderBy: { name: 'asc' }
    });

    sendSuccess(res, users);
});

/**
 * Obtiene un usuario por ID (solo ADMIN).
 * SEGURIDAD: Nunca expone pinHash en la respuesta de la API.
 *
 * @route GET /api/v1/users/:id
 */
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
        throw new ValidationError('Invalid ID');
    }

    const user = await prisma.user.findFirst({
        where: { id, tenantId: req.user!.tenantId! },
        select: {
            id: true,
            name: true,
            email: true,
            // SEGURIDAD: Nunca exponer pinHash en la API
            pinHash: false,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            role: {
                select: { id: true, name: true, permissions: true }
            }
        }
    });

    if (!user) {
        throw new NotFoundError('User');
    }

    sendSuccess(res, user);
});

/**
 * Crea un nuevo usuario (solo ADMIN).
 * Valida unicidad de email y PIN dentro del tenant.
 * Verifica que el roleId pertenezca al mismo tenant (previene asignación cross-tenant).
 *
 * @route POST /api/v1/users
 */
export const createUser = asyncHandler(async (req: Request, res: Response) => {
    const data = CreateUserSchema.parse(req.body);

    const { name, email, pinCode, password, roleId } = data;

    // Verificar que al menos un método de autenticación esté presente
    if (!email && !pinCode) {
        throw new ValidationError('Email or PIN required for authentication');
    }

    // Verificar unicidad de email dentro del tenant (FIX: usar findFirst en vez de findUnique)
    if (email) {
        const existingEmail = await prisma.user.findFirst({
            where: {
                email,
                tenantId: req.user!.tenantId!
            }
        });
        if (existingEmail) {
            throw new ConflictError('A user with that email already exists');
        }
    }

    // Verificar que el roleId pertenezca al mismo tenant (previene asignación cross-tenant)
    const role = await prisma.role.findFirst({
        where: { id: roleId, tenantId: req.user!.tenantId! }
    });
    if (!role) {
        throw new NotFoundError('Role');
    }

    // Verificar unicidad del PIN via pinLookup (búsqueda O(1) por índice)
    let pinHash: string | null = null;
    let pinLookup: string | null = null;
    if (pinCode) {
        pinLookup = generatePinLookup(pinCode);
        const existing = await prisma.user.findFirst({
            where: {
                tenantId: req.user!.tenantId!,
                pinLookup
            }
        });
        if (existing) {
            throw new ConflictError('PIN already in use by another user');
        }
        pinHash = await bcrypt.hash(pinCode, BCRYPT_SALT_ROUNDS);
    }

    // Hashear contraseña si se proporcionó
    const passwordHash = password ? await bcrypt.hash(password, BCRYPT_SALT_ROUNDS) : null;

    const user = await prisma.user.create({
        data: {
            tenantId: req.user!.tenantId!,
            name,
            email: email ?? null,
            pinHash,
            pinLookup,
            passwordHash,
            roleId
        } as Prisma.UserUncheckedCreateInput,
        select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
            role: { select: { id: true, name: true } }
        }
    });

    // Auditoría: registrar creación del usuario
    auditService.log(
        'USER_CREATED',
        'User',
        user.id,
        {
            userId: req.user!.id!,
            tenantId: req.user!.tenantId!,
            ipAddress: String(req.ip),
            userAgent: req.headers['user-agent'] ?? 'unknown'
        },
        { name: user.name, email: user.email, roleId }
    );

    sendSuccess(res, user, undefined, 201);
});

/**
 * Actualiza un usuario existente (solo ADMIN).
 * Valida unicidad de email y PIN, verifica que el rol pertenezca al tenant.
 * Usa updateMany con tenantId como defensa en profundidad.
 *
 * @route PUT /api/v1/users/:id
 */
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id as string, 10);
    if (isNaN(userId)) {
        throw new ValidationError('Invalid ID');
    }

    const data = UpdateUserSchema.parse(req.body);
    const { name, email, pinCode, password, roleId, isActive } = data;

    // Verificar que el usuario exista y pertenezca al tenant
    const existingUser = await prisma.user.findFirst({
        where: { id: userId, tenantId: req.user!.tenantId! }
    });
    if (!existingUser) {
        throw new NotFoundError('User');
    }

    // Verificar conflicto de email con otros usuarios del mismo tenant
    if (email) {
        const emailConflict = await prisma.user.findFirst({
            where: {
                email,
                id: { not: userId },
                tenantId: req.user!.tenantId!
            }
        });
        if (emailConflict) {
            throw new ConflictError('Email already in use by another user');
        }
    }

    // Verificar que el roleId pertenezca al mismo tenant (previene asignación cross-tenant)
    if (roleId !== undefined) {
        const roleExists = await prisma.role.findFirst({
            where: { id: roleId, tenantId: req.user!.tenantId! }
        });
        if (!roleExists) {
            throw new NotFoundError('Role');
        }
    }

    // Construir datos de actualización con tipado correcto de Prisma
    const updateData: Prisma.UserUpdateInput = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (roleId !== undefined) updateData.role = { connect: { id: roleId } };
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password) updateData.passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Verificar unicidad del PIN via pinLookup (búsqueda O(1) por índice)
    if (pinCode !== undefined) {
        const pinLookup = generatePinLookup(pinCode);
        const existing = await prisma.user.findFirst({
            where: {
                tenantId: req.user!.tenantId!,
                pinLookup,
                id: { not: userId }
            }
        });
        if (existing) {
            throw new ConflictError('PIN already in use by another user');
        }
        updateData.pinHash = await bcrypt.hash(pinCode, BCRYPT_SALT_ROUNDS);
        updateData.pinLookup = pinLookup;
    }

    // Defensa en profundidad: incluir tenantId en WHERE para prevenir acceso cross-tenant
    const result = await prisma.user.updateMany({
        where: { id: userId, tenantId: req.user!.tenantId! },
        data: updateData
    });

    if (result.count === 0) {
        throw new NotFoundError('User');
    }

    // Obtener usuario actualizado para la respuesta
    const user = await prisma.user.findFirst({
        where: { id: userId, tenantId: req.user!.tenantId! },
        select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
            role: { select: { id: true, name: true } }
        }
    });

    // Auditoría: registrar actualización del usuario
    auditService.log(
        AuditAction.USER_UPDATED,
        'User',
        userId,
        {
            userId: req.user!.id!,
            tenantId: req.user!.tenantId!,
            ipAddress: String(req.ip),
            userAgent: req.headers['user-agent'] ?? 'unknown'
        },
        { updates: data }
    );

    sendSuccess(res, user);
});

/**
 * Desactiva un usuario (soft-delete, isActive = false).
 * No se elimina físicamente para mantener integridad con órdenes y auditoría.
 *
 * Protección: un usuario no puede desactivarse a sí mismo.
 *
 * @route DELETE /api/v1/users/:id
 */
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id as string, 10);
    if (isNaN(userId)) {
        throw new ValidationError('Invalid ID');
    }

    // Prevenir auto-eliminación para evitar bloqueo del sistema
    if (req.user?.id === userId) {
        throw new ApiError('SELF_DELETE', 'Cannot delete your own user account', 400);
    }

    const user = await prisma.user.findFirst({
        where: { id: userId, tenantId: req.user!.tenantId! }
    });
    if (!user) {
        throw new NotFoundError('User');
    }

    // Defensa en profundidad: soft-delete con tenantId en WHERE
    await prisma.user.updateMany({
        where: { id: userId, tenantId: req.user!.tenantId! },
        data: { isActive: false }
    });

    // Auditoría: registrar desactivación del usuario
    auditService.log(
        'USER_DELETED',
        'User',
        userId,
        {
            userId: req.user!.id!,
            tenantId: req.user!.tenantId!,
            ipAddress: String(req.ip),
            userAgent: req.headers['user-agent'] ?? 'unknown'
        },
        { userName: user.name, userEmail: user.email }
    );

    sendSuccess(res, { message: 'Usuario desactivado exitosamente' });
});
