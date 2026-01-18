"use strict";
/**
 * @fileoverview User Management Routes
 *
 * @business_rule
 * - GET /users: Authenticated users can list (for assignment dropdowns)
 * - POST/PUT/DELETE: ADMIN role only
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("../controllers/user.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get users by capability - any authenticated user
router.get('/with-capability', auth_1.authenticate, user_controller_1.getUsersWithCapability);
// List users - any authenticated user (for dropdowns like "assign waiter")
router.get('/', auth_1.authenticate, user_controller_1.listUsers);
// Get single user - ADMIN only
router.get('/:id', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), user_controller_1.getUserById);
// Create user - ADMIN only
router.post('/', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), user_controller_1.createUser);
// Update user - ADMIN only
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), user_controller_1.updateUser);
// Delete (deactivate) user - ADMIN only
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)(['ADMIN']), user_controller_1.deleteUser);
exports.default = router;
//# sourceMappingURL=user.routes.js.map