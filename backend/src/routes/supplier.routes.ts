import { Router } from 'express';
import * as SupplierController from '../controllers/supplier.controller';

const router = Router();

router.get('/suppliers', SupplierController.getSuppliers);
router.get('/suppliers/:id', SupplierController.getSupplierById);
router.post('/suppliers', SupplierController.createSupplier);
router.put('/suppliers/:id', SupplierController.updateSupplier);
router.delete('/suppliers/:id', SupplierController.deleteSupplier);

export default router;
