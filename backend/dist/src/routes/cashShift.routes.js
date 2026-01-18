"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cashShift_controller_1 = require("../controllers/cashShift.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
// List all shifts (with optional filters)
router.get('/', cashShift_controller_1.getAllShifts);
router.post('/open', cashShift_controller_1.openShift);
router.post('/close', cashShift_controller_1.closeShift); // Legacy
router.post('/close-with-count', cashShift_controller_1.closeShiftWithCount); // Arqueo ciego
router.get('/current', cashShift_controller_1.getCurrentShift);
router.get('/:id/report', cashShift_controller_1.getShiftReport);
exports.default = router;
//# sourceMappingURL=cashShift.routes.js.map