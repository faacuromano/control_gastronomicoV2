/**
 * @fileoverview User Management Controller
 * Handles CRUD operations for system users.
 * 
 * @module controllers/user.controller
 * @adheres Single Responsibility - User entity operations only
 * 
 * @business_rule
 * User management is restricted to ADMIN role only (except listing).
 * Users cannot delete themselves to prevent system lockout.
 * Email and PIN must remain unique across the system.
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { ValidationError, NotFoundError, ConflictError, UnauthorizedError, ApiError } from '../utils/errors';

/**
 * Schema for creating a new user
 */
const CreateUserSchema = z.object({
    name: z.string().min(1, 'Nombre es requerido'),
    email: z.string().email('Email inválido').optional(),
    pinCode: z.string().length(6, 'PIN debe tener 6 dígitos').optional(),
    password: z.string().min(6, 'Password mínimo 6 caracteres').optional(),
    roleId: z.number().int().positive('Role ID inválido')
});

/**
 * Schema for updating an existing user
 */
const UpdateUserSchema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    pinCode: z.string().length(6).optional(),
    password: z.string().min(6).optional(),
    roleId: z.number().int().positive().optional(),
    isActive: z.boolean().optional()
});

/**
 * List all active users with optional role filter.
 * 
 * @route GET /api/v1/users
 * @access Authenticated users (for assignment dropdowns)
 * 
 * @example
 * GET /api/v1/users?role=MESERO
 */
export const listUsers = asyncHandler(async (req: Request, res: Response) => {
    const { role, includeInactive } = req.query;
    
    // Build where clause with proper Prisma typing
    const where: Prisma.UserWhereInput = {};
    
    // Only show active users unless explicitly requested
    if (includeInactive !== 'true') {
        where.isActive = true;
    }
    
    if (role && typeof role === 'string') {
        where.role = { name: role };
    }

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
        orderBy: { name: 'asc' }
    });

    res.json({ success: true, data: users });
});

/**
 * Get users with a specific capability (flexible role matching).
 * 
 * @route GET /api/v1/users/with-capability
 * @query type - Capability type: 'delivery', 'kitchen', 'cashier'
 * @access Authenticated users
 */
export const getUsersWithCapability = asyncHandler(async (req: Request, res: Response) => {
    const { type } = req.query;
    
    if (!type || typeof type !== 'string') {
        throw new ValidationError('Capability type is required');
    }

    // Define keywords for each capability type
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

    // Search for users whose role name matches any of the keywords (case-insensitive)
    const users = await prisma.user.findMany({
        where: {
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

    res.json({ success: true, data: users });
});

/**
 * Get a single user by ID.
 * 
 * @route GET /api/v1/users/:id
 * @access ADMIN only
 */
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
        throw new ValidationError('ID inválido');
    }
    
    const user = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            email: true,
            pinCode: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            role: {
                select: { id: true, name: true, permissions: true }
            }
        }
    });

    if (!user) {
        throw new NotFoundError('Usuario');
    }

    res.json({ success: true, data: user });
});

/**
 * Create a new user.
 * 
 * @route POST /api/v1/users
 * @access ADMIN only
 */
export const createUser = asyncHandler(async (req: Request, res: Response) => {
    const data = CreateUserSchema.parse(req.body);

    const { name, email, pinCode, password, roleId } = data;

    // Verify at least one auth method
    if (!email && !pinCode) {
        throw new ValidationError('Se requiere email o PIN para autenticación');
    }

    // Check for existing user with same email or PIN
    const existing = await prisma.user.findFirst({
        where: {
            OR: [
                email ? { email } : {},
                pinCode ? { pinCode } : {}
            ].filter(obj => Object.keys(obj).length > 0)
        }
    });

    if (existing) {
        throw new ConflictError('Ya existe un usuario con ese email o PIN');
    }

    // Hash password if provided
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    const user = await prisma.user.create({
        data: {
            name,
            email: email ?? null,
            pinCode: pinCode ?? null,
            passwordHash,
            roleId
        },
        select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
            role: { select: { id: true, name: true } }
        }
    });

    res.status(201).json({ success: true, data: user });
});

/**
 * Update an existing user.
 * 
 * @route PUT /api/v1/users/:id
 * @access ADMIN only
 */
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id as string, 10);
    if (isNaN(userId)) {
        throw new ValidationError('ID inválido');
    }

    const data = UpdateUserSchema.parse(req.body);
    const { name, email, pinCode, password, roleId, isActive } = data;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) {
        throw new NotFoundError('Usuario');
    }

    // Check for conflicts if changing email or PIN
    if (email || pinCode) {
        const conflict = await prisma.user.findFirst({
            where: {
                AND: [
                    { id: { not: userId } },
                    {
                        OR: [
                            email ? { email } : {},
                            pinCode ? { pinCode } : {}
                        ].filter(obj => Object.keys(obj).length > 0)
                    }
                ]
            }
        });

        if (conflict) {
            throw new ConflictError('Email o PIN ya en uso por otro usuario');
        }
    }

    // Build update data with proper typing
    const updateData: Prisma.UserUpdateInput = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (pinCode !== undefined) updateData.pinCode = pinCode;
    if (roleId !== undefined) updateData.role = { connect: { id: roleId } };
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password) updateData.passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
            role: { select: { id: true, name: true } }
        }
    });

    res.json({ success: true, data: user });
});

/**
 * Soft-delete a user (set isActive = false).
 * 
 * @route DELETE /api/v1/users/:id
 * @access ADMIN only
 */
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id as string, 10);
    if (isNaN(userId)) {
        throw new ValidationError('ID inválido');
    }

    // Prevent self-deletion
    if (req.user?.id === userId) {
        throw new ApiError('SELF_DELETE', 'No puedes eliminar tu propio usuario', 400);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new NotFoundError('Usuario');
    }

    // Soft delete
    await prisma.user.update({
        where: { id: userId },
        data: { isActive: false }
    });

    res.json({ success: true, message: 'Usuario desactivado correctamente' });
});
