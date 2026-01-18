import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as loyaltyController from '../controllers/loyalty.controller';

const router = Router();

router.use(authenticate);

// Config
router.get('/config', loyaltyController.getConfig);

// Balance
router.get('/:id', loyaltyController.getBalance);

// Redeem points
router.post('/:id/redeem', loyaltyController.redeemPoints);

// Wallet operations
router.post('/:id/wallet/add', loyaltyController.addWalletFunds);
router.post('/:id/wallet/use', loyaltyController.useWalletFunds);

export default router;
