/**
 * @fileoverview Controlador de Facturación
 *
 * Gestiona la generación y consulta de comprobantes fiscales.
 * Soporta dos tipos: RECEIPT (ticket simple) e INVOICE_B (factura B para consumidores finales).
 * Los comprobantes se vinculan a órdenes y opcionalmente a datos del cliente (nombre, CUIT).
 *
 * @module controllers/invoice.controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import * as invoiceService from '../services/invoice.service';
import { ValidationError } from '../utils/errors';
import { sendSuccess } from '../utils/response';

/** Esquema de validación para generar un comprobante fiscal a partir de una orden */
const generateInvoiceSchema = z.object({
    orderId: z.number().int().positive(),
    type: z.enum(['RECEIPT', 'INVOICE_B']).optional(),
    clientName: z.string().optional(),
    clientTaxId: z.string().optional()
});

/**
 * Genera un comprobante fiscal para una orden.
 * POST /invoices
 * Si no se especifica tipo, se genera un ticket (RECEIPT) por defecto.
 */
export const generateInvoice = asyncHandler(async (req: Request, res: Response) => {
    const parsed = generateInvoiceSchema.parse(req.body);
    const data = {
        orderId: parsed.orderId,
        type: parsed.type,
        clientName: parsed.clientName,
        clientTaxId: parsed.clientTaxId
    };
    const invoice = await invoiceService.generateInvoice(req.user!.tenantId!, data);

    sendSuccess(res, invoice, undefined, 201);
});

/**
 * Obtiene el comprobante asociado a una orden específica.
 * GET /invoices/order/:orderId
 */
export const getByOrderId = asyncHandler(async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.orderId as string);
    if (isNaN(orderId)) {
        throw new ValidationError('Invalid order ID');
    }
    const invoice = await invoiceService.getByOrderId(orderId, req.user!.tenantId!);

    sendSuccess(res, invoice);
});

/**
 * Obtiene un comprobante por su número de factura.
 * GET /invoices/:invoiceNumber
 */
export const getByInvoiceNumber = asyncHandler(async (req: Request, res: Response) => {
    const invoiceNumber = req.params.invoiceNumber as string;
    if (!invoiceNumber) {
        throw new ValidationError('Invoice number required');
    }
    const invoice = await invoiceService.getByInvoiceNumber(invoiceNumber, req.user!.tenantId!);

    sendSuccess(res, invoice);
});

/**
 * Lista todos los comprobantes con filtros opcionales de tipo y rango de fechas.
 * GET /invoices
 * Usado para reportes contables y listados en el panel de administración.
 */
export const getAll = asyncHandler(async (req: Request, res: Response) => {
    const { type, startDate, endDate } = req.query;

    const filters: { type?: 'RECEIPT' | 'INVOICE_B'; startDate?: Date; endDate?: Date } = {};
    if (type && (type === 'RECEIPT' || type === 'INVOICE_B')) {
        filters.type = type;
    }
    if (startDate) {
        filters.startDate = new Date(startDate as string);
    }
    if (endDate) {
        filters.endDate = new Date(endDate as string);
    }

    const invoices = await invoiceService.getAll(req.user!.tenantId!, filters);

    sendSuccess(res, invoices);
});
