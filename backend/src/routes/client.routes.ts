import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { searchClients, createClient } from '../controllers/client.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/search', searchClients);
router.post('/', createClient);

export default router;
