/**
 * @fileoverview Controlador de Fidelización (Loyalty)
 *
 * Gestiona el programa de puntos de fidelidad y billetera virtual de los clientes.
 * Los clientes acumulan puntos por sus compras, que pueden canjear por descuentos.
 * También pueden cargar saldo en su billetera virtual para pagar consumos.
 *
 * Endpoints:
 * - Balance de puntos y billetera de un cliente
 * - Canje de puntos por descuento
 * - Carga y uso de fondos de billetera
 * - Configuración del programa de fidelización
 *
 * @module controllers/loyalty.controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { LoyaltyService } from '../services/loyalty.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../middleware/asyncHandler';

/** Esquema para canje de puntos: cantidad de puntos a redimir */
const redeemSchema = z.object({
    points: z.number().int().positive('Points must be a positive integer')
});

/** Esquema para operaciones de billetera: monto a cargar/usar */
const walletAmountSchema = z.object({
    amount: z.number().positive('Amount must be positive')
});

const loyaltyService = new LoyaltyService();

/**
 * Obtiene el balance de puntos y billetera de un cliente.
 * GET /clients/:id/loyalty
 */
export const getBalance = asyncHandler(async (req: Request, res: Response) => {
    const clientId = parseInt(req.params.id as string);
    const balance = await loyaltyService.getBalance(clientId, req.user!.tenantId!);
    sendSuccess(res, balance);
});

/**
 * Canjea puntos acumulados por un descuento monetario.
 * POST /clients/:id/loyalty/redeem
 * La conversión de puntos a dinero está configurada en el programa de fidelización.
 */
export const redeemPoints = asyncHandler(async (req: Request, res: Response) => {
    const clientId = parseInt(req.params.id as string);
    const { points } = redeemSchema.parse(req.body);

    const discountAmount = await loyaltyService.redeemPoints(clientId, points, req.user!.tenantId!);

    sendSuccess(res, {
        message: 'Points redeemed successfully',
        pointsRedeemed: points,
        discountAmount
    });
});

/**
 * Carga fondos en la billetera virtual del cliente.
 * POST /clients/:id/wallet/add
 * Permite al cliente tener saldo prepago para futuras consumiciones.
 */
export const addWalletFunds = asyncHandler(async (req: Request, res: Response) => {
    const clientId = parseInt(req.params.id as string);
    const { amount } = walletAmountSchema.parse(req.body);

    const newBalance = await loyaltyService.addWalletFunds(clientId, amount, req.user!.tenantId!);

    sendSuccess(res, {
        message: 'Funds added successfully',
        newBalance
    });
});

/**
 * Utiliza fondos de la billetera virtual para pagar un consumo.
 * POST /clients/:id/wallet/use
 * El monto efectivamente usado puede ser menor al solicitado si el saldo es insuficiente.
 */
export const useWalletFunds = asyncHandler(async (req: Request, res: Response) => {
    const clientId = parseInt(req.params.id as string);
    const { amount } = walletAmountSchema.parse(req.body);

    const amountUsed = await loyaltyService.useWalletFunds(clientId, amount, req.user!.tenantId!);

    sendSuccess(res, {
        message: 'Wallet funds applied',
        amountUsed
    });
});

/**
 * Obtiene la configuración del programa de fidelización.
 * GET /loyalty/config
 * Retorna parámetros como puntos por peso gastado, valor del punto en descuento, etc.
 */
export const getConfig = asyncHandler(async (_req: Request, res: Response) => {
    const config = loyaltyService.getConfig();
    sendSuccess(res, config);
});
