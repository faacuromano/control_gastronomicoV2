import { Router } from 'express';
import { loginPin, loginUser, registerUser, logoutUser, registerNewTenant, resolveTenant, refreshTokenHandler } from '../controllers/auth.controller';
import { authRateLimiter } from '../middleware/rateLimit';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public: Resolve tenant by business code (for login page)
router.get('/tenant/:code', authRateLimiter, resolveTenant);

// Apply rate limiting to login endpoints (protecting against brute force)
router.post('/login/pin', authRateLimiter, loginPin);
router.post('/login', authRateLimiter, loginUser);
router.post('/register', authRateLimiter, registerUser);
router.post('/signup', authRateLimiter, registerNewTenant); // Public SaaS Registration

// Token refresh (uses refresh_token cookie, no auth required)
router.post('/refresh', authRateLimiter, refreshTokenHandler);

// FIX P0-004: Logout endpoint to clear HttpOnly cookie
router.post('/logout', logoutUser);

export default router;


