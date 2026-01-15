"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableController = void 0;
const table_service_1 = require("../services/table.service");
class TableController {
    // Areas
    static async getAreas(req, res, next) {
        try {
            const areas = await table_service_1.tableService.getAreas();
            res.json({ success: true, data: areas });
        }
        catch (error) {
            next(error);
        }
    }
    static async createArea(req, res, next) {
        try {
            const area = await table_service_1.tableService.createArea(req.body);
            res.status(201).json({ success: true, data: area });
        }
        catch (error) {
            next(error);
        }
    }
    static async deleteArea(req, res, next) {
        try {
            const id = Number(req.params.id);
            await table_service_1.tableService.deleteArea(id);
            res.json({ success: true, message: 'Area deleted' });
        }
        catch (error) {
            next(error);
        }
    }
    // Tables
    static async createTable(req, res, next) {
        try {
            const table = await table_service_1.tableService.createTable(req.body);
            res.status(201).json({ success: true, data: table });
        }
        catch (error) {
            next(error);
        }
    }
    static async updatePosition(req, res, next) {
        try {
            const id = Number(req.params.id);
            const { x, y } = req.body;
            const table = await table_service_1.tableService.updateTablePosition(id, x, y);
            res.json({ success: true, data: table });
        }
        catch (error) {
            next(error);
        }
    }
    static async getTable(req, res, next) {
        try {
            const id = Number(req.params.id);
            const table = await table_service_1.tableService.getTable(id);
            res.json({ success: true, data: table });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.TableController = TableController;
//# sourceMappingURL=table.controller.js.map