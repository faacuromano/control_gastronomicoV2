/**
 * @fileoverview Role Management Routes
 * 
 * @business_rule
 * - GET /roles: Authenticated users can list (for assignment dropdowns)
 * - POST/DELETE: ADMIN role only
 */

import { Router } from 'express';
import { getRoles, createRole, deleteRole } from '../controllers/role.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// List roles - any authenticated user (for dropdowns)
router.get('/', authenticate, getRoles);

// Create role - ADMIN only
router.post('/', authenticate, authorize(['ADMIN']), createRole);

// Delete role - ADMIN only
router.delete('/:id', authenticate, authorize(['ADMIN']), deleteRole);

export default router;
