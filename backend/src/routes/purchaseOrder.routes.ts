import { Router } from 'express';
import { validateId } from '../middleware/validateId';
import * as PurchaseOrderController from '../controllers/purchaseOrder.controller';

const router = Router();

router.get('/purchase-orders', PurchaseOrderController.getPurchaseOrders);
router.get('/purchase-orders/:id', validateId(), PurchaseOrderController.getPurchaseOrderById);
router.post('/purchase-orders', PurchaseOrderController.createPurchaseOrder);
router.patch('/purchase-orders/:id/status', validateId(), PurchaseOrderController.updatePurchaseOrderStatus);
router.post('/purchase-orders/:id/receive', validateId(), PurchaseOrderController.receivePurchaseOrder);
router.post('/purchase-orders/:id/cancel', validateId(), PurchaseOrderController.cancelPurchaseOrder);
router.delete('/purchase-orders/:id', validateId(), PurchaseOrderController.deletePurchaseOrder);

export default router;
