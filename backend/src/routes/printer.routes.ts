import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validateId } from '../middleware/validateId';
import * as printerController from '../controllers/printer.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Printer CRUD
router.get('/printers', printerController.getPrinters);
router.get('/printers/system', printerController.getSystemPrinters); // Get Windows printers
router.post('/printers', printerController.createPrinter);
router.put('/printers/:id', validateId(), printerController.updatePrinter);
router.delete('/printers/:id', validateId(), printerController.deletePrinter);

// Printing operations
router.get('/:id', validateId(), printerController.printTicket);  // Generate buffer
router.post('/:orderId/device/:printerId', validateId('orderId', 'printerId'), printerController.printToDevice);  // Print to device
router.post('/:orderId/preaccount/:printerId', validateId('orderId', 'printerId'), printerController.printPreAccount);  // Print pre-account (cuenta)
router.post('/test/:printerId', validateId('printerId'), printerController.printTestPage);  // Test print

export default router;
