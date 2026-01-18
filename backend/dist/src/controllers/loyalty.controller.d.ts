import { Request, Response } from 'express';
/**
 * Get client's loyalty balance
 * GET /clients/:id/loyalty
 */
export declare const getBalance: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Redeem points for discount
 * POST /clients/:id/loyalty/redeem
 */
export declare const redeemPoints: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Add funds to wallet
 * POST /clients/:id/wallet/add
 */
export declare const addWalletFunds: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Use wallet funds
 * POST /clients/:id/wallet/use
 */
export declare const useWalletFunds: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get loyalty program configuration
 * GET /loyalty/config
 */
export declare const getConfig: (req: Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=loyalty.controller.d.ts.map