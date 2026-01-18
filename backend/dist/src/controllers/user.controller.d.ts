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
/**
 * List all active users with optional role filter.
 *
 * @route GET /api/v1/users
 * @access Authenticated users (for assignment dropdowns)
 *
 * @example
 * GET /api/v1/users?role=MESERO
 */
export declare const listUsers: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get users with a specific capability (flexible role matching).
 *
 * @route GET /api/v1/users/with-capability
 * @query type - Capability type: 'delivery', 'kitchen', 'cashier'
 * @access Authenticated users
 */
export declare const getUsersWithCapability: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get a single user by ID.
 *
 * @route GET /api/v1/users/:id
 * @access ADMIN only
 */
export declare const getUserById: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Create a new user.
 *
 * @route POST /api/v1/users
 * @access ADMIN only
 */
export declare const createUser: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Update an existing user.
 *
 * @route PUT /api/v1/users/:id
 * @access ADMIN only
 */
export declare const updateUser: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Soft-delete a user (set isActive = false).
 *
 * @route DELETE /api/v1/users/:id
 * @access ADMIN only
 */
export declare const deleteUser: (req: Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=user.controller.d.ts.map