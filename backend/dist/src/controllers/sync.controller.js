"use strict";
/**
 * @fileoverview Sync Controller for offline synchronization
 * Endpoints for pull (get data) and push (sync offline operations)
 *
 * @module controllers/sync.controller
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.status = exports.push = exports.pull = void 0;
const sync_service_1 = require("../services/sync.service");
const asyncHandler_1 = require("../middleware/asyncHandler");
const zod_1 = require("zod");
const errors_1 = require("../utils/errors");
// Validation schemas
const PendingOrderItemSchema = zod_1.z.object({
    productId: zod_1.z.number().int().positive(),
    quantity: zod_1.z.number().int().positive(),
    notes: zod_1.z.string().optional(),
    modifiers: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.number().int().positive(),
        price: zod_1.z.coerce.number() // Accept strings and convert to numbers (e.g., "1.5" → 1.5)
    })).optional(),
    removedIngredientIds: zod_1.z.array(zod_1.z.number().int()).optional()
});
const PendingOrderSchema = zod_1.z.object({
    tempId: zod_1.z.string().min(1),
    items: zod_1.z.array(PendingOrderItemSchema).min(1),
    channel: zod_1.z.enum(['POS', 'DELIVERY_APP', 'WAITER_APP', 'QR_MENU']),
    tableId: zod_1.z.number().int().positive().optional(),
    clientId: zod_1.z.number().int().positive().optional(),
    createdAt: zod_1.z.string().datetime(),
    shiftId: zod_1.z.number().int().positive().optional()
});
const PendingPaymentSchema = zod_1.z.object({
    tempOrderId: zod_1.z.string().min(1),
    method: zod_1.z.enum(['CASH', 'CARD', 'TRANSFER', 'WALLET', 'OTHER']),
    amount: zod_1.z.number().positive(),
    createdAt: zod_1.z.string().datetime()
});
const SyncPushRequestSchema = zod_1.z.object({
    clientId: zod_1.z.string().min(1),
    pendingOrders: zod_1.z.array(PendingOrderSchema),
    pendingPayments: zod_1.z.array(PendingPaymentSchema)
});
/**
 * GET /api/v1/sync/pull
 * Pull all data needed for offline operation
 */
exports.pull = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await sync_service_1.syncService.pull();
    res.json({
        success: true,
        data
    });
});
/**
 * POST /api/v1/sync/push
 * Push offline operations to server
 */
exports.push = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    // Validate request body
    const validation = SyncPushRequestSchema.safeParse(req.body);
    if (!validation.success) {
        throw new errors_1.ValidationError('Invalid sync request', validation.error.issues);
    }
    // Get user from auth middleware
    const userId = req.user?.id;
    if (!userId) {
        throw new errors_1.ValidationError('User authentication required for sync');
    }
    const ip = String(req.ip || 'unknown');
    const result = await sync_service_1.syncService.push(validation.data, {
        userId,
        ipAddress: ip
    });
    res.json({
        success: result.success,
        data: result
    });
});
/**
 * GET /api/v1/sync/status
 * Check sync status and server time
 */
exports.status = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    res.json({
        success: true,
        data: {
            serverTime: new Date().toISOString(),
            online: true
        }
    });
});
//# sourceMappingURL=sync.controller.js.map