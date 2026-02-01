import { Router } from 'express';
import { authenticateToken, authorize } from '../middleware/auth';
import { validateId } from '../middleware/validateId';
import * as modifierController from '../controllers/modifier.controller';

const router = Router();

// Groups
router.get('/groups', authenticateToken, modifierController.getGroups);
router.get('/groups/:id', authenticateToken, validateId(), modifierController.getGroup);
router.post('/groups', authenticateToken, authorize(['ADMIN', 'MANAGER']), modifierController.createGroup);
router.put('/groups/:id', authenticateToken, validateId(), authorize(['ADMIN', 'MANAGER']), modifierController.updateGroup);
router.delete('/groups/:id', authenticateToken, validateId(), authorize(['ADMIN', 'MANAGER']), modifierController.deleteGroup);

// Options
router.post('/groups/:groupId/options', authenticateToken, validateId('groupId'), authorize(['ADMIN', 'MANAGER']), modifierController.addOption);
router.put('/options/:optionId', authenticateToken, validateId('optionId'), authorize(['ADMIN', 'MANAGER']), modifierController.updateOption);
router.delete('/options/:optionId', authenticateToken, validateId('optionId'), authorize(['ADMIN', 'MANAGER']), modifierController.deleteOption);

export default router;
