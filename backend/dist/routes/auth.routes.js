"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const router = (0, express_1.Router)();
router.post('/login/pin', auth_controller_1.loginPin);
router.post('/login', auth_controller_1.loginUser);
router.post('/register', auth_controller_1.registerUser);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map