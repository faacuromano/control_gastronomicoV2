import { Request, Response } from 'express';
import { LoyaltyService } from '../services/loyalty.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../middleware/asyncHandler';

const loyaltyService = new LoyaltyService();

/**
 * Get client's loyalty balance
 * GET /clients/:id/loyalty
 */
export const getBalance = asyncHandler(async (req: Request, res: Response) => {
    const clientId = parseInt(req.params.id as string);
    const balance = await loyaltyService.getBalance(clientId, req.user!.tenantId!);
    sendSuccess(res, balance);
});

/**
 * Redeem points for discount
 * POST /clients/:id/loyalty/redeem
 */
export const redeemPoints = asyncHandler(async (req: Request, res: Response) => {
    const clientId = parseInt(req.params.id as string);
    const { points } = req.body;
    
    const discountAmount = await loyaltyService.redeemPoints(clientId, points, req.user!.tenantId!);
    
    sendSuccess(res, {
        message: 'Points redeemed successfully',
        pointsRedeemed: points,
        discountAmount
    });
});

/**
 * Add funds to wallet
 * POST /clients/:id/wallet/add
 */
export const addWalletFunds = asyncHandler(async (req: Request, res: Response) => {
    const clientId = parseInt(req.params.id as string);
    const { amount } = req.body;
    
    const newBalance = await loyaltyService.addWalletFunds(clientId, amount, req.user!.tenantId!);
    
    sendSuccess(res, {
        message: 'Funds added successfully',
        newBalance
    });
});

/**
 * Use wallet funds
 * POST /clients/:id/wallet/use
 */
export const useWalletFunds = asyncHandler(async (req: Request, res: Response) => {
    const clientId = parseInt(req.params.id as string);
    const { amount } = req.body;
    
    const amountUsed = await loyaltyService.useWalletFunds(clientId, amount, req.user!.tenantId!);
    
    sendSuccess(res, {
        message: 'Wallet funds applied',
        amountUsed
    });
});

/**
 * Get loyalty program configuration
 * GET /loyalty/config
 */
export const getConfig = asyncHandler(async (_req: Request, res: Response) => {
    const config = loyaltyService.getConfig();
    sendSuccess(res, config);
});
