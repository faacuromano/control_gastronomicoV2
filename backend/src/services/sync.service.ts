/**
 * @fileoverview Servicio de sincronizacion offline.
 * Gestiona las operaciones pull (servidor -> cliente) y push (cliente -> servidor)
 * para permitir que la aplicacion POS funcione sin conexion a internet.
 *
 * El flujo de sincronizacion es:
 * 1. PULL: El cliente descarga productos, categorias y rutas de impresion
 * 2. OFFLINE: El cliente opera normalmente, guardando ordenes y pagos localmente
 * 3. PUSH: Cuando recupera conexion, envia las operaciones pendientes al servidor
 * 4. RECONCILIACION: El servidor procesa ordenes y pagos, detecta conflictos
 *
 * @module services/sync.service
 */

import { prisma } from '../lib/prisma';
import { withSerializableTransaction, type TransactionClient } from '../lib/prisma-extensions';
import { OrderChannel, PaymentMethod, PaymentStatus, AuditAction } from '@prisma/client';
import { orderService } from './order.service';
import { auditService, type AuditContext } from './audit.service';
import { logger } from '../utils/logger';
import { ValidationError } from '../utils/errors';
import type {
    SyncPullResponse,
    SyncProduct,
    SyncCategory,
    SyncPrinterRouting,
    SyncPushRequest,
    SyncPushResponse,
    OrderMapping,
    SyncError,
    SyncWarning,
    PendingOrder,
    PendingPayment
} from '../types/sync.types';

/**
 * Servicio para gestionar la sincronizacion de datos offline.
 * Implementa deteccion de conflictos, idempotencia y reconciliacion de pagos.
 */
export class SyncService {

    /**
     * Descarga todos los datos necesarios para operacion offline.
     * Se llama cuando el cliente se conecta o al iniciar la aplicacion.
     *
     * Retorna productos activos, categorias y rutas de impresion,
     * junto con un token de sincronizacion para deteccion de conflictos posterior.
     */
    async pull(tenantId: number): Promise<SyncPullResponse> {
        const [products, categories, printerRouting] = await Promise.all([
            this.getProductsForSync(tenantId),
            this.getCategoriesForSync(tenantId),
            this.getPrinterRoutingForSync(tenantId)
        ]);

        return {
            products,
            categories,
            printerRouting,
            serverTime: new Date().toISOString(),
            syncToken: this.generateSyncToken()
        };
    }

    /**
     * Recibe y procesa las operaciones realizadas offline por el cliente.
     * Procesa ordenes y pagos creados durante la desconexion.
     *
     * Flujo:
     * 1. Detecta conflictos comparando el syncToken con cambios recientes
     * 2. Filtra tempIds duplicados (idempotencia en reintentos)
     * 3. Procesa ordenes pendientes (crea ordenes reales con IDs del servidor)
     * 4. Mapea tempIds a IDs reales para los pagos
     * 5. Procesa pagos pendientes usando transacciones serializables
     * 6. Reconcilia estados de pago por si algun pago fallo
     * 7. Registra la operacion de sincronizacion en auditoria
     */
    async push(
        request: SyncPushRequest,
        tenantId: number,
        context: AuditContext
    ): Promise<SyncPushResponse> {
        const orderMappings: OrderMapping[] = [];
        const errors: SyncError[] = [];
        const warnings: SyncWarning[] = [];

        // BIZ-009: Deteccion de conflictos: advertir si los datos del servidor cambiaron desde el ultimo sync
        const conflictWarnings = await this.validateSyncToken(request.syncToken, tenantId);
        warnings.push(...conflictWarnings);

        // BIZ-010: Verificacion de idempotencia: detectar tempIds duplicados en escenarios de reintento
        const seenTempIds = new Set<string>();
        for (const pendingOrder of request.pendingOrders) {
            if (seenTempIds.has(pendingOrder.tempId)) {
                warnings.push({
                    tempId: pendingOrder.tempId,
                    code: 'DUPLICATE_TEMP_ID',
                    message: `Duplicate tempId detected: ${pendingOrder.tempId}, skipping`
                });
            }
            seenTempIds.add(pendingOrder.tempId);
        }
        const uniqueOrders = request.pendingOrders.filter((o, i, arr) =>
            arr.findIndex(x => x.tempId === o.tempId) === i
        );

        // 1. Procesar ordenes primero (necesitan IDs reales antes de los pagos)
        for (const pendingOrder of uniqueOrders) {
            try {
                const result = await this.processOfflineOrder(pendingOrder, tenantId, context);
                orderMappings.push(result.mapping);
                if (result.warnings.length > 0) {
                    warnings.push(...result.warnings);
                }
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error('Sync order failed', { tempId: pendingOrder.tempId, error: errorMessage });
                errors.push({
                    tempId: pendingOrder.tempId,
                    code: 'ORDER_SYNC_FAILED',
                    message: errorMessage
                });
                orderMappings.push({
                    tempId: pendingOrder.tempId,
                    realId: null,
                    orderNumber: null,
                    status: 'ERROR'
                });
            }
        }

        // 2. Crear mapeo de tempId a ID real para resolucion de pagos
        const tempToRealId = new Map<string, number>();
        for (const mapping of orderMappings) {
            if (mapping.status === 'SYNCED' && mapping.realId) {
                tempToRealId.set(mapping.tempId, mapping.realId);
            }
        }

        // 3. Procesar pagos usando el mapeo de IDs
        for (const pendingPayment of request.pendingPayments) {
            try {
                await this.processOfflinePayment(pendingPayment, tenantId, tempToRealId, context);
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error('Sync payment failed', {
                    tempOrderId: pendingPayment.tempOrderId,
                    error: errorMessage
                });
                errors.push({
                    tempId: pendingPayment.tempOrderId,
                    code: 'PAYMENT_SYNC_FAILED',
                    message: errorMessage
                });
            }
        }

        // 4. DB-010: Reconciliar estados de pago despues de procesar todos los pagos.
        //    Si algunos pagos fallaron, el paymentStatus de la orden podria ser inconsistente.
        for (const mapping of orderMappings) {
            if (mapping.status === 'SYNCED' && mapping.realId) {
                try {
                    await this.reconcileOrderPaymentStatus(mapping.realId, tenantId);
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    logger.warn('Payment status reconciliation failed', {
                        orderId: mapping.realId,
                        error: errorMessage,
                    });
                }
            }
        }

        // 5. Registrar la operacion de sincronizacion en auditoria
        await auditService.log(
            AuditAction.SYNC_COMPLETED,
            'Sync',
            null,
            context,
            {
                clientId: request.clientId,
                ordersProcessed: request.pendingOrders.length,
                paymentsProcessed: request.pendingPayments.length,
                errors: errors.length,
                warnings: warnings.length
            }
        );

        return {
            success: errors.length === 0,
            orderMappings,
            errors,
            warnings,
            syncedAt: new Date().toISOString()
        };
    }

    /**
     * Procesa una orden offline individual.
     * Busca el turno de caja activo y crea la orden usando el OrderService existente.
     * Si el turno original del cliente difiere del actual, emite una advertencia.
     */
    private async processOfflineOrder(
        pendingOrder: PendingOrder,
        tenantId: number,
        context: AuditContext
    ): Promise<{ mapping: OrderMapping; warnings: SyncWarning[] }> {
        const warnings: SyncWarning[] = [];

        // Obtener el turno de caja activo para este tenant
        const activeShift = await prisma.cashShift.findFirst({
            where: { tenantId, endTime: null },
            orderBy: { startTime: 'desc' }
        });

        if (!activeShift) {
            throw new ValidationError('No active cash shift for sync');
        }

        // Advertir si el turno original difiere del actual (puede indicar cambio de turno durante offline)
        if (pendingOrder.shiftId && pendingOrder.shiftId !== activeShift.id) {
            warnings.push({
                tempId: pendingOrder.tempId,
                code: 'SHIFT_REASSIGNED',
                message: `Order reassigned from shift ${pendingOrder.shiftId} to ${activeShift.id}`
            });
        }

        // Crear la orden usando el servicio existente para reutilizar toda la logica de negocio
        // userId esta garantizado por el sync controller antes de llegar aqui
        if (!context.userId) {
            throw new ValidationError('userId required for sync');
        }
        const order = await orderService.createOrder({
            tenantId,
            userId: context.userId,
            items: pendingOrder.items,
            channel: pendingOrder.channel,
            tableId: pendingOrder.tableId,
            clientId: pendingOrder.clientId,
            // Nota: los pagos se procesan por separado
        });

        return {
            mapping: {
                tempId: pendingOrder.tempId,
                realId: order.id,
                orderNumber: order.orderNumber,
                status: 'SYNCED'
            },
            warnings
        };
    }

    /**
     * Procesa un pago offline individual dentro de una transaccion Serializable.
     *
     * @complexity O(1) - Una sola transaccion con lectura-modificacion-escritura atomica
     * @guarantee ACID - Aislamiento Serializable previene pagos fantasma
     * @implements TDD Seccion 1.2 - Transaccion Serializable para Pagos
     *
     * FIX P0-003: Reemplaza operaciones separadas CREATE + READ + UPDATE con una
     * transaccion atomica. Previene condiciones de carrera donde pagos concurrentes
     * calculan totales incorrectos.
     *
     * Invariante: SumaPagos <= Order.total (validado antes del commit)
     */
    private async processOfflinePayment(
        pendingPayment: PendingPayment,
        tenantId: number,
        tempToRealId: Map<string, number>,
        context: AuditContext
    ): Promise<void> {
        let realOrderId: number | undefined;

        // Handle real_ prefix: payment references an existing server order directly
        if (pendingPayment.tempOrderId.startsWith('real_')) {
            const parsedId = parseInt(pendingPayment.tempOrderId.replace('real_', ''), 10);
            if (isNaN(parsedId)) {
                throw new ValidationError(
                    `Invalid real order ID format: ${pendingPayment.tempOrderId}`
                );
            }
            realOrderId = parsedId;
        } else {
            realOrderId = tempToRealId.get(pendingPayment.tempOrderId);
        }

        if (!realOrderId) {
            throw new ValidationError(
                `Cannot find real order ID for temp ID: ${pendingPayment.tempOrderId}`
            );
        }

        await withSerializableTransaction(
            async (tx: TransactionClient) => {
                // Paso 1: Obtener turno activo (lectura incluida en tx para atomicidad)
                const activeShift = await tx.cashShift.findFirst({
                    where: { tenantId, endTime: null },
                    orderBy: { startTime: 'desc' }
                });

                if (!activeShift) {
                    throw new ValidationError('No active cash shift for payment sync');
                }

                // Paso 2: Obtener orden con pagos existentes DENTRO de la transaccion.
                // El aislamiento Serializable garantiza que no aparezcan pagos fantasma.
                const order = await tx.order.findFirst({
                    where: { id: realOrderId, tenantId },
                    include: { payments: true }
                });

                if (!order) {
                    throw new ValidationError(`Order ${realOrderId} not found`);
                }

                // Paso 3: Calcular total pagado actual ANTES de agregar el nuevo pago
                const currentTotalPaid = order.payments.reduce(
                    (sum, p) => sum + Number(p.amount),
                    0
                );
                const orderTotal = Number(order.total);

                // Paso 4: Verificacion del invariante - prevenir sobrepago
                // Segun TDD: SumaPagos <= Order.total
                const proposedTotalPaid = currentTotalPaid + pendingPayment.amount;
                const overpaymentMargin = 0.01; // Tolerancia de 1 centavo

                if (proposedTotalPaid > orderTotal + overpaymentMargin) {
                    logger.warn('Overpayment detected in offline sync', {
                        orderId: realOrderId,
                        orderTotal,
                        currentTotalPaid,
                        proposedPayment: pendingPayment.amount,
                        proposedTotal: proposedTotalPaid,
                    });
                    // No lanzar error: ajustar el pago al monto restante
                    const remainingAmount = Math.max(0, orderTotal - currentTotalPaid);
                    if (remainingAmount <= 0) {
                        logger.info('Order already fully paid, skipping payment', {
                            orderId: realOrderId,
                        });
                        return; // Omitir este pago
                    }
                    // Ajustar monto del pago al restante
                    pendingPayment.amount = remainingAmount;
                }

                // Paso 5: Crear pago DENTRO de la transaccion
                await tx.payment.create({
                    data: {
                        tenantId,
                        orderId: realOrderId,
                        method: pendingPayment.method,
                        amount: pendingPayment.amount,
                        shiftId: activeShift.id
                    }
                });

                // Paso 6: Calcular nuevo total y actualizar estado ATOMICAMENTE
                const newTotalPaid = currentTotalPaid + pendingPayment.amount;
                const newStatus = newTotalPaid >= orderTotal ? 'PAID' : 'PARTIAL';

                await tx.order.updateMany({
                    where: { id: realOrderId, tenantId },
                    data: { paymentStatus: newStatus }
                });

                logger.debug('Offline payment processed in serializable tx', {
                    orderId: realOrderId,
                    paymentAmount: pendingPayment.amount,
                    newTotalPaid,
                    newStatus,
                });
            },
            {
                resourceName: `Order:${realOrderId}:Payment`,
                lockTimeoutMs: 5000,
            }
        );
    }

    // =========================================================================
    // DB-010: RECONCILIACION DE PAGOS
    // =========================================================================

    /**
     * Reconcilia el estado de pago de una orden despues de la sincronizacion.
     * Asegura que el paymentStatus refleje la suma real de los pagos registrados.
     * Maneja el caso de fallo parcial donde algunos pagos se procesaron y otros no.
     */
    private async reconcileOrderPaymentStatus(orderId: number, tenantId: number): Promise<void> {
        const order = await prisma.order.findFirst({
            where: { id: orderId, tenantId },
            include: { payments: true },
        });

        if (!order) return;

        const totalPaid = order.payments.reduce(
            (sum, p) => sum + Number(p.amount), 0
        );
        const orderTotal = Number(order.total);

        let expectedStatus: PaymentStatus;
        if (totalPaid <= 0) {
            expectedStatus = PaymentStatus.PENDING;
        } else if (totalPaid >= orderTotal) {
            expectedStatus = PaymentStatus.PAID;
        } else {
            expectedStatus = PaymentStatus.PARTIAL;
        }

        // Solo actualizar si el estado actual no coincide con el esperado
        if (order.paymentStatus !== expectedStatus) {
            logger.warn('Payment status inconsistency detected, reconciling', {
                orderId,
                currentStatus: order.paymentStatus,
                expectedStatus,
                totalPaid,
                orderTotal,
            });
            await prisma.order.updateMany({
                where: { id: orderId, tenantId },
                data: { paymentStatus: expectedStatus },
            });
        }
    }

    // =========================================================================
    // BIZ-009: DETECCION DE CONFLICTOS
    // =========================================================================

    /**
     * Valida el token de sincronizacion para detectar conflictos entre clientes offline concurrentes.
     * Si los datos del servidor cambiaron desde el ultimo pull del cliente,
     * emite advertencias sobre posibles conflictos.
     */
    async validateSyncToken(
        syncToken: string | undefined,
        tenantId: number
    ): Promise<SyncWarning[]> {
        const warnings: SyncWarning[] = [];

        if (!syncToken) {
            warnings.push({
                tempId: '__sync__',
                code: 'MISSING_SYNC_TOKEN',
                message: 'No sync token provided. Data may be stale.',
            });
            return warnings;
        }

        // Extraer timestamp del token de sync (formato: sync_<timestamp>_<random>)
        const tokenParts = syncToken.split('_');
        if (tokenParts.length < 2) return warnings;

        const lastSyncTime = parseInt(tokenParts[1] || '0', 10);
        if (isNaN(lastSyncTime) || lastSyncTime <= 0) return warnings;

        const lastSyncDate = new Date(lastSyncTime);

        // PERF-019: Paralelizar consultas de deteccion de conflictos
        const [recentOrders, recentProductChanges] = await Promise.all([
            prisma.order.count({
                where: { tenantId, createdAt: { gt: lastSyncDate } },
            }),
            prisma.product.count({
                where: { tenantId, updatedAt: { gt: lastSyncDate } },
            }),
        ]);

        if (recentOrders > 0) {
            warnings.push({
                tempId: '__sync__',
                code: 'CONCURRENT_CHANGES',
                message: `${recentOrders} order(s) created since last sync at ${lastSyncDate.toISOString()}. Review for conflicts.`,
            });
        }

        if (recentProductChanges > 0) {
            warnings.push({
                tempId: '__sync__',
                code: 'CATALOG_CHANGED',
                message: `${recentProductChanges} product(s) updated since last sync. Prices may differ.`,
            });
        }

        return warnings;
    }

    // =========================================================================
    // METODOS AUXILIARES
    // =========================================================================

    /**
     * Obtiene productos formateados para sincronizacion offline.
     * Incluye solo productos activos con sus categorias y modificadores.
     */
    private async getProductsForSync(tenantId: number): Promise<SyncProduct[]> {
        const products = await prisma.product.findMany({
            where: { isActive: true, tenantId },
            include: {
                category: true,
                modifiers: {
                    include: {
                        modifierGroup: {
                            include: { options: true }
                        }
                    }
                }
            },
            orderBy: { name: 'asc' }
        });

        return products.map(p => ({
            id: p.id,
            name: p.name,
            price: Number(p.price),
            categoryId: p.categoryId,
            categoryName: p.category.name,
            isActive: p.isActive,
            productType: p.productType,
            modifierGroups: p.modifiers.map(m => ({
                id: m.modifierGroup.id,
                name: m.modifierGroup.name,
                minSelection: m.modifierGroup.minSelection,
                maxSelection: m.modifierGroup.maxSelection,
                options: m.modifierGroup.options.map(o => ({
                    id: o.id,
                    name: o.name,
                    price: Number(o.priceOverlay)
                }))
            }))
        }));
    }

    /**
     * Obtiene categorias formateadas para sincronizacion offline.
     */
    private async getCategoriesForSync(tenantId: number): Promise<SyncCategory[]> {
        const categories = await prisma.category.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' }
        });

        return categories.map(c => ({
            id: c.id,
            name: c.name
        }));
    }

    /**
     * Obtiene las rutas de impresion (categoria -> impresora) para sincronizacion offline.
     * Solo incluye categorias que tienen impresora asignada.
     */
    private async getPrinterRoutingForSync(tenantId: number): Promise<SyncPrinterRouting[]> {
        const categories = await prisma.category.findMany({
            where: { tenantId, printerId: { not: null } },
            include: { printer: true }
        });

        return categories
            .filter(c => c.printer !== null)
            .map(c => ({
                categoryId: c.id,
                printerId: c.printer!.id,
                printerName: c.printer!.name,
                connectionType: c.printer!.connectionType,
                ipAddress: c.printer!.ipAddress,
                windowsName: c.printer!.windowsName
            }));
    }

    /**
     * Genera un token de sincronizacion que incluye el timestamp actual.
     * Formato: sync_<timestamp>_<random> para deteccion de conflictos posterior.
     */
    private generateSyncToken(): string {
        return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

export const syncService = new SyncService();
