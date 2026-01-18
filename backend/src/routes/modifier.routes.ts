import { Router } from 'express';
import { authenticateToken, authorize } from '../middleware/auth';
import * as modifierController from '../controllers/modifier.controller';

const router = Router();

// Groups
router.get('/groups', authenticateToken, modifierController.getGroups);
router.get('/groups/:id', authenticateToken, modifierController.getGroup);
router.post('/groups', authenticateToken, authorize(['ADMIN', 'MANAGER']), modifierController.createGroup);
router.put('/groups/:id', authenticateToken, authorize(['ADMIN', 'MANAGER']), modifierController.updateGroup);
router.delete('/groups/:id', authenticateToken, authorize(['ADMIN', 'MANAGER']), modifierController.deleteGroup);

// Options
router.post('/groups/:groupId/options', authenticateToken, authorize(['ADMIN', 'MANAGER']), modifierController.addOption);
router.put('/options/:optionId', authenticateToken, authorize(['ADMIN', 'MANAGER']), modifierController.updateOption);
router.delete('/options/:optionId', authenticateToken, authorize(['ADMIN', 'MANAGER']), modifierController.deleteOption);

export default router;
