import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import * as AuditController from '../controllers/audit.controller';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('audit', 'read'), AuditController.getAuditLogs);

export default router;
