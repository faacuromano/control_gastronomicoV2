"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableController = void 0;
const table_service_1 = require("../services/table.service");
const errors_1 = require("../utils/errors");
const asyncHandler_1 = require("../middleware/asyncHandler");
class TableController {
    // Areas
    static getAreas = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const areas = await table_service_1.tableService.getAreas();
        res.json({ success: true, data: areas });
    });
    static createArea = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const area = await table_service_1.tableService.createArea(req.body);
        res.status(201).json({ success: true, data: area });
    });
    static updateArea = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const id = Number(req.params.id);
        const area = await table_service_1.tableService.updateArea(id, req.body);
        res.json({ success: true, data: area });
    });
    static deleteArea = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const id = Number(req.params.id);
        await table_service_1.tableService.deleteArea(id);
        res.json({ success: true, message: 'Area deleted' });
    });
    // Tables
    static createTable = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const table = await table_service_1.tableService.createTable(req.body);
        res.status(201).json({ success: true, data: table });
    });
    static updateTable = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const id = Number(req.params.id);
        const table = await table_service_1.tableService.updateTable(id, req.body);
        res.json({ success: true, data: table });
    });
    static updatePosition = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const id = Number(req.params.id);
        const { x, y } = req.body;
        const table = await table_service_1.tableService.updateTablePosition(id, x, y);
        res.json({ success: true, data: table });
    });
    static updatePositions = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const { updates } = req.body; // Expects array of {id, x, y}
        if (!Array.isArray(updates)) {
            throw new errors_1.ValidationError('Updates must be an array');
        }
        const result = await table_service_1.tableService.updatePositions(updates);
        res.json({ success: true, data: result });
    });
    static deleteTable = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const id = Number(req.params.id);
        await table_service_1.tableService.deleteTable(id);
        res.json({ success: true, message: 'Table deleted' });
    });
    static getTable = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const id = Number(req.params.id);
        const table = await table_service_1.tableService.getTable(id);
        res.json({ success: true, data: table });
    });
    // Operations
    static openTable = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const serverId = req.user?.id;
        if (!serverId) {
            throw new errors_1.UnauthorizedError('Not authenticated');
        }
        const tableId = Number(req.params.id);
        const { pax } = req.body;
        const order = await table_service_1.tableService.openTableWithOrder(tableId, serverId, pax || 1);
        res.status(201).json({ success: true, data: order });
    });
    static closeTable = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
        const serverId = req.user?.id;
        if (!serverId) {
            throw new errors_1.UnauthorizedError('Not authenticated');
        }
        const tableId = Number(req.params.id);
        const { payments } = req.body;
        const result = await table_service_1.tableService.closeTableWithPayment(tableId, serverId, payments);
        res.json({ success: true, data: result });
    });
}
exports.TableController = TableController;
//# sourceMappingURL=table.controller.js.map