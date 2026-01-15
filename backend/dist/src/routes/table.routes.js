"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tableRouter = void 0;
const express_1 = require("express");
const table_controller_1 = require("../controllers/table.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Routes for AREAS
// /api/v1/areas
router.get('/areas', auth_1.authenticateToken, table_controller_1.TableController.getAreas);
router.post('/areas', auth_1.authenticateToken, (0, auth_1.authorize)(['ADMIN']), table_controller_1.TableController.createArea);
router.delete('/areas/:id', auth_1.authenticateToken, (0, auth_1.authorize)(['ADMIN']), table_controller_1.TableController.deleteArea);
// Routes for TABLES
// /api/v1/tables
router.post('/tables', auth_1.authenticateToken, (0, auth_1.authorize)(['ADMIN']), table_controller_1.TableController.createTable);
router.get('/tables/:id', auth_1.authenticateToken, table_controller_1.TableController.getTable);
router.put('/tables/:id/position', auth_1.authenticateToken, (0, auth_1.authorize)(['ADMIN']), table_controller_1.TableController.updatePosition);
// Note: Open/Close table logic currently handled via Order creation integration
// But we might want explicit table actions later if needed.
exports.tableRouter = router;
//# sourceMappingURL=table.routes.js.map