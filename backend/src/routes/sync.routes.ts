/**
 * @fileoverview Sync Routes for offline synchronization
 * @module routes/sync.routes
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as syncController from '../controllers/sync.controller';

const router = Router();

// All sync routes require authentication
router.use(authenticate);

// GET /api/v1/sync/pull - Get data for offline cache
router.get('/pull', syncController.pull);

// POST /api/v1/sync/push - Push offline operations
router.post('/push', syncController.push);

// GET /api/v1/sync/status - Check server status
router.get('/status', syncController.status);

export default router;
