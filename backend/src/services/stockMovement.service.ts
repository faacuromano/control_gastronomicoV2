
import { PrismaClient, StockMoveType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { stockAlertService } from './stockAlert.service';

export class StockMovementService {
  
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
  async register(ingredientId: number, type: StockMoveType, quantity: number, reason?: string, externalTx?: any) {
    // If not adjustment, quantity is absolute magnitude
    if (type !== 'ADJUSTMENT' && quantity < 0) {
        throw new Error("Quantity must be positive for PURCHASE, SALE, or WASTE");
    }

    const performMove = async (tx: any) => {
      // 1. Create movement record
      const movement = await tx.stockMovement.create({
        data: {
          ingredientId,
          type,
          quantity, // Record the raw quantity (can be negative for adjustment)
          reason
        }
      });

      // 2. Calculate stock change
      let increment = 0;
      if (type === 'SALE' || type === 'WASTE') {
         increment = -Math.abs(quantity);
      } else if (type === 'PURCHASE') {
         increment = Math.abs(quantity);
      } else {
         // ADJUSTMENT
         increment = quantity; 
      }

      // 3. Update Ingredient
      const ingredient = await tx.ingredient.update({
        where: { id: ingredientId },
        data: {
          stock: {
            increment: increment
          }
        }
      });

      return { movement, newStock: ingredient.stock };
    };

    let result;
    if (externalTx) {
        result = await performMove(externalTx);
    } else {
        result = await prisma.$transaction(async (tx) => performMove(tx));
    }
    
    // Check for low stock alert after movement
    stockAlertService.checkAndAlert(ingredientId, Number(result.newStock));
    
    return result;
  }

  async getHistory(ingredientId?: number) {
    const where = ingredientId ? { ingredientId } : {};
    return await prisma.stockMovement.findMany({
      where,
      include: { ingredient: true },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }
}
