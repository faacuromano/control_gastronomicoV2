/**
 * @fileoverview Servicio de movimientos de stock (inventario).
 * Registra cada cambio en el inventario de ingredientes con trazabilidad completa.
 * Soporta movimientos de tipo PURCHASE (compra), SALE (venta), WASTE (merma)
 * y ADJUSTMENT (ajuste manual). Despues de cada movimiento verifica alertas de stock bajo.
 *
 * @module services/stockMovement.service
 */

import { StockMoveType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { TransactionClient } from '../lib/prisma-extensions';
import { stockAlertService } from './stockAlert.service';
import { ValidationError, NotFoundError } from '../utils/errors';

export class StockMovementService {

  /**
   * Registra un movimiento de stock y actualiza el nivel de inventario del ingrediente.
   *
   * La cantidad siempre se interpreta segun el tipo de movimiento:
   * - PURCHASE: incrementa stock (cantidad positiva)
   * - SALE: decrementa stock (cantidad positiva, se aplica como negativa)
   * - WASTE: decrementa stock (cantidad positiva, se aplica como negativa)
   * - ADJUSTMENT: puede ser positivo o negativo (delta directo)
   *
   * Soporta ejecutarse dentro de una transaccion externa (para composicion con otros servicios)
   * o crear su propia transaccion si no se proporciona una.
   *
   * @param ingredientId - ID del ingrediente a mover
   * @param tenantId - ID del tenant para aislamiento multi-tenant
   * @param type - Tipo de movimiento: PURCHASE, SALE, WASTE, ADJUSTMENT
   * @param quantity - Cantidad del movimiento (siempre positiva excepto ADJUSTMENT)
   * @param reason - Motivo opcional del movimiento
   * @param externalTx - Transaccion externa opcional para composicion
   */
  async register(ingredientId: number, tenantId: number, type: StockMoveType, quantity: number, reason?: string, externalTx?: TransactionClient) {
    // Para movimientos que no son ADJUSTMENT, la cantidad debe ser positiva
    if (type !== 'ADJUSTMENT' && quantity < 0) {
        throw new ValidationError('Quantity must be positive for PURCHASE, SALE, or WASTE');
    }

    // Validacion de limites: prevenir valores absurdos que corrompan niveles de stock
    const MAX_STOCK_QUANTITY = 999999;
    if (Math.abs(quantity) > MAX_STOCK_QUANTITY) {
        throw new ValidationError(`Quantity exceeds maximum allowed (${MAX_STOCK_QUANTITY})`);
    }

    const performMove = async (tx: TransactionClient) => {
      // 0. Verificar que el ingrediente pertenezca al tenant
      const ingredient = await tx.ingredient.findFirst({ where: { id: ingredientId, tenantId } });
      if (!ingredient) throw new NotFoundError(`Ingredient ${ingredientId}`);

      // 1. Crear registro del movimiento (historial auditable)
      const movement = await tx.stockMovement.create({
        data: {
          tenantId,
          ingredientId,
          type,
          quantity, // Se registra la cantidad cruda (puede ser negativa para ADJUSTMENT)
          reason: reason ?? null
        }
      });

      // 2. Calcular el cambio de stock segun el tipo de movimiento
      let increment = 0;
      if (type === 'SALE' || type === 'WASTE') {
         increment = -Math.abs(quantity); // Ventas y mermas siempre decrementan
      } else if (type === 'PURCHASE') {
         increment = Math.abs(quantity); // Compras siempre incrementan
      } else {
         // ADJUSTMENT: delta directo (positivo o negativo)
         increment = quantity;
      }

      // SEGURO: tx.ingredient.findFirst en L26 verifica propiedad del tenant
      await tx.ingredient.update({
        where: { id: ingredientId },
        data: {
          stock: {
            increment: increment
          }
        }
      });

      // Re-obtener el stock actualizado (seguro ante actualizaciones concurrentes)
      const updatedIng = await tx.ingredient.findFirst({ where: { id: ingredientId, tenantId } });
      return { movement, newStock: updatedIng!.stock };
    };

    // Ejecutar dentro de la transaccion externa o crear una propia
    let result;
    if (externalTx) {
        result = await performMove(externalTx);
    } else {
        result = await prisma.$transaction(async (tx) => performMove(tx));
    }

    // Verificar alerta de stock bajo despues del movimiento
    stockAlertService.checkAndAlert(ingredientId, tenantId, Number(result.newStock));

    return result;
  }

  /**
   * Registra multiples movimientos de stock en un solo pase de transaccion.
   * Elimina el problema N+1 verificando todos los ingredientes de una vez,
   * luego creando los movimientos en batch y actualizando stock individualmente.
   *
   * Se usa desde:
   * - orderVoid.service.ts (reversion de stock al anular items)
   * - purchaseOrder.service.ts (recepcion de compras)
   * - order.service.ts (deduccion de stock al crear ordenes)
   *
   * @param updates - Array de {ingredientId, quantity} a procesar
   * @param tenantId - ID del tenant
   * @param type - Tipo de movimiento (SALE, PURCHASE, etc.)
   * @param reason - Motivo del movimiento
   * @param externalTx - Transaccion externa requerida para atomicidad
   */
  async registerBatch(
    updates: { ingredientId: number; quantity: number }[],
    tenantId: number,
    type: StockMoveType,
    reason: string,
    externalTx: TransactionClient
  ): Promise<void> {
    if (updates.length === 0) return;

    // Validar limites de cantidad por item
    const MAX_STOCK_QUANTITY = 999999;
    for (const update of updates) {
      if (Math.abs(update.quantity) > MAX_STOCK_QUANTITY) {
        throw new ValidationError(`Quantity exceeds maximum allowed (${MAX_STOCK_QUANTITY}) for ingredient ${update.ingredientId}`);
      }
    }

    const tx = externalTx;

    // 1. Verificar que todos los ingredientes pertenezcan al tenant en UNA sola consulta
    const ingredientIds = updates.map(u => u.ingredientId);
    const ingredients = await tx.ingredient.findMany({
      where: { id: { in: ingredientIds }, tenantId },
      select: { id: true }
    });
    const validIds = new Set(ingredients.map((i: { id: number }) => i.id));

    // PERF-005: Crear movimientos en batch con una sola query, luego actualizar stock individualmente
    // (Prisma no soporta actualizaciones batch con increment, pero createMany ahorra N-1 round trips)
    const validUpdates = updates.filter(u => validIds.has(u.ingredientId));

    if (validUpdates.length > 0) {
      await tx.stockMovement.createMany({
        data: validUpdates.map(u => ({
          tenantId,
          ingredientId: u.ingredientId,
          type,
          quantity: u.quantity,
          reason
        }))
      });

      // Las actualizaciones de stock deben ser individuales (increment atomico por fila)
      for (const update of validUpdates) {
        const increment = (type === 'SALE' || type === 'WASTE')
          ? -Math.abs(update.quantity)
          : Math.abs(update.quantity);

        await tx.ingredient.update({
          where: { id: update.ingredientId },
          data: { stock: { increment } }
        });
      }
    }

    // 3. Verificar alertas de stock bajo despues de todas las actualizaciones
    // Una sola consulta batch en vez de N consultas individuales
    const processedIds = validUpdates.map(u => u.ingredientId);
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

  /**
   * Obtiene el historial de movimientos de stock.
   * Opcionalmente filtrado por ingrediente especifico.
   * Limitado a los ultimos 50 registros por rendimiento.
   */
  async getHistory(tenantId: number, ingredientId?: number) {
    const where: { tenantId: number; ingredientId?: number } = { tenantId };
    if (ingredientId) where.ingredientId = ingredientId;
    return await prisma.stockMovement.findMany({
      where,
      include: { ingredient: true },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }
}
