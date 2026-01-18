"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = exports.useWalletFunds = exports.addWalletFunds = exports.redeemPoints = exports.getBalance = void 0;
const loyalty_service_1 = require("../services/loyalty.service");
const response_1 = require("../utils/response");
const asyncHandler_1 = require("../middleware/asyncHandler");
const loyaltyService = new loyalty_service_1.LoyaltyService();
/**
 * Get client's loyalty balance
 * GET /clients/:id/loyalty
 */
exports.getBalance = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clientId = parseInt(req.params.id);
    const balance = await loyaltyService.getBalance(clientId);
    (0, response_1.sendSuccess)(res, balance);
});
/**
 * Redeem points for discount
 * POST /clients/:id/loyalty/redeem
 */
exports.redeemPoints = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clientId = parseInt(req.params.id);
    const { points } = req.body;
    const discountAmount = await loyaltyService.redeemPoints(clientId, points);
    (0, response_1.sendSuccess)(res, {
        message: 'Points redeemed successfully',
        pointsRedeemed: points,
        discountAmount
    });
});
/**
 * Add funds to wallet
 * POST /clients/:id/wallet/add
 */
exports.addWalletFunds = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clientId = parseInt(req.params.id);
    const { amount } = req.body;
    const newBalance = await loyaltyService.addWalletFunds(clientId, amount);
    (0, response_1.sendSuccess)(res, {
        message: 'Funds added successfully',
        newBalance
    });
});
/**
 * Use wallet funds
 * POST /clients/:id/wallet/use
 */
exports.useWalletFunds = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clientId = parseInt(req.params.id);
    const { amount } = req.body;
    const amountUsed = await loyaltyService.useWalletFunds(clientId, amount);
    (0, response_1.sendSuccess)(res, {
        message: 'Wallet funds applied',
        amountUsed
    });
});
/**
 * Get loyalty program configuration
 * GET /loyalty/config
 */
exports.getConfig = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const config = loyaltyService.getConfig();
    (0, response_1.sendSuccess)(res, config);
});
//# sourceMappingURL=loyalty.controller.js.map