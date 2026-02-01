import { Request, Response } from 'express';
import { PrinterService } from '../services/printer.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../lib/prisma';
import { ValidationError } from '../utils/errors';
import { auditService } from '../services/audit.service';

const printerService = new PrinterService();

// Validation patterns for printer inputs
const IP_PATTERN = /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/;
const SAFE_NAME_PATTERN = /^[a-zA-Z0-9\s\-_().#]+$/;

function validatePrinterInputs(ipAddress?: string, windowsName?: string, name?: string): void {
    if (ipAddress && !IP_PATTERN.test(ipAddress)) {
        throw new ValidationError('Invalid IP address format. Expected: x.x.x.x or x.x.x.x:port');
    }
    if (ipAddress) {
        const ipPart = ipAddress.split(':')[0];
        const parts = ipPart ? ipPart.split('.') : [];
        if (parts.some(p => parseInt(p) > 255)) {
            throw new ValidationError('Invalid IP address: octets must be 0-255');
        }
    }
    if (windowsName && !SAFE_NAME_PATTERN.test(windowsName)) {
        throw new ValidationError('Printer name contains invalid characters');
    }
    if (windowsName && windowsName.length > 200) {
        throw new ValidationError('Printer name too long (max 200 characters)');
    }
    if (name && !SAFE_NAME_PATTERN.test(name)) {
        throw new ValidationError('Printer display name contains invalid characters');
    }
}

/**
 * Generate ticket buffer (for local/browser printing)
 * GET /print/:id
 */
export const printTicket = asyncHandler(async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.id as string);
    const buffer = await printerService.generateOrderTicket(orderId, req.user!.tenantId!);
    
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
    
    await printerService.printOrderToDevice(orderId, printerId, req.user!.tenantId!);
    
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
    await printerService.printOrderToDevice(orderId, printerId, req.user!.tenantId!);
    
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
    
    await printerService.printTestPage(printerId, req.user!.tenantId!);
    
    sendSuccess(res, { 
        message: 'Test page printed successfully'
    });
});

/**
 * Get all configured printers
 * GET /print/printers
 */
export const getPrinters = asyncHandler(async (req: Request, res: Response) => {
    const printers = await prisma.printer.findMany({
        where: { tenantId: req.user!.tenantId! },
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

    // Sanitize inputs to prevent command injection
    validatePrinterInputs(ipAddress, windowsName, name);

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
            tenantId: req.user!.tenantId!,
            name,
            connectionType: connectionType || 'NETWORK',
            ipAddress: connectionType === 'USB' ? null : ipAddress,
            windowsName: connectionType === 'USB' ? windowsName : null
        }
    });

    // Audit log - after successful creation
    auditService.log(
        'PRINTER_CREATED' as any,
        'Printer',
        printer.id,
        {
            userId: req.user!.id!,
            tenantId: req.user!.tenantId!,
            ipAddress: String(req.ip),
            userAgent: req.headers['user-agent'] ?? 'unknown'
        },
        { name: printer.name, connectionType: printer.connectionType, ipAddress: printer.ipAddress }
    );

    sendSuccess(res, printer, undefined, 201);
});

/**
 * Update printer
 * PUT /print/printers/:id
 */
export const updatePrinter = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const { name, connectionType, ipAddress, windowsName } = req.body;

    // Sanitize inputs to prevent command injection
    validatePrinterInputs(ipAddress, windowsName, name);

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
    
    // Defense-in-depth: updateMany with tenantId (P1-009 fix)
    const result = await prisma.printer.updateMany({
        where: { id, tenantId: req.user!.tenantId! },
        data: updateData
    });
    if (result.count === 0) throw new ValidationError('Printer not found');

    const printer = await prisma.printer.findFirst({
        where: { id, tenantId: req.user!.tenantId! }
    });

    // Audit log - after successful update
    auditService.log(
        'PRINTER_UPDATED' as any,
        'Printer',
        id,
        {
            userId: req.user!.id!,
            tenantId: req.user!.tenantId!,
            ipAddress: String(req.ip),
            userAgent: req.headers['user-agent'] ?? 'unknown'
        },
        { updates: updateData }
    );

    sendSuccess(res, printer);
});

/**
 * Delete printer
 * DELETE /print/printers/:id
 */
export const deletePrinter = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);

    // Get printer details before deletion for audit log
    const printer = await prisma.printer.findFirst({
        where: { id, tenantId: req.user!.tenantId! }
    });

    // Defense-in-depth: deleteMany with tenantId (P1-009 fix)
    const result = await prisma.printer.deleteMany({
        where: { id, tenantId: req.user!.tenantId! }
    });
    if (result.count === 0) throw new ValidationError('Printer not found');

    // Audit log - after successful deletion
    if (printer) {
        auditService.log(
            'PRINTER_DELETED' as any,
            'Printer',
            id,
            {
                userId: req.user!.id!,
                tenantId: req.user!.tenantId!,
                ipAddress: String(req.ip),
                userAgent: req.headers['user-agent'] ?? 'unknown'
            },
            { printerName: printer.name, connectionType: printer.connectionType }
        );
    }

    sendSuccess(res, { message: 'Printer deleted' });
});
