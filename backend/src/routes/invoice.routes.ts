import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as invoiceController from '../controllers/invoice.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /invoices
 * Get all invoices with optional filters (type, startDate, endDate)
 */
router.get('/', invoiceController.getAll);

/**
 * POST /invoices
 * Generate invoice for an order
 */
router.post('/', invoiceController.generateInvoice);

/**
 * GET /invoices/order/:orderId
 * Get invoice by order ID
 */
router.get('/order/:orderId', invoiceController.getByOrderId);

/**
 * GET /invoices/:invoiceNumber
 * Get invoice by invoice number
 */
router.get('/:invoiceNumber', invoiceController.getByInvoiceNumber);

export default router;
