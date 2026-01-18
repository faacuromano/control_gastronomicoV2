/**
 * @fileoverview Order management service (Facade).
 * Handles order creation, updates, and lifecycle management.
 *
 * @module services/order.service
 * @pattern Facade - Delegates to specialized services for better SRP
 * @see orderItem.service.ts - Item validation and calculation
 * @see orderKitchen.service.ts - KDS operations
 * @see orderDelivery.service.ts - Delivery operations
 * @see orderStatus.service.ts - Status transitions
 */
import { Prisma, OrderStatus } from '@prisma/client';
import type { OrderItemInput, DeliveryData, CreateOrderInput } from '../types/order.types';
export type { OrderItemInput, DeliveryData, CreateOrderInput };
export declare class OrderService {
    /**
     * Get order by ID with full relations
     */
    getById(id: number): Promise<({
        client: {
            name: string;
            id: number;
            email: string | null;
            createdAt: Date;
            updatedAt: Date;
            phone: string | null;
            address: string | null;
            taxId: string | null;
            points: number;
            walletBalance: Prisma.Decimal;
        } | null;
        driver: {
            name: string;
            id: number;
            email: string | null;
            pinCode: string | null;
            roleId: number;
            passwordHash: string | null;
            uiSettings: Prisma.JsonValue | null;
            isActive: boolean;
            failedLoginAttempts: number;
            lockedUntil: Date | null;
            createdAt: Date;
            updatedAt: Date;
        } | null;
        items: ({
            product: {
                name: string;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                categoryId: number;
                description: string | null;
                price: Prisma.Decimal;
                image: string | null;
                productType: import(".prisma/client").$Enums.ProductType;
                isStockable: boolean;
            };
            modifiers: ({
                modifierOption: {
                    name: string;
                    id: number;
                    isActive: boolean;
                    ingredientId: number | null;
                    modifierGroupId: number;
                    priceOverlay: Prisma.Decimal;
                    qtyUsed: Prisma.Decimal | null;
                };
            } & {
                id: number;
                priceCharged: Prisma.Decimal;
                modifierOptionId: number;
                orderItemId: number;
            })[];
        } & {
            id: number;
            quantity: number;
            productId: number;
            status: import(".prisma/client").$Enums.ItemStatus;
            orderId: number;
            unitPrice: Prisma.Decimal;
            notes: string | null;
        })[];
        payments: {
            id: number;
            createdAt: Date;
            method: import(".prisma/client").$Enums.PaymentMethod;
            tip: Prisma.Decimal;
            orderId: number;
            amount: Prisma.Decimal;
            externalRef: string | null;
            shiftId: number | null;
        }[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        orderNumber: number;
        channel: import(".prisma/client").$Enums.OrderChannel;
        externalId: string | null;
        peopleCount: number;
        status: import(".prisma/client").$Enums.OrderStatus;
        paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
        subtotal: Prisma.Decimal;
        discount: Prisma.Decimal;
        tip: Prisma.Decimal;
        total: Prisma.Decimal;
        tableId: number | null;
        clientId: number | null;
        serverId: number | null;
        driverId: number | null;
        deliveryAddress: string | null;
        deliveryNotes: string | null;
        closedAt: Date | null;
        businessDate: Date;
    }) | null>;
    /**
     * Create a new order with items and optional payments.
     */
    createOrder(data: CreateOrderInput): Promise<{
        items: {
            id: number;
            quantity: number;
            productId: number;
            status: import(".prisma/client").$Enums.ItemStatus;
            orderId: number;
            unitPrice: Prisma.Decimal;
            notes: string | null;
        }[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        orderNumber: number;
        channel: import(".prisma/client").$Enums.OrderChannel;
        externalId: string | null;
        peopleCount: number;
        status: import(".prisma/client").$Enums.OrderStatus;
        paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
        subtotal: Prisma.Decimal;
        discount: Prisma.Decimal;
        tip: Prisma.Decimal;
        total: Prisma.Decimal;
        tableId: number | null;
        clientId: number | null;
        serverId: number | null;
        driverId: number | null;
        deliveryAddress: string | null;
        deliveryNotes: string | null;
        closedAt: Date | null;
        businessDate: Date;
    }>;
    /**
     * Assign a driver to an order.
     * @delegates orderDeliveryService.assignDriver
     */
    assignDriver(orderId: number, driverId: number): Promise<{
        driver: {
            name: string;
            id: number;
            email: string | null;
            pinCode: string | null;
            roleId: number;
            passwordHash: string | null;
            uiSettings: Prisma.JsonValue | null;
            isActive: boolean;
            failedLoginAttempts: number;
            lockedUntil: Date | null;
            createdAt: Date;
            updatedAt: Date;
        } | null;
        items: ({
            product: {
                name: string;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                categoryId: number;
                description: string | null;
                price: Prisma.Decimal;
                image: string | null;
                productType: import(".prisma/client").$Enums.ProductType;
                isStockable: boolean;
            };
            modifiers: ({
                modifierOption: {
                    name: string;
                    id: number;
                    isActive: boolean;
                    ingredientId: number | null;
                    modifierGroupId: number;
                    priceOverlay: Prisma.Decimal;
                    qtyUsed: Prisma.Decimal | null;
                };
            } & {
                id: number;
                priceCharged: Prisma.Decimal;
                modifierOptionId: number;
                orderItemId: number;
            })[];
        } & {
            id: number;
            quantity: number;
            productId: number;
            status: import(".prisma/client").$Enums.ItemStatus;
            orderId: number;
            unitPrice: Prisma.Decimal;
            notes: string | null;
        })[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        orderNumber: number;
        channel: import(".prisma/client").$Enums.OrderChannel;
        externalId: string | null;
        peopleCount: number;
        status: import(".prisma/client").$Enums.OrderStatus;
        paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
        subtotal: Prisma.Decimal;
        discount: Prisma.Decimal;
        tip: Prisma.Decimal;
        total: Prisma.Decimal;
        tableId: number | null;
        clientId: number | null;
        serverId: number | null;
        driverId: number | null;
        deliveryAddress: string | null;
        deliveryNotes: string | null;
        closedAt: Date | null;
        businessDate: Date;
    }>;
    /**
     * Get active delivery orders.
     * @delegates orderDeliveryService.getDeliveryOrders
     */
    getDeliveryOrders(): Promise<({
        client: {
            name: string;
            id: number;
            email: string | null;
            createdAt: Date;
            updatedAt: Date;
            phone: string | null;
            address: string | null;
            taxId: string | null;
            points: number;
            walletBalance: Prisma.Decimal;
        } | null;
        driver: {
            name: string;
            id: number;
            email: string | null;
            pinCode: string | null;
            roleId: number;
            passwordHash: string | null;
            uiSettings: Prisma.JsonValue | null;
            isActive: boolean;
            failedLoginAttempts: number;
            lockedUntil: Date | null;
            createdAt: Date;
            updatedAt: Date;
        } | null;
        items: ({
            product: {
                name: string;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                categoryId: number;
                description: string | null;
                price: Prisma.Decimal;
                image: string | null;
                productType: import(".prisma/client").$Enums.ProductType;
                isStockable: boolean;
            };
            modifiers: ({
                modifierOption: {
                    name: string;
                    id: number;
                    isActive: boolean;
                    ingredientId: number | null;
                    modifierGroupId: number;
                    priceOverlay: Prisma.Decimal;
                    qtyUsed: Prisma.Decimal | null;
                };
            } & {
                id: number;
                priceCharged: Prisma.Decimal;
                modifierOptionId: number;
                orderItemId: number;
            })[];
        } & {
            id: number;
            quantity: number;
            productId: number;
            status: import(".prisma/client").$Enums.ItemStatus;
            orderId: number;
            unitPrice: Prisma.Decimal;
            notes: string | null;
        })[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        orderNumber: number;
        channel: import(".prisma/client").$Enums.OrderChannel;
        externalId: string | null;
        peopleCount: number;
        status: import(".prisma/client").$Enums.OrderStatus;
        paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
        subtotal: Prisma.Decimal;
        discount: Prisma.Decimal;
        tip: Prisma.Decimal;
        total: Prisma.Decimal;
        tableId: number | null;
        clientId: number | null;
        serverId: number | null;
        driverId: number | null;
        deliveryAddress: string | null;
        deliveryNotes: string | null;
        closedAt: Date | null;
        businessDate: Date;
    })[]>;
    /**
     * Update individual order item status.
     * @delegates orderKitchenService.updateItemStatus
     */
    updateItemStatus(itemId: number, status: 'PENDING' | 'COOKING' | 'READY' | 'SERVED'): Promise<{
        order: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            orderNumber: number;
            channel: import(".prisma/client").$Enums.OrderChannel;
            externalId: string | null;
            peopleCount: number;
            status: import(".prisma/client").$Enums.OrderStatus;
            paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
            subtotal: Prisma.Decimal;
            discount: Prisma.Decimal;
            tip: Prisma.Decimal;
            total: Prisma.Decimal;
            tableId: number | null;
            clientId: number | null;
            serverId: number | null;
            driverId: number | null;
            deliveryAddress: string | null;
            deliveryNotes: string | null;
            closedAt: Date | null;
            businessDate: Date;
        };
    } & {
        id: number;
        quantity: number;
        productId: number;
        status: import(".prisma/client").$Enums.ItemStatus;
        orderId: number;
        unitPrice: Prisma.Decimal;
        notes: string | null;
    }>;
    /**
     * Mark all items in an order as SERVED.
     * @delegates orderKitchenService.markAllItemsServed
     */
    markAllItemsServed(orderId: number): Promise<({
        client: {
            name: string;
            id: number;
            email: string | null;
            createdAt: Date;
            updatedAt: Date;
            phone: string | null;
            address: string | null;
            taxId: string | null;
            points: number;
            walletBalance: Prisma.Decimal;
        } | null;
        driver: {
            name: string;
            id: number;
            email: string | null;
            pinCode: string | null;
            roleId: number;
            passwordHash: string | null;
            uiSettings: Prisma.JsonValue | null;
            isActive: boolean;
            failedLoginAttempts: number;
            lockedUntil: Date | null;
            createdAt: Date;
            updatedAt: Date;
        } | null;
        items: ({
            product: {
                name: string;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                categoryId: number;
                description: string | null;
                price: Prisma.Decimal;
                image: string | null;
                productType: import(".prisma/client").$Enums.ProductType;
                isStockable: boolean;
            };
            modifiers: ({
                modifierOption: {
                    name: string;
                    id: number;
                    isActive: boolean;
                    ingredientId: number | null;
                    modifierGroupId: number;
                    priceOverlay: Prisma.Decimal;
                    qtyUsed: Prisma.Decimal | null;
                };
            } & {
                id: number;
                priceCharged: Prisma.Decimal;
                modifierOptionId: number;
                orderItemId: number;
            })[];
        } & {
            id: number;
            quantity: number;
            productId: number;
            status: import(".prisma/client").$Enums.ItemStatus;
            orderId: number;
            unitPrice: Prisma.Decimal;
            notes: string | null;
        })[];
        payments: {
            id: number;
            createdAt: Date;
            method: import(".prisma/client").$Enums.PaymentMethod;
            tip: Prisma.Decimal;
            orderId: number;
            amount: Prisma.Decimal;
            externalRef: string | null;
            shiftId: number | null;
        }[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        orderNumber: number;
        channel: import(".prisma/client").$Enums.OrderChannel;
        externalId: string | null;
        peopleCount: number;
        status: import(".prisma/client").$Enums.OrderStatus;
        paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
        subtotal: Prisma.Decimal;
        discount: Prisma.Decimal;
        tip: Prisma.Decimal;
        total: Prisma.Decimal;
        tableId: number | null;
        clientId: number | null;
        serverId: number | null;
        driverId: number | null;
        deliveryAddress: string | null;
        deliveryNotes: string | null;
        closedAt: Date | null;
        businessDate: Date;
    }) | null>;
    /**
     * Validate products and calculate order totals.
     * @delegates orderItemService.validateAndCalculateItems
     */
    private validateAndCalculateItems;
    /**
     * Process stock deductions for order items.
     * @private
     *
     * @business_rule
     * Prevents stock corruption coverage if the "Stock Management" module is disabled via TenantConfig (enableStock).
     * If disabled, this function exits gracefully without modifying database state.
     */
    private processStockUpdates;
    getOrderByTable(tableId: number): Promise<({
        items: ({
            product: {
                name: string;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                categoryId: number;
                description: string | null;
                price: Prisma.Decimal;
                image: string | null;
                productType: import(".prisma/client").$Enums.ProductType;
                isStockable: boolean;
            };
            modifiers: ({
                modifierOption: {
                    name: string;
                    id: number;
                    isActive: boolean;
                    ingredientId: number | null;
                    modifierGroupId: number;
                    priceOverlay: Prisma.Decimal;
                    qtyUsed: Prisma.Decimal | null;
                };
            } & {
                id: number;
                priceCharged: Prisma.Decimal;
                modifierOptionId: number;
                orderItemId: number;
            })[];
        } & {
            id: number;
            quantity: number;
            productId: number;
            status: import(".prisma/client").$Enums.ItemStatus;
            orderId: number;
            unitPrice: Prisma.Decimal;
            notes: string | null;
        })[];
        payments: {
            id: number;
            createdAt: Date;
            method: import(".prisma/client").$Enums.PaymentMethod;
            tip: Prisma.Decimal;
            orderId: number;
            amount: Prisma.Decimal;
            externalRef: string | null;
            shiftId: number | null;
        }[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        orderNumber: number;
        channel: import(".prisma/client").$Enums.OrderChannel;
        externalId: string | null;
        peopleCount: number;
        status: import(".prisma/client").$Enums.OrderStatus;
        paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
        subtotal: Prisma.Decimal;
        discount: Prisma.Decimal;
        tip: Prisma.Decimal;
        total: Prisma.Decimal;
        tableId: number | null;
        clientId: number | null;
        serverId: number | null;
        driverId: number | null;
        deliveryAddress: string | null;
        deliveryNotes: string | null;
        closedAt: Date | null;
        businessDate: Date;
    }) | null>;
    addItemsToOrder(orderId: number, newItems: OrderItemInput[], serverId: number): Promise<{
        items: ({
            product: {
                name: string;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                categoryId: number;
                description: string | null;
                price: Prisma.Decimal;
                image: string | null;
                productType: import(".prisma/client").$Enums.ProductType;
                isStockable: boolean;
            };
        } & {
            id: number;
            quantity: number;
            productId: number;
            status: import(".prisma/client").$Enums.ItemStatus;
            orderId: number;
            unitPrice: Prisma.Decimal;
            notes: string | null;
        })[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        orderNumber: number;
        channel: import(".prisma/client").$Enums.OrderChannel;
        externalId: string | null;
        peopleCount: number;
        status: import(".prisma/client").$Enums.OrderStatus;
        paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
        subtotal: Prisma.Decimal;
        discount: Prisma.Decimal;
        tip: Prisma.Decimal;
        total: Prisma.Decimal;
        tableId: number | null;
        clientId: number | null;
        serverId: number | null;
        driverId: number | null;
        deliveryAddress: string | null;
        deliveryNotes: string | null;
        closedAt: Date | null;
        businessDate: Date;
    }>;
    getRecentOrders(): Promise<({
        items: ({
            product: {
                name: string;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                categoryId: number;
                description: string | null;
                price: Prisma.Decimal;
                image: string | null;
                productType: import(".prisma/client").$Enums.ProductType;
                isStockable: boolean;
            };
        } & {
            id: number;
            quantity: number;
            productId: number;
            status: import(".prisma/client").$Enums.ItemStatus;
            orderId: number;
            unitPrice: Prisma.Decimal;
            notes: string | null;
        })[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        orderNumber: number;
        channel: import(".prisma/client").$Enums.OrderChannel;
        externalId: string | null;
        peopleCount: number;
        status: import(".prisma/client").$Enums.OrderStatus;
        paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
        subtotal: Prisma.Decimal;
        discount: Prisma.Decimal;
        tip: Prisma.Decimal;
        total: Prisma.Decimal;
        tableId: number | null;
        clientId: number | null;
        serverId: number | null;
        driverId: number | null;
        deliveryAddress: string | null;
        deliveryNotes: string | null;
        closedAt: Date | null;
        businessDate: Date;
    })[]>;
    /**
     * Get active orders for KDS (Kitchen Display System).
     * @delegates orderKitchenService.getActiveOrders
     */
    getActiveOrders(): Promise<({
        table: {
            name: string;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            y: number | null;
            status: import(".prisma/client").$Enums.TableStatus;
            areaId: number;
            x: number | null;
            currentOrderId: number | null;
        } | null;
        items: ({
            product: {
                name: string;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                categoryId: number;
                description: string | null;
                price: Prisma.Decimal;
                image: string | null;
                productType: import(".prisma/client").$Enums.ProductType;
                isStockable: boolean;
            };
            modifiers: ({
                modifierOption: {
                    name: string;
                    id: number;
                    isActive: boolean;
                    ingredientId: number | null;
                    modifierGroupId: number;
                    priceOverlay: Prisma.Decimal;
                    qtyUsed: Prisma.Decimal | null;
                };
            } & {
                id: number;
                priceCharged: Prisma.Decimal;
                modifierOptionId: number;
                orderItemId: number;
            })[];
        } & {
            id: number;
            quantity: number;
            productId: number;
            status: import(".prisma/client").$Enums.ItemStatus;
            orderId: number;
            unitPrice: Prisma.Decimal;
            notes: string | null;
        })[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        orderNumber: number;
        channel: import(".prisma/client").$Enums.OrderChannel;
        externalId: string | null;
        peopleCount: number;
        status: import(".prisma/client").$Enums.OrderStatus;
        paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
        subtotal: Prisma.Decimal;
        discount: Prisma.Decimal;
        tip: Prisma.Decimal;
        total: Prisma.Decimal;
        tableId: number | null;
        clientId: number | null;
        serverId: number | null;
        driverId: number | null;
        deliveryAddress: string | null;
        deliveryNotes: string | null;
        closedAt: Date | null;
        businessDate: Date;
    })[]>;
    /**
     * Update order status with state machine validation.
     * @delegates orderStatusService.updateStatus
     */
    updateStatus(orderId: number, status: OrderStatus): Promise<{
        table: {
            name: string;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            y: number | null;
            status: import(".prisma/client").$Enums.TableStatus;
            areaId: number;
            x: number | null;
            currentOrderId: number | null;
        } | null;
        items: ({
            product: {
                name: string;
                id: number;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                categoryId: number;
                description: string | null;
                price: Prisma.Decimal;
                image: string | null;
                productType: import(".prisma/client").$Enums.ProductType;
                isStockable: boolean;
            };
            modifiers: ({
                modifierOption: {
                    name: string;
                    id: number;
                    isActive: boolean;
                    ingredientId: number | null;
                    modifierGroupId: number;
                    priceOverlay: Prisma.Decimal;
                    qtyUsed: Prisma.Decimal | null;
                };
            } & {
                id: number;
                priceCharged: Prisma.Decimal;
                modifierOptionId: number;
                orderItemId: number;
            })[];
        } & {
            id: number;
            quantity: number;
            productId: number;
            status: import(".prisma/client").$Enums.ItemStatus;
            orderId: number;
            unitPrice: Prisma.Decimal;
            notes: string | null;
        })[];
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        orderNumber: number;
        channel: import(".prisma/client").$Enums.OrderChannel;
        externalId: string | null;
        peopleCount: number;
        status: import(".prisma/client").$Enums.OrderStatus;
        paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
        subtotal: Prisma.Decimal;
        discount: Prisma.Decimal;
        tip: Prisma.Decimal;
        total: Prisma.Decimal;
        tableId: number | null;
        clientId: number | null;
        serverId: number | null;
        driverId: number | null;
        deliveryAddress: string | null;
        deliveryNotes: string | null;
        closedAt: Date | null;
        businessDate: Date;
    }>;
}
export declare const orderService: OrderService;
//# sourceMappingURL=order.service.d.ts.map