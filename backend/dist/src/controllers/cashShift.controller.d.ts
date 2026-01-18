import { Request, Response } from 'express';
export declare const openShift: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const closeShiftWithCount: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getShiftReport: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getCurrentShift: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const closeShift: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get all shifts with optional filters (for Dashboard analytics)
 */
export declare const getAllShifts: (req: Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=cashShift.controller.d.ts.map