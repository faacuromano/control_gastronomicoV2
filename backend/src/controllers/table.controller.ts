import { Request, Response } from 'express';
import { z } from 'zod';
import { tableService } from '../services/table.service';
import { UnauthorizedError, ValidationError } from '../utils/errors';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../utils/response';

// FIX IP-001: Validate tableId parameter
const tableIdSchema = z.coerce.number().int().positive();

export class TableController {
    
    // Areas
    static getAreas = asyncHandler(async (req: Request, res: Response) => {
        const areas = await tableService.getAreas(req.user!.tenantId!);
        sendSuccess(res, areas);
    });

    static createArea = asyncHandler(async (req: Request, res: Response) => {
        const area = await tableService.createArea(req.user!.tenantId!, req.body);
        sendSuccess(res, area, undefined, 201);
    });

    static updateArea = asyncHandler(async (req: Request, res: Response) => {
        const id = Number(req.params.id as string);
        const area = await tableService.updateArea(id, req.user!.tenantId!, req.body);
        sendSuccess(res, area);
    });

    static deleteArea = asyncHandler(async (req: Request, res: Response) => {
        const id = Number(req.params.id as string);
        await tableService.deleteArea(id, req.user!.tenantId!);
        sendSuccess(res, { message: 'Area deleted' });
    });

    // Tables
    static createTable = asyncHandler(async (req: Request, res: Response) => {
        const table = await tableService.createTable(req.user!.tenantId!, req.body);
        sendSuccess(res, table, undefined, 201);
    });

    static updateTable = asyncHandler(async (req: Request, res: Response) => {
        const id = tableIdSchema.parse(req.params.id);
        const table = await tableService.updateTable(id, req.user!.tenantId!, req.body);
        sendSuccess(res, table);
    });

    static updatePosition = asyncHandler(async (req: Request, res: Response) => {
        const id = tableIdSchema.parse(req.params.id);
        const { x, y } = req.body;
        const table = await tableService.updateTablePosition(id, req.user!.tenantId!, x, y);
        sendSuccess(res, table);
    });

    static updatePositions = asyncHandler(async (req: Request, res: Response) => {
        const { updates } = req.body; // Expects array of {id, x, y}
        if (!Array.isArray(updates)) {
            throw new ValidationError('Updates must be an array');
        }
        const result = await tableService.updatePositions(req.user!.tenantId!, updates);
        sendSuccess(res, result);
    });

    static deleteTable = asyncHandler(async (req: Request, res: Response) => {
        const id = tableIdSchema.parse(req.params.id);
        await tableService.deleteTable(id, req.user!.tenantId!);
        sendSuccess(res, { message: 'Table deleted' });
    });

    static getTable = asyncHandler(async (req: Request, res: Response) => {
        const id = tableIdSchema.parse(req.params.id);
        const table = await tableService.getTable(id, req.user!.tenantId!);
        sendSuccess(res, table);
    });

    // Operations
    static openTable = asyncHandler(async (req: Request, res: Response) => {
        const serverId = req.user?.id;
        if (!serverId) {
            throw new UnauthorizedError('Not authenticated');
        }
        const tableId = tableIdSchema.parse(req.params.id);
        const pax = req.body?.pax ?? 1;

        const order = await tableService.openTableWithOrder(tableId, serverId, pax, req.user!.tenantId!);
        sendSuccess(res, order, undefined, 201);
    });

    static closeTable = asyncHandler(async (req: Request, res: Response) => {
        const serverId = req.user?.id;
        if (!serverId) {
            throw new UnauthorizedError('Not authenticated');
        }
        const tableId = tableIdSchema.parse(req.params.id);
        const payments = req.body?.payments;

        const result = await tableService.closeTableWithPayment(tableId, serverId, payments, req.user!.tenantId!);
        sendSuccess(res, result);
    });
}
