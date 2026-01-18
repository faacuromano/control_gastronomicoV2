"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tableRouter = void 0;
const express_1 = require("express");
const table_controller_1 = require("../controllers/table.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// /api/v1/areas
router.get('/areas', auth_1.authenticateToken, table_controller_1.TableController.getAreas);
router.post('/areas', auth_1.authenticateToken, (0, auth_1.authorize)(['ADMIN']), table_controller_1.TableController.createArea);
router.put('/areas/:id', auth_1.authenticateToken, (0, auth_1.authorize)(['ADMIN']), table_controller_1.TableController.updateArea);
router.delete('/areas/:id', auth_1.authenticateToken, (0, auth_1.authorize)(['ADMIN']), table_controller_1.TableController.deleteArea);
// Routes for TABLES
// /api/v1/tables
router.put('/tables/positions', auth_1.authenticateToken, (0, auth_1.authorize)(['ADMIN']), table_controller_1.TableController.updatePositions);
router.post('/tables', auth_1.authenticateToken, (0, auth_1.authorize)(['ADMIN']), table_controller_1.TableController.createTable);
router.get('/tables/:id', auth_1.authenticateToken, table_controller_1.TableController.getTable);
router.put('/tables/:id', auth_1.authenticateToken, (0, auth_1.authorize)(['ADMIN']), table_controller_1.TableController.updateTable);
router.put('/tables/:id/position', auth_1.authenticateToken, (0, auth_1.authorize)(['ADMIN']), table_controller_1.TableController.updatePosition);
router.delete('/tables/:id', auth_1.authenticateToken, (0, auth_1.authorize)(['ADMIN']), table_controller_1.TableController.deleteTable);
// Table Operations (Waiter)
router.post('/tables/:id/open', auth_1.authenticateToken, table_controller_1.TableController.openTable);
router.post('/tables/:id/close', auth_1.authenticateToken, table_controller_1.TableController.closeTable);
exports.tableRouter = router;
//# sourceMappingURL=table.routes.js.map