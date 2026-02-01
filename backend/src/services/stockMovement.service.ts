
import { PrismaClient, StockMoveType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { stockAlertService } from './stockAlert.service';
import { ValidationError, NotFoundError } from '../utils/errors';

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
  async register(ingredientId: number, tenantId: number, type: StockMoveType, quantity: number, reason?: string, externalTx?: any) {
    // If not adjustment, quantity is absolute magnitude
    if (type !== 'ADJUSTMENT' && quantity < 0) {
        throw new ValidationError('Quantity must be positive for PURCHASE, SALE, or WASTE');
    }

    const performMove = async (tx: any) => {
      // 0. Verify Ingredient Ownership
      const ingredient = await tx.ingredient.findFirst({ where: { id: ingredientId, tenantId } });
      if (!ingredient) throw new NotFoundError(`Ingredient ${ingredientId}`);

      // 1. Create movement record
      const movement = await tx.stockMovement.create({
        data: {
          tenantId,
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

      // SAFE: tx.ingredient.findFirst L26 verifies tenant ownership
      await tx.ingredient.update({
        where: { id: ingredientId },
        data: {
          stock: {
            increment: increment
          }
        }
      });

      // Refetch to get the actual updated stock value (safe under concurrent updates)
      const updatedIng = await tx.ingredient.findFirst({ where: { id: ingredientId, tenantId } });
      return { movement, newStock: updatedIng!.stock };
    };

    let result;
    if (externalTx) {
        result = await performMove(externalTx);
    } else {
        result = await prisma.$transaction(async (tx) => performMove(tx));
    }
    
    // Check for low stock alert after movement
    stockAlertService.checkAndAlert(ingredientId, tenantId, Number(result.newStock));
    
    return result;
  }

  /**
   * Batch register multiple stock movements in a single transaction pass.
   * Eliminates N+1 by verifying all ingredients upfront, then creating movements
   * and updating stock in parallel where possible.
   */
  async registerBatch(
    updates: { ingredientId: number; quantity: number }[],
    tenantId: number,
    type: StockMoveType,
    reason: string,
    externalTx: any
  ): Promise<void> {
    if (updates.length === 0) return;

    const tx = externalTx;

    // 1. Verify all ingredients belong to tenant in ONE query
    const ingredientIds = updates.map(u => u.ingredientId);
    const ingredients = await tx.ingredient.findMany({
      where: { id: { in: ingredientIds }, tenantId },
      select: { id: true }
    });
    const validIds = new Set(ingredients.map((i: { id: number }) => i.id));

    // 2. Create all movement records and update stock
    for (const update of updates) {
      if (!validIds.has(update.ingredientId)) continue;

      const increment = (type === 'SALE' || type === 'WASTE')
        ? -Math.abs(update.quantity)
        : Math.abs(update.quantity);

      // Create movement + update stock (2 queries per ingredient instead of 4)
      await tx.stockMovement.create({
        data: { tenantId, ingredientId: update.ingredientId, type, quantity: update.quantity, reason }
      });
      await tx.ingredient.update({
        where: { id: update.ingredientId },
        data: { stock: { increment } }
      });
    }

    // 3. Check alerts after all updates - single batch query instead of N queries
    const processedIds = updates.filter(u => validIds.has(u.ingredientId)).map(u => u.ingredientId);
    if (processedIds.length > 0) {
      const updatedIngredients = await tx.ingredient.findMany({
        where: { id: { in: processedIds }, tenantId },
        select: { id: true, stock: true }
      });
      for (const ing of updatedIngredients) {
        stockAlertService.checkAndAlert(ing.id, tenantId, Number(ing.stock));
      }
    }
  }

  async getHistory(tenantId: number, ingredientId?: number) {
    const where: any = { tenantId };
    if (ingredientId) where.ingredientId = ingredientId;
    return await prisma.stockMovement.findMany({
      where,
      include: { ingredient: true },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }
}
