"use strict";
/**
 * @fileoverview Role Management Routes
 *
 * @business_rule
 * - GET /roles: Authenticated users can list (for assignment dropdowns)
 * - POST/PUT/DELETE: ADMIN role only
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const role_controller_1 = require("../controllers/role.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// List roles - any authenticated user (for dropdowns)
router.get('/', auth_1.authenticate, role_controller_1.getRoles);
// Get permission options (resources + actions) - any authenticated user
router.get('/permission-options', auth_1.authenticate, role_controller_1.getPermissionOptions);
// Get role by ID - ADMIN only
router.get('/:id', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), role_controller_1.getRoleById);
// Create role - ADMIN only
router.post('/', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), role_controller_1.createRole);
// Update role permissions - ADMIN only
router.put('/:id/permissions', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), role_controller_1.updateRolePermissions);
// Delete role - ADMIN only
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), role_controller_1.deleteRole);
exports.default = router;
//# sourceMappingURL=role.routes.js.map