import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as printerController from '../controllers/printer.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Printer CRUD
router.get('/printers', printerController.getPrinters);
router.get('/printers/system', printerController.getSystemPrinters); // Get Windows printers
router.post('/printers', printerController.createPrinter);
router.put('/printers/:id', printerController.updatePrinter);
router.delete('/printers/:id', printerController.deletePrinter);

// Printing operations
router.get('/:id', printerController.printTicket);  // Generate buffer
router.post('/:orderId/device/:printerId', printerController.printToDevice);  // Print to device
router.post('/test/:printerId', printerController.printTestPage);  // Test print

export default router;
