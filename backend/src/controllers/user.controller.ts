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

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

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
export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { role, includeInactive } = req.query;
        
        const where: any = {};
        
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
    } catch (error) {
        next(error);
    }
};

/**
 * Get users with a specific capability (flexible role matching).
 * 
 * @route GET /api/v1/users/with-capability
 * @query type - Capability type: 'delivery', 'kitchen', 'cashier'
 * @access Authenticated users
 * 
 * @example
 * GET /api/v1/users/with-capability?type=delivery
 * 
 * @business_rule
 * Searches for roles containing keywords related to the capability.
 * This allows flexible role naming without hardcoding exact role names.
 */
export const getUsersWithCapability = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { type } = req.query;
        
        if (!type || typeof type !== 'string') {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Capability type is required' }
            });
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
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: `Invalid capability type: ${type}` }
            });
        }

        // Search for users whose role name matches any of the keywords
        const users = await prisma.user.findMany({
            where: {
                isActive: true,
                role: {
                    OR: keywords.map(keyword => ({
                        name: { equals: keyword, mode: undefined as any }
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
    } catch (error) {
        next(error);
    }
};

/**
 * Get a single user by ID.
 * 
 * @route GET /api/v1/users/:id
 * @access ADMIN only
 */
export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const rawId = req.params.id;
        if (typeof rawId !== 'string') {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'ID inválido' }
            });
        }
        const id = parseInt(rawId, 10);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'ID inválido' }
            });
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
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Usuario no encontrado' }
            });
        }

        res.json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
};

/**
 * Create a new user.
 * 
 * @route POST /api/v1/users
 * @access ADMIN only
 * 
 * @business_rule
 * - Either email+password OR pinCode must be provided for authentication
 * - PIN codes must be unique across all users
 * - Passwords are hashed with bcrypt (10 rounds)
 */
export const createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const validation = CreateUserSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: validation.error.issues }
            });
        }

        const { name, email, pinCode, password, roleId } = validation.data;

        // Verify at least one auth method
        if (!email && !pinCode) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Se requiere email o PIN para autenticación' }
            });
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
            return res.status(409).json({
                success: false,
                error: { code: 'USER_EXISTS', message: 'Ya existe un usuario con ese email o PIN' }
            });
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
    } catch (error) {
        next(error);
    }
};

/**
 * Update an existing user.
 * 
 * @route PUT /api/v1/users/:id
 * @access ADMIN only
 * 
 * @business_rule
 * - Partial updates allowed
 * - Password is re-hashed if changed
 * - Cannot change email/PIN to one already in use
 */
export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const rawId = req.params.id;
        if (typeof rawId !== 'string') {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'ID inválido' }
            });
        }
        const userId = parseInt(rawId, 10);
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'ID inválido' }
            });
        }

        const validation = UpdateUserSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: validation.error.issues }
            });
        }

        const { name, email, pinCode, password, roleId, isActive } = validation.data;

        // Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!existingUser) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Usuario no encontrado' }
            });
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
                return res.status(409).json({
                    success: false,
                    error: { code: 'USER_EXISTS', message: 'Email o PIN ya en uso por otro usuario' }
                });
            }
        }

        // Build update data
        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (pinCode !== undefined) updateData.pinCode = pinCode;
        if (roleId !== undefined) updateData.roleId = roleId;
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
    } catch (error) {
        next(error);
    }
};

/**
 * Soft-delete a user (set isActive = false).
 * 
 * @route DELETE /api/v1/users/:id
 * @access ADMIN only
 * 
 * @business_rule
 * - Users cannot delete themselves (prevents lockout)
 * - This is a soft delete to preserve audit trail
 * - Hard delete not implemented for data integrity
 */
export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const rawId = req.params.id;
        if (typeof rawId !== 'string') {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'ID inválido' }
            });
        }
        const userId = parseInt(rawId, 10);
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'ID inválido' }
            });
        }

        // Prevent self-deletion
        if (req.user?.id === userId) {
            return res.status(400).json({
                success: false,
                error: { code: 'SELF_DELETE', message: 'No puedes eliminar tu propio usuario' }
            });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Usuario no encontrado' }
            });
        }

        // Soft delete
        await prisma.user.update({
            where: { id: userId },
            data: { isActive: false }
        });

        res.json({ success: true, message: 'Usuario desactivado correctamente' });
    } catch (error) {
        next(error);
    }
};
