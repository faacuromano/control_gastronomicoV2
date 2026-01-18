import { Router } from 'express';
import * as PurchaseOrderController from '../controllers/purchaseOrder.controller';

const router = Router();

router.get('/purchase-orders', PurchaseOrderController.getPurchaseOrders);
router.get('/purchase-orders/:id', PurchaseOrderController.getPurchaseOrderById);
router.post('/purchase-orders', PurchaseOrderController.createPurchaseOrder);
router.patch('/purchase-orders/:id/status', PurchaseOrderController.updatePurchaseOrderStatus);
router.post('/purchase-orders/:id/receive', PurchaseOrderController.receivePurchaseOrder);
router.post('/purchase-orders/:id/cancel', PurchaseOrderController.cancelPurchaseOrder);
router.delete('/purchase-orders/:id', PurchaseOrderController.deletePurchaseOrder);

export default router;
