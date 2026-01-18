import { StockMoveType } from '@prisma/client';
export declare class StockMovementService {
    /**
     * Register a stock movement and update the ingredient stock in a transaction.
     * @param ingredientId
     * @param type PURCHASE, SALE, WASTE, ADJUSTMENT
     * @param quantity The absolute quantity involved (always positive, logic determines sign)
     * @param isAdjustment If true, and type is ADJUSTMENT, quantity is treated as the DELTA.
     *                     If the user wants to set exact stock, the controller should calculate the delta.
     *                     For now, we assume quantity is always the amount to ADD or SUBTRACT.
     * @param reason Optional reason string
     */
    register(ingredientId: number, type: StockMoveType, quantity: number, reason?: string, externalTx?: any): Promise<{
        movement: any;
        newStock: any;
    }>;
    getHistory(ingredientId?: number): Promise<({
        ingredient: {
            name: string;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            unit: string;
            cost: import("@prisma/client/runtime/library").Decimal;
            stock: import("@prisma/client/runtime/library").Decimal;
            minStock: import("@prisma/client/runtime/library").Decimal;
        };
    } & {
        id: number;
        type: import(".prisma/client").$Enums.StockMoveType;
        createdAt: Date;
        reason: string | null;
        ingredientId: number;
        quantity: import("@prisma/client/runtime/library").Decimal;
    })[]>;
}
//# sourceMappingURL=stockMovement.service.d.ts.map