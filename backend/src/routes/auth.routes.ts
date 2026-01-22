import { Router } from 'express';
import { loginPin, loginUser, registerUser, logoutUser } from '../controllers/auth.controller';
import { authRateLimiter } from '../middleware/rateLimit';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply rate limiting to login endpoints (protecting against brute force)
router.post('/login/pin', authRateLimiter, loginPin);
router.post('/login', authRateLimiter, loginUser);
router.post('/register', authRateLimiter, registerUser);

// FIX P0-004: Logout endpoint to clear HttpOnly cookie
router.post('/logout', authenticateToken, logoutUser);

export default router;


