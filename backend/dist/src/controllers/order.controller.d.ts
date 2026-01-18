/**
 * @fileoverview Order controller.
 * Handles HTTP requests for order operations.
 *
 * @module controllers/order.controller
 */
import { Request, Response } from 'express';
/**
 * Update order status.
 */
export declare const updateStatus: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Update individual order item status.
 */
export declare const updateItemStatus: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get active orders for KDS.
 */
export declare const getActiveOrders: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Create a new order.
 */
export declare const createOrder: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get recent orders.
 */
export declare const getOrders: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get order by table ID.
 */
export declare const getOrderByTable: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Add items to an existing order.
 */
export declare const addItemsToOrder: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get active delivery orders.
 */
export declare const getDeliveryOrders: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Assign driver to order.
 */
export declare const assignDriver: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Mark all items in an order as SERVED.
 * Used by kitchen when table order is ready for pickup by waiter.
 */
export declare const markAllItemsServed: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Void (cancel) an order item.
 * Requires orders:delete permission (manager action).
 */
export declare const voidItem: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get available void reasons for UI dropdown.
 */
export declare const getVoidReasons: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Transfer items between tables.
 */
export declare const transferItems: (req: Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=order.controller.d.ts.map