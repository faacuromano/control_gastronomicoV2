"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const rateLimit_1 = require("../middleware/rateLimit");
const router = (0, express_1.Router)();
// Apply rate limiting to login endpoints (protecting against brute force)
router.post('/login/pin', rateLimit_1.authRateLimiter, auth_controller_1.loginPin);
router.post('/login', rateLimit_1.authRateLimiter, auth_controller_1.loginUser);
router.post('/register', rateLimit_1.authRateLimiter, auth_controller_1.registerUser);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map