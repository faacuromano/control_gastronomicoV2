import { Request, Response, NextFunction } from 'express';
import { tableService } from '../services/table.service';

export class TableController {
    
    // Areas
    static async getAreas(req: Request, res: Response, next: NextFunction) {
        try {
            const areas = await tableService.getAreas();
            res.json({ success: true, data: areas });
        } catch (error) {
            next(error);
        }
    }

    static async createArea(req: Request, res: Response, next: NextFunction) {
        try {
            const area = await tableService.createArea(req.body);
            res.status(201).json({ success: true, data: area });
        } catch (error) {
            next(error);
        }
    }

    static async updateArea(req: Request, res: Response, next: NextFunction) {
        try {
            const id = Number(req.params.id);
            const area = await tableService.updateArea(id, req.body);
            res.json({ success: true, data: area });
        } catch (error) {
            next(error);
        }
    }

    static async deleteArea(req: Request, res: Response, next: NextFunction) {
        try {
            const id = Number(req.params.id);
            await tableService.deleteArea(id);
            res.json({ success: true, message: 'Area deleted' });
        } catch (error) {
            next(error);
        }
    }

    // Tables
    static async createTable(req: Request, res: Response, next: NextFunction) {
        try {
            const table = await tableService.createTable(req.body);
            res.status(201).json({ success: true, data: table });
        } catch (error) {
            next(error);
        }
    }

    static async updateTable(req: Request, res: Response, next: NextFunction) {
        try {
            const id = Number(req.params.id);
            const table = await tableService.updateTable(id, req.body);
            res.json({ success: true, data: table });
        } catch (error) {
            next(error);
        }
    }

    static async updatePosition(req: Request, res: Response, next: NextFunction) {
        try {
            const id = Number(req.params.id);
            const { x, y } = req.body;
            const table = await tableService.updateTablePosition(id, x, y);
            res.json({ success: true, data: table });
        } catch (error) {
            next(error);
        }
    }

    static async updatePositions(req: Request, res: Response, next: NextFunction) {
        try {
            const { updates } = req.body; // Expects array of {id, x, y}
            if (!Array.isArray(updates)) {
                throw new Error('Updates must be an array');
            }
            const result = await tableService.updatePositions(updates);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    static async deleteTable(req: Request, res: Response, next: NextFunction) {
        try {
            const id = Number(req.params.id);
            await tableService.deleteTable(id);
            res.json({ success: true, message: 'Table deleted' });
        } catch (error) {
            next(error);
        }
    }

    static async getTable(req: Request, res: Response, next: NextFunction) {
        try {
            const id = Number(req.params.id);
            const table = await tableService.getTable(id);
            res.json({ success: true, data: table });
        } catch (error) {
            next(error);
        }
    }

    // Operations
    static async openTable(req: Request, res: Response, next: NextFunction) {
        try {
            const tableId = Number(req.params.id);
            const { pax } = req.body;
            const serverId = (req as any).user.id;
            
            const order = await tableService.openTableWithOrder(tableId, serverId, pax || 1);
            res.status(201).json({ success: true, data: order });
        } catch (error) {
            next(error);
        }
    }

    static async closeTable(req: Request, res: Response, next: NextFunction) {
        try {
            const tableId = Number(req.params.id);
            const { payments } = req.body;
            const serverId = (req as any).user.id;
            
            const result = await tableService.closeTableWithPayment(tableId, serverId, payments);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
}
