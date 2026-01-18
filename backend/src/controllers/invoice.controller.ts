import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import * as invoiceService from '../services/invoice.service';

const generateInvoiceSchema = z.object({
    orderId: z.number().int().positive(),
    type: z.enum(['RECEIPT', 'INVOICE_B']).optional(),
    clientName: z.string().optional(),
    clientTaxId: z.string().optional()
});

/**
 * Generate invoice for an order
 * POST /invoices
 */
export const generateInvoice = asyncHandler(async (req: Request, res: Response) => {
    const parsed = generateInvoiceSchema.parse(req.body);
    const data = {
        orderId: parsed.orderId,
        type: parsed.type,
        clientName: parsed.clientName,
        clientTaxId: parsed.clientTaxId
    };
    const invoice = await invoiceService.generateInvoice(data);
    
    res.status(201).json({
        success: true,
        data: invoice
    });
});

/**
 * Get invoice by order ID
 * GET /invoices/order/:orderId
 */
export const getByOrderId = asyncHandler(async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.orderId as string);
    if (isNaN(orderId)) {
        throw new Error('Invalid order ID');
    }
    const invoice = await invoiceService.getByOrderId(orderId);
    
    res.json({
        success: true,
        data: invoice
    });
});

/**
 * Get invoice by invoice number
 * GET /invoices/:invoiceNumber
 */
export const getByInvoiceNumber = asyncHandler(async (req: Request, res: Response) => {
    const invoiceNumber = req.params.invoiceNumber as string;
    if (!invoiceNumber) {
        throw new Error('Invoice number required');
    }
    const invoice = await invoiceService.getByInvoiceNumber(invoiceNumber);
    
    res.json({
        success: true,
        data: invoice
    });
});

/**
 * Get all invoices with optional filters
 * GET /invoices
 */
export const getAll = asyncHandler(async (req: Request, res: Response) => {
    const { type, startDate, endDate } = req.query;
    
    const filters: any = {};
    if (type && (type === 'RECEIPT' || type === 'INVOICE_B')) {
        filters.type = type;
    }
    if (startDate) {
        filters.startDate = new Date(startDate as string);
    }
    if (endDate) {
        filters.endDate = new Date(endDate as string);
    }
    
    const invoices = await invoiceService.getAll(filters);
    
    res.json({
        success: true,
        data: invoices
    });
});
