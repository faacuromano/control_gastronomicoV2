/**
 * @fileoverview Role Management Routes
 * 
 * @business_rule
 * - GET /roles: Authenticated users can list (for assignment dropdowns)
 * - POST/PUT/DELETE: ADMIN role only
 */

import { Router } from 'express';
import { 
    getRoles, 
    getRoleById,
    createRole, 
    deleteRole, 
    updateRolePermissions,
    getPermissionOptions
} from '../controllers/role.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// List roles - any authenticated user (for dropdowns)
router.get('/', authenticate, getRoles);

// Get permission options (resources + actions) - any authenticated user
router.get('/permission-options', authenticate, getPermissionOptions);

// Get role by ID - ADMIN only
router.get('/:id', authenticate, authorize(['ADMIN']), getRoleById);

// Create role - ADMIN only
router.post('/', authenticate, authorize(['ADMIN']), createRole);

// Update role permissions - ADMIN only
router.put('/:id/permissions', authenticate, authorize(['ADMIN']), updateRolePermissions);

// Delete role - ADMIN only
router.delete('/:id', authenticate, authorize(['ADMIN']), deleteRole);

export default router;
