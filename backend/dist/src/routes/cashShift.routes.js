"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cashShift_controller_1 = require("../controllers/cashShift.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.post('/open', cashShift_controller_1.openShift);
router.post('/close', cashShift_controller_1.closeShift);
router.get('/current', cashShift_controller_1.getCurrentShift);
exports.default = router;
//# sourceMappingURL=cashShift.routes.js.map