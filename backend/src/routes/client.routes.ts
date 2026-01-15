import { Router } from 'express';
import { searchClients, createClient } from '../controllers/client.controller';

const router = Router();

router.get('/search', searchClients);
router.post('/', createClient);

export default router;
