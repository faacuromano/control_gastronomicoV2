/**
 * @fileoverview Delivery Controller
 * Handles HTTP requests for delivery platforms and drivers
 */
import { Request, Response } from 'express';
export declare const getAllPlatforms: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getPlatformById: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const createPlatform: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const updatePlatform: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const togglePlatform: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const deletePlatform: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getAllDrivers: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getAvailableDrivers: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getDriverById: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const createDriver: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const updateDriver: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const toggleDriverAvailability: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const toggleDriverActive: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const assignDriverToOrder: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const releaseDriver: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const deleteDriver: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getDeliveryOrders: (req: Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=delivery.controller.d.ts.map