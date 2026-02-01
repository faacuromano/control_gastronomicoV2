import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validateId } from '../middleware/validateId';
import * as loyaltyController from '../controllers/loyalty.controller';

const router = Router();

router.use(authenticate);

// Config
router.get('/config', loyaltyController.getConfig);

// Balance
router.get('/:id', validateId(), loyaltyController.getBalance);

// Redeem points
router.post('/:id/redeem', validateId(), loyaltyController.redeemPoints);

// Wallet operations
router.post('/:id/wallet/add', validateId(), loyaltyController.addWalletFunds);
router.post('/:id/wallet/use', validateId(), loyaltyController.useWalletFunds);

export default router;
