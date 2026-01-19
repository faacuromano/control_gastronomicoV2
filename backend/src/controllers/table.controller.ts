import { Request, Response } from 'express';
import { z } from 'zod';
import { tableService } from '../services/table.service';
import { UnauthorizedError, ValidationError } from '../utils/errors';
import { asyncHandler } from '../middleware/asyncHandler';

// FIX IP-001: Validate tableId parameter
const tableIdSchema = z.coerce.number().int().positive();

export class TableController {
    
    // Areas
    static getAreas = asyncHandler(async (req: Request, res: Response) => {
        const areas = await tableService.getAreas();
        res.json({ success: true, data: areas });
    });

    static createArea = asyncHandler(async (req: Request, res: Response) => {
        const area = await tableService.createArea(req.body);
        res.status(201).json({ success: true, data: area });
    });

    static updateArea = asyncHandler(async (req: Request, res: Response) => {
        const id = Number(req.params.id as string);
        const area = await tableService.updateArea(id, req.body);
        res.json({ success: true, data: area });
    });

    static deleteArea = asyncHandler(async (req: Request, res: Response) => {
        const id = Number(req.params.id as string);
        await tableService.deleteArea(id);
        res.json({ success: true, message: 'Area deleted' });
    });

    // Tables
    static createTable = asyncHandler(async (req: Request, res: Response) => {
        const table = await tableService.createTable(req.body);
        res.status(201).json({ success: true, data: table });
    });

    static updateTable = asyncHandler(async (req: Request, res: Response) => {
        const id = tableIdSchema.parse(req.params.id);
        const table = await tableService.updateTable(id, req.body);
        res.json({ success: true, data: table });
    });

    static updatePosition = asyncHandler(async (req: Request, res: Response) => {
        const id = tableIdSchema.parse(req.params.id);
        const { x, y } = req.body;
        const table = await tableService.updateTablePosition(id, x, y);
        res.json({ success: true, data: table });
    });

    static updatePositions = asyncHandler(async (req: Request, res: Response) => {
        const { updates } = req.body; // Expects array of {id, x, y}
        if (!Array.isArray(updates)) {
            throw new ValidationError('Updates must be an array');
        }
        const result = await tableService.updatePositions(updates);
        res.json({ success: true, data: result });
    });

    static deleteTable = asyncHandler(async (req: Request, res: Response) => {
        const id = tableIdSchema.parse(req.params.id);
        await tableService.deleteTable(id);
        res.json({ success: true, message: 'Table deleted' });
    });

    static getTable = asyncHandler(async (req: Request, res: Response) => {
        const id = tableIdSchema.parse(req.params.id);
        const table = await tableService.getTable(id);
        res.json({ success: true, data: table });
    });

    // Operations
    static openTable = asyncHandler(async (req: Request, res: Response) => {
        const serverId = req.user?.id;
        if (!serverId) {
            throw new UnauthorizedError('Not authenticated');
        }
        const tableId = tableIdSchema.parse(req.params.id);
        const { pax } = req.body;
        
        const order = await tableService.openTableWithOrder(tableId, serverId, pax || 1);
        res.status(201).json({ success: true, data: order });
    });

    static closeTable = asyncHandler(async (req: Request, res: Response) => {
        const serverId = req.user?.id;
        if (!serverId) {
            throw new UnauthorizedError('Not authenticated');
        }
        const tableId = tableIdSchema.parse(req.params.id);
        const { payments } = req.body;
        
        const result = await tableService.closeTableWithPayment(tableId, serverId, payments);
        res.json({ success: true, data: result });
    });
}
