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

const createRoleSchema = z.object({
    name: z.string().min(2).max(50),
});

/**
 * Get all roles
 */
export const getRoles = async (req: Request, res: Response) => {
    try {
        const roles = await prisma.role.findMany({
            select: {
                id: true,
                name: true,
                permissions: true
            },
            orderBy: { name: 'asc' }
        });
        res.json({ success: true, data: roles });
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch roles' });
    }
};

/**
 * Create a new role
 * Permissions will be set to empty object {} by default
 */
export const createRole = async (req: Request, res: Response) => {
    try {
        const { name } = createRoleSchema.parse(req.body);

        // Check if role with same name exists
        const existing = await prisma.role.findUnique({ where: { name } });
        if (existing) {
            return res.status(400).json({ success: false, error: 'Role name already exists' });
        }

        const role = await prisma.role.create({
            data: {
                name,
                permissions: {} // Placeholder for future RBAC implementation
            }
        });

        res.status(201).json({ success: true, data: role });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, error: error.issues });
        }
        console.error('Error creating role:', error);
        res.status(500).json({ success: false, error: 'Failed to create role' });
    }
};

/**
 * Delete a role
 * System roles (id <= 5) are protected
 */
export const deleteRole = async (req: Request, res: Response) => {
    try {
        const idParam = req.params.id;
        if (!idParam) {
            return res.status(400).json({ success: false, error: 'Role ID is required' });
        }
        
        // Handle both string and string[] from Express
        const idString = Array.isArray(idParam) ? idParam[0] : idParam;
        if (!idString) {
            return res.status(400).json({ success: false, error: 'Role ID is required' });
        }
        const id = parseInt(idString);
        
        if (isNaN(id)) {
            return res.status(400).json({ success: false, error: 'Invalid role ID' });
        }

        // Protect system roles
        if (id <= 5) {
            return res.status(403).json({ 
                success: false, 
                error: 'Cannot delete system roles' 
            });
        }

        // Check if role has users
        const usersCount = await prisma.user.count({ where: { roleId: id } });
        if (usersCount > 0) {
            return res.status(400).json({ 
                success: false, 
                error: `Cannot delete role: ${usersCount} users are assigned to this role` 
            });
        }

        await prisma.role.delete({ where: { id } });
        res.json({ success: true, message: 'Role deleted successfully' });
    } catch (error) {
        console.error('Error deleting role:', error);
        res.status(500).json({ success: false, error: 'Failed to delete role' });
    }
};
