"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAll = exports.getByInvoiceNumber = exports.getByOrderId = exports.generateInvoice = void 0;
const zod_1 = require("zod");
const asyncHandler_1 = require("../middleware/asyncHandler");
const invoiceService = __importStar(require("../services/invoice.service"));
const generateInvoiceSchema = zod_1.z.object({
    orderId: zod_1.z.number().int().positive(),
    type: zod_1.z.enum(['RECEIPT', 'INVOICE_B']).optional(),
    clientName: zod_1.z.string().optional(),
    clientTaxId: zod_1.z.string().optional()
});
/**
 * Generate invoice for an order
 * POST /invoices
 */
exports.generateInvoice = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
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
exports.getByOrderId = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const orderId = parseInt(req.params.orderId);
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
exports.getByInvoiceNumber = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const invoiceNumber = req.params.invoiceNumber;
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
exports.getAll = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { type, startDate, endDate } = req.query;
    const filters = {};
    if (type && (type === 'RECEIPT' || type === 'INVOICE_B')) {
        filters.type = type;
    }
    if (startDate) {
        filters.startDate = new Date(startDate);
    }
    if (endDate) {
        filters.endDate = new Date(endDate);
    }
    const invoices = await invoiceService.getAll(filters);
    res.json({
        success: true,
        data: invoices
    });
});
//# sourceMappingURL=invoice.controller.js.map