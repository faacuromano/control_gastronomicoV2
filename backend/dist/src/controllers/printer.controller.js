"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePrinter = exports.updatePrinter = exports.createPrinter = exports.getSystemPrinters = exports.getPrinters = exports.printTestPage = exports.printPreAccount = exports.printToDevice = exports.printTicket = void 0;
const printer_service_1 = require("../services/printer.service");
const response_1 = require("../utils/response");
const asyncHandler_1 = require("../middleware/asyncHandler");
const prisma_1 = require("../lib/prisma");
const errors_1 = require("../utils/errors");
const printerService = new printer_service_1.PrinterService();
/**
 * Generate ticket buffer (for local/browser printing)
 * GET /print/:id
 */
exports.printTicket = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const orderId = parseInt(req.params.id);
    const buffer = await printerService.generateOrderTicket(orderId);
    (0, response_1.sendSuccess)(res, {
        message: 'Ticket generated',
        base64: buffer.toString('base64')
    });
});
/**
 * Print order to a specific thermal printer device
 * POST /print/:orderId/device/:printerId
 */
exports.printToDevice = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const printerId = parseInt(req.params.printerId);
    await printerService.printOrderToDevice(orderId, printerId);
    (0, response_1.sendSuccess)(res, {
        message: 'Ticket sent to printer successfully'
    });
});
/**
 * Print pre-account (cuenta) to a thermal printer
 * This prints the order WITHOUT payment info - for customer before paying
 * POST /print/:orderId/preaccount/:printerId
 */
exports.printPreAccount = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const printerId = parseInt(req.params.printerId);
    // Use same print method - it already only shows payments if they exist
    // The pre-account is just printing an order before payment is made
    await printerService.printOrderToDevice(orderId, printerId);
    (0, response_1.sendSuccess)(res, {
        message: 'Pre-cuenta enviada a impresora exitosamente'
    });
});
/**
 * Print test page to verify printer connection
 * POST /print/test/:printerId
 */
exports.printTestPage = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const printerId = parseInt(req.params.printerId);
    await printerService.printTestPage(printerId);
    (0, response_1.sendSuccess)(res, {
        message: 'Test page printed successfully'
    });
});
/**
 * Get all configured printers
 * GET /print/printers
 */
exports.getPrinters = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const printers = await prisma_1.prisma.printer.findMany({
        include: { categories: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' }
    });
    (0, response_1.sendSuccess)(res, printers);
});
/**
 * Get available Windows system printers
 * GET /print/printers/system
 */
exports.getSystemPrinters = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const printers = await printerService.listSystemPrinters();
    (0, response_1.sendSuccess)(res, printers);
});
/**
 * Create a new printer
 * POST /print/printers
 */
exports.createPrinter = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { name, connectionType, ipAddress, windowsName } = req.body;
    // Validate based on connection type
    if (connectionType === 'USB') {
        if (!windowsName) {
            throw new errors_1.ValidationError('Windows printer name is required for USB printers');
        }
    }
    else if (connectionType === 'NETWORK' || !connectionType) {
        if (!ipAddress) {
            throw new errors_1.ValidationError('IP address is required for network printers');
        }
    }
    const printer = await prisma_1.prisma.printer.create({
        data: {
            name,
            connectionType: connectionType || 'NETWORK',
            ipAddress: connectionType === 'USB' ? null : ipAddress,
            windowsName: connectionType === 'USB' ? windowsName : null
        }
    });
    (0, response_1.sendSuccess)(res, printer, undefined, 201);
});
/**
 * Update printer
 * PUT /print/printers/:id
 */
exports.updatePrinter = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    const { name, connectionType, ipAddress, windowsName } = req.body;
    // Build update data
    const updateData = {};
    if (name !== undefined)
        updateData.name = name;
    if (connectionType !== undefined)
        updateData.connectionType = connectionType;
    if (connectionType === 'USB') {
        updateData.ipAddress = null;
        updateData.windowsName = windowsName;
    }
    else if (connectionType === 'NETWORK') {
        updateData.ipAddress = ipAddress;
        updateData.windowsName = null;
    }
    else {
        // Partial update - only update fields that were provided
        if (ipAddress !== undefined)
            updateData.ipAddress = ipAddress;
        if (windowsName !== undefined)
            updateData.windowsName = windowsName;
    }
    const printer = await prisma_1.prisma.printer.update({
        where: { id },
        data: updateData
    });
    (0, response_1.sendSuccess)(res, printer);
});
/**
 * Delete printer
 * DELETE /print/printers/:id
 */
exports.deletePrinter = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = parseInt(req.params.id);
    await prisma_1.prisma.printer.delete({ where: { id } });
    (0, response_1.sendSuccess)(res, { message: 'Printer deleted' });
});
//# sourceMappingURL=printer.controller.js.map