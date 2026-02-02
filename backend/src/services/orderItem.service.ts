/**
 * @fileoverview Servicio de validacion y calculo de items de orden.
 * Maneja la validacion de productos, calculo de precios y preparacion de stock.
 *
 * Extraido de order.service.ts en la Fase 2 del refactoring para aislar
 * la logica de validacion y calculo que es reutilizada tanto en la creacion
 * de ordenes como en la adicion de items a ordenes existentes.
 *
 * SEGURIDAD CRITICA: Los precios de modificadores se obtienen de la base de datos,
 * NUNCA se confian los precios enviados desde el frontend. Esto previene ataques
 * de manipulacion de precios.
 *
 * @module services/orderItem.service
 * @extracted_from order.service.ts (Phase 2 Refactoring)
 */

import { Prisma } from '@prisma/client';
import { InsufficientStockError, NotFoundError, ValidationError } from '../utils/errors';
import type {
    OrderItemInput,
    OrderItemData,
    StockUpdate,
    ItemCalculationResult
} from '../types/order.types';

/**
 * Servicio para operaciones de items de orden.
 * Responsable de validar productos y calcular totales.
 */
export class OrderItemService {

    /**
     * Valida productos y calcula totales de la orden.
     *
     * SEGURIDAD: Los precios de modificadores se obtienen de la BD, NO se confian del frontend.
     * Esto previene ataques de manipulacion de precios donde el cliente envia precios alterados.
     *
     * Proceso:
     * 1. Batch-fetch de todos los productos e ingredientes necesarios
     * 2. Batch-fetch de precios reales de modificadores desde la BD
     * 3. Para cada item: validar existencia, estado activo, calcular precio
     * 4. Sanitizar modificadores reemplazando precios del frontend con los de la BD
     * 5. Preparar actualizaciones de stock para ingredientes
     *
     * @param tx - Cliente de transaccion Prisma
     * @param items - Array de inputs de items de la orden
     * @param stockEnabled - Si es true, valida disponibilidad de stock
     * @returns Datos calculados de items, actualizaciones de stock y subtotal
     */
    async validateAndCalculateItems(
        tx: Prisma.TransactionClient,
        items: OrderItemInput[],
        tenantId: number,
        stockEnabled: boolean = true
    ): Promise<ItemCalculationResult> {
        let subtotal = 0;
        const itemDataList: OrderItemData[] = [];
        const stockUpdates: StockUpdate[] = [];

        const productIds = items.map(i => i.productId);

        // Recolectar todos los IDs de modificadores de todos los items para fetch en batch
        const allModifierIds = items.flatMap(i => i.modifiers?.map(m => m.id) ?? []);

        // Fetch en batch de productos con sus ingredientes (evita N+1 queries)
        const products = await tx.product.findMany({
            where: { id: { in: productIds }, tenantId },
            include: {
                ingredients: {
                    include: { ingredient: true }
                }
            }
        });

        // SEGURIDAD: Fetch en batch de precios de modificadores desde la base de datos.
        // Esto asegura que usamos el precio real, no lo que el frontend envie.
        const modifierOptions = allModifierIds.length > 0
            ? await tx.modifierOption.findMany({
                where: { id: { in: allModifierIds }, tenantId },
                select: { id: true, priceOverlay: true, name: true }
            })
            : [];

        const modifierPriceMap = new Map(
            modifierOptions.map(m => [m.id, Number(m.priceOverlay)])
        );

        const productMap = new Map(products.map(p => [p.id, p]));

        for (const item of items) {
            const product = productMap.get(item.productId);

            if (!product) {
                throw new NotFoundError(`Product ID ${item.productId}`);
            }
            if (!product.isActive) {
                throw new ValidationError(`Product ${product.name} is not active`);
            }

            const price = Number(product.price);
            const itemTotal = price * item.quantity;
            subtotal += itemTotal;

            // Procesar ingredientes removidos y agregarlos a las notas del item
            const finalNotes = this.buildItemNotes(item, product);

            // SEGURIDAD: Reemplazar precios del frontend con precios de la BD
            const sanitizedModifiers = item.modifiers?.map(m => {
                const dbPrice = modifierPriceMap.get(m.id);
                if (dbPrice === undefined) {
                    throw new NotFoundError(`Modifier ID ${m.id}`);
                }
                return { id: m.id, price: dbPrice };
            });

            itemDataList.push({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: price,
                notes: finalNotes || undefined,
                status: 'PENDING',
                modifiers: sanitizedModifiers
            });

            // Calcular precio de modificadores DESDE VALORES DE LA BD
            if (sanitizedModifiers && sanitizedModifiers.length > 0) {
                const modsTotal = sanitizedModifiers.reduce((acc, m) => acc + m.price, 0);
                subtotal += modsTotal * item.quantity;
            }

            // Preparar actualizaciones de stock para los ingredientes del producto
            this.calculateStockUpdates(
                item,
                product,
                stockUpdates,
                stockEnabled
            );
        }

        return { itemDataList, stockUpdates, subtotal };
    }

    /**
     * Construye las notas del item incluyendo ingredientes removidos.
     * Si el cliente quiere un producto "SIN" ciertos ingredientes, se agrega
     * esa informacion a las notas para que la cocina lo sepa.
     */
    private buildItemNotes(
        item: OrderItemInput,
        product: { ingredients: { ingredientId: number; ingredient: { name: string } }[] }
    ): string {
        let finalNotes = item.notes || '';

        if (item.removedIngredientIds && item.removedIngredientIds.length > 0) {
            const removedNames = product.ingredients
                .filter(pi => item.removedIngredientIds?.includes(pi.ingredientId))
                .map(pi => pi.ingredient.name);

            if (removedNames.length > 0) {
                const prefix = finalNotes ? '. ' : '';
                finalNotes += `${prefix}(SIN: ${removedNames.join(', ')})`;
            }
        }

        return finalNotes;
    }

    /**
     * Calcula las actualizaciones de stock para un item.
     * Valida disponibilidad de stock si stockEnabled es true.
     *
     * Para cada ingrediente del producto:
     * - Calcula la cantidad requerida (qty receta x qty items pedidos)
     * - Si el ingrediente fue removido por el cliente, lo salta
     * - Valida que haya stock suficiente si el modulo esta habilitado
     * - Agrega la deduccion a la lista de actualizaciones
     */
    private calculateStockUpdates(
        item: OrderItemInput,
        product: {
            name: string;
            isStockable: boolean;
            ingredients: {
                ingredientId: number;
                quantity: Prisma.Decimal | number;
                ingredient: { name: string; stock: Prisma.Decimal | number }
            }[]
        },
        stockUpdates: StockUpdate[],
        stockEnabled: boolean
    ): void {
        if (!product.isStockable || product.ingredients.length === 0) {
            return;
        }

        for (const ing of product.ingredients) {
            // Saltar ingredientes que el cliente pidio remover
            if (item.removedIngredientIds?.includes(ing.ingredientId)) {
                continue;
            }

            const requiredQty = Number(ing.quantity) * item.quantity;
            const currentStock = Number(ing.ingredient.stock) || 0;

            // Validar disponibilidad de stock
            if (stockEnabled && currentStock < requiredQty) {
                throw new InsufficientStockError(
                    product.name,
                    ing.ingredient.name,
                    requiredQty,
                    currentStock
                );
            }

            stockUpdates.push({
                ingredientId: ing.ingredientId,
                quantity: requiredQty
            });
        }
    }
}

export const orderItemService = new OrderItemService();
