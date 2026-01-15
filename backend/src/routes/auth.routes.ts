import { Router } from 'express';
import { loginPin, loginUser, registerUser } from '../controllers/auth.controller';
import { authRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Apply rate limiting to login endpoints (protecting against brute force)
router.post('/login/pin', authRateLimiter, loginPin);
router.post('/login', authRateLimiter, loginUser);
router.post('/register', authRateLimiter, registerUser);

export default router;

