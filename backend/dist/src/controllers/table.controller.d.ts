import { Request, Response, NextFunction } from 'express';
export declare class TableController {
    static getAreas(req: Request, res: Response, next: NextFunction): Promise<void>;
    static createArea(req: Request, res: Response, next: NextFunction): Promise<void>;
    static deleteArea(req: Request, res: Response, next: NextFunction): Promise<void>;
    static createTable(req: Request, res: Response, next: NextFunction): Promise<void>;
    static updatePosition(req: Request, res: Response, next: NextFunction): Promise<void>;
    static getTable(req: Request, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=table.controller.d.ts.map