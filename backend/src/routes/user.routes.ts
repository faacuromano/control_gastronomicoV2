/**
 * @fileoverview User Management Routes
 * 
 * @business_rule
 * - GET /users: Authenticated users can list (for assignment dropdowns)
 * - POST/PUT/DELETE: ADMIN role only
 */

import { Router } from 'express';
import { getRoles, createRole, deleteRole } from '../controllers/role.controller';
import { listUsers, getUserById, createUser, updateUser, deleteUser, getUsersWithCapability } from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Get users by capability - any authenticated user
router.get('/with-capability', authenticate, getUsersWithCapability);

// List users - any authenticated user (for dropdowns like "assign waiter")
router.get('/', authenticate, listUsers);

// Get single user - ADMIN only
router.get('/:id', authenticate, authorize(['ADMIN']), getUserById);

// Create user - ADMIN only (rate limited to prevent PIN enumeration P1-010)
router.post('/', authenticate, authorize(['ADMIN']), apiRateLimiter, createUser);

// Update user - ADMIN only (rate limited to prevent PIN enumeration P1-010)
router.put('/:id', authenticate, authorize(['ADMIN']), apiRateLimiter, updateUser);

// Delete (deactivate) user - ADMIN only
router.delete('/:id', authenticate, authorize(['ADMIN']), deleteUser);

export default router;
