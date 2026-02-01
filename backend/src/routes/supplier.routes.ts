import { Router } from 'express';
import { validateId } from '../middleware/validateId';
import * as SupplierController from '../controllers/supplier.controller';

const router = Router();

router.get('/suppliers', SupplierController.getSuppliers);
router.get('/suppliers/:id', validateId(), SupplierController.getSupplierById);
router.post('/suppliers', SupplierController.createSupplier);
router.put('/suppliers/:id', validateId(), SupplierController.updateSupplier);
router.delete('/suppliers/:id', validateId(), SupplierController.deleteSupplier);

export default router;
