import { Request, Response } from 'express';
import { PrinterService } from '../services/printer.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../lib/prisma';
import { ValidationError } from '../utils/errors';

const printerService = new PrinterService();

/**
 * Generate ticket buffer (for local/browser printing)
 * GET /print/:id
 */
export const printTicket = asyncHandler(async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.id as string);
    const buffer = await printerService.generateOrderTicket(orderId);
    
    sendSuccess(res, { 
        message: 'Ticket generated',
        base64: buffer.toString('base64')
    });
});

/**
 * Print order to a specific thermal printer device
 * POST /print/:orderId/device/:printerId
 */
export const printToDevice = asyncHandler(async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.orderId as string);
    const printerId = parseInt(req.params.printerId as string);
    
    await printerService.printOrderToDevice(orderId, printerId);
    
    sendSuccess(res, { 
        message: 'Ticket sent to printer successfully'
    });
});

/**
 * Print pre-account (cuenta) to a thermal printer
 * This prints the order WITHOUT payment info - for customer before paying
 * POST /print/:orderId/preaccount/:printerId
 */
export const printPreAccount = asyncHandler(async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.orderId as string);
    const printerId = parseInt(req.params.printerId as string);
    
    // Use same print method - it already only shows payments if they exist
    // The pre-account is just printing an order before payment is made
    await printerService.printOrderToDevice(orderId, printerId);
    
    sendSuccess(res, { 
        message: 'Pre-cuenta enviada a impresora exitosamente'
    });
});

/**
 * Print test page to verify printer connection
 * POST /print/test/:printerId
 */
export const printTestPage = asyncHandler(async (req: Request, res: Response) => {
    const printerId = parseInt(req.params.printerId as string);
    
    await printerService.printTestPage(printerId);
    
    sendSuccess(res, { 
        message: 'Test page printed successfully'
    });
});

/**
 * Get all configured printers
 * GET /print/printers
 */
export const getPrinters = asyncHandler(async (_req: Request, res: Response) => {
    const printers = await prisma.printer.findMany({
        include: { categories: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' }
    });
    
    sendSuccess(res, printers);
});

/**
 * Get available Windows system printers
 * GET /print/printers/system
 */
export const getSystemPrinters = asyncHandler(async (_req: Request, res: Response) => {
    const printers = await printerService.listSystemPrinters();
    
    sendSuccess(res, printers);
});

/**
 * Create a new printer
 * POST /print/printers
 */
export const createPrinter = asyncHandler(async (req: Request, res: Response) => {
    const { name, connectionType, ipAddress, windowsName } = req.body;
    
    // Validate based on connection type
    if (connectionType === 'USB') {
        if (!windowsName) {
            throw new ValidationError('Windows printer name is required for USB printers');
        }
    } else if (connectionType === 'NETWORK' || !connectionType) {
        if (!ipAddress) {
            throw new ValidationError('IP address is required for network printers');
        }
    }
    
    const printer = await prisma.printer.create({
        data: { 
            name, 
            connectionType: connectionType || 'NETWORK',
            ipAddress: connectionType === 'USB' ? null : ipAddress,
            windowsName: connectionType === 'USB' ? windowsName : null
        }
    });
    
    sendSuccess(res, printer, undefined, 201);
});

/**
 * Update printer
 * PUT /print/printers/:id
 */
export const updatePrinter = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const { name, connectionType, ipAddress, windowsName } = req.body;
    
    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (connectionType !== undefined) updateData.connectionType = connectionType;
    
    if (connectionType === 'USB') {
        updateData.ipAddress = null;
        updateData.windowsName = windowsName;
    } else if (connectionType === 'NETWORK') {
        updateData.ipAddress = ipAddress;
        updateData.windowsName = null;
    } else {
        // Partial update - only update fields that were provided
        if (ipAddress !== undefined) updateData.ipAddress = ipAddress;
        if (windowsName !== undefined) updateData.windowsName = windowsName;
    }
    
    const printer = await prisma.printer.update({
        where: { id },
        data: updateData
    });
    
    sendSuccess(res, printer);
});

/**
 * Delete printer
 * DELETE /print/printers/:id
 */
export const deletePrinter = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    
    await prisma.printer.delete({ where: { id } });
    
    sendSuccess(res, { message: 'Printer deleted' });
});
