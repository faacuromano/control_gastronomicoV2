
import { Router } from 'express';
import { openShift, closeShift, closeShiftWithCount, getShiftReport, getCurrentShift } from '../controllers/cashShift.controller';
import { authenticateToken as authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.post('/open', openShift);
router.post('/close', closeShift); // Legacy
router.post('/close-with-count', closeShiftWithCount); // Arqueo ciego
router.get('/current', getCurrentShift);
router.get('/:id/report', getShiftReport);

export default router;
