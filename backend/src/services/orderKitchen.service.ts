/**
 * @fileoverview Servicio de operaciones KDS (Kitchen Display System) para ordenes.
 * Gestiona las actualizaciones de estado de items y consultas de ordenes activas
 * para el personal de cocina.
 *
 * Extraido del monolito order.service.ts como parte del refactoring DT-001
 * para aislar la logica especifica de cocina.
 *
 * Cada cambio de estado se transmite en tiempo real via WebSocket al KDS
 * para que la cocina vea los cambios inmediatamente.
 *
 * Soporta filtrado por estacion KDS para que cada pantalla muestre solo
 * los items que le corresponden (cocina, barra, fria, postres, etc.)
 *
 * @module services/orderKitchen.service
 * @extracted_from order.service.ts (DT-001 Refactoring)
 */

import { prisma } from '../lib/prisma';
import { OrderStatus } from '@prisma/client';
import { kdsService } from './kds.service';
import { kdsStationService } from './kdsStation.service';
import { NotFoundError } from '../utils/errors';

/**
 * Servicio para operaciones del KDS (Kitchen Display System).
 * Gestiona actualizaciones de estado de items y visibilidad de ordenes en cocina.
 */
export class OrderKitchenService {

    /**
     * Actualiza el estado de un item individual de la orden.
     * Transmite la actualizacion a los clientes KDS via WebSocket.
     *
     * Flujo: PENDING -> COOKING -> READY -> SERVED
     * Verifica propiedad del tenant antes de actualizar.
     */
    async updateItemStatus(itemId: number, status: 'PENDING' | 'COOKING' | 'READY' | 'SERVED', tenantId: number) {
        // Verificar que el item pertenezca al tenant antes de actualizar
        const existing = await prisma.orderItem.findFirst({
            where: { id: itemId, tenantId },
            include: {
                order: true,
                product: {
                    include: {
                        kdsStation: true,
                        category: { include: { kdsStation: true } }
                    }
                }
            }
        });
        if (!existing) throw new NotFoundError('Order item');

        // SEGURO: findFirst en L25 verifica propiedad del tenant antes del update
        const item = await prisma.orderItem.update({
            where: { id: itemId },
            data: { status },
            include: { order: true }
        });

        // Resolver la estación del item para emitir evento específico
        const stationCode =
            existing.product?.kdsStation?.code ??
            existing.product?.category?.kdsStation?.code ??
            'KITCHEN';

        // Emitir actualizacion de item específico a la estación correspondiente
        kdsService.broadcastItemUpdateToStation(tenantId, stationCode, {
            itemId,
            orderId: item.orderId,
            orderNumber: item.order.orderNumber,
            status
        });

        // También transmitir la orden completa para actualizar el estado general
        const fullOrder = await this.getOrderWithRelations(item.orderId, tenantId);
        if (fullOrder) {
            kdsService.broadcastOrderUpdate(fullOrder);
        }

        return item;
    }

    /**
     * Marca todos los items de una orden como SERVED (servidos).
     * Se usa cuando la cocina termina una orden de mesa y el mesero la retira.
     * Solo actualiza items que aun no estan en estado SERVED.
     */
    async markAllItemsServed(orderId: number, tenantId: number) {
        // Verificar que la orden pertenezca al tenant
        const order = await prisma.order.findFirst({ where: { id: orderId, tenantId } });
        if (!order) throw new NotFoundError('Order');

        await prisma.orderItem.updateMany({
            where: {
                orderId,
                tenantId,
                status: { notIn: ['SERVED'] }
            },
            data: { status: 'SERVED' }
        });

        // Obtener y transmitir la orden actualizada al KDS
        const fullOrder = await this.getOrderWithRelations(orderId, tenantId);
        if (fullOrder) {
            kdsService.broadcastOrderUpdate(fullOrder);
        }

        return fullOrder;
    }

    /**
     * Obtiene ordenes activas para el KDS (Kitchen Display System).
     * Retorna ordenes que NO estan CERRADAS, CANCELADAS ni ENTREGADAS.
     * Se enfoca en ordenes que necesitan atencion de la cocina.
     *
     * Solo incluye items que aun no han sido servidos (status != SERVED)
     * y ordenes creadas desde hoy para no mostrar historial antiguo.
     * Excluye ordenes vacias (sin items) que se crean al abrir mesas.
     *
     * @param stationCode - Opcional. Si se especifica, filtra items por estacion KDS.
     *                      Si no se especifica, retorna todos los items (vista general).
     */
    async getActiveOrders(tenantId: number, stationCode?: string) {
        const orders = await prisma.order.findMany({
            where: {
                tenantId,
                status: { in: ['OPEN', 'CONFIRMED', 'IN_PREPARATION', 'PREPARED'] as OrderStatus[] },
                createdAt: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0)) // Desde el inicio del dia
                },
                // Solo mostrar ordenes que tienen al menos un item pendiente de servir
                // Esto excluye ordenes vacias creadas al abrir mesas
                items: {
                    some: {
                        status: { not: 'SERVED' }
                    }
                }
            },
            include: {
                items: {
                    include: {
                        product: {
                            include: {
                                kdsStation: true,
                                category: {
                                    include: { kdsStation: true }
                                }
                            }
                        },
                        modifiers: { include: { modifierOption: true } }
                    },
                    where: { status: { not: 'SERVED' } }
                },
                table: true
            },
            orderBy: { createdAt: 'asc' }
        });

        // Si no hay filtro de estacion, retornar todo con info de estacion agregada
        if (!stationCode) {
            return this.enrichOrdersWithStationInfo(orders, tenantId);
        }

        // Filtrar items por estacion y excluir ordenes sin items relevantes
        return this.filterOrdersByStation(orders, stationCode, tenantId);
    }

    /**
     * Agrega informacion de estacion KDS a cada item de las ordenes.
     * Resuelve: Product.kdsStation > Category.kdsStation > Default Station
     * @private
     */
    private async enrichOrdersWithStationInfo(orders: Awaited<ReturnType<typeof this.fetchRawOrders>>, tenantId: number) {
        const defaultStation = await kdsStationService.getDefaultStation(tenantId);
        const defaultCode = defaultStation?.code ?? null;

        return orders.map(order => ({
            ...order,
            items: order.items.map(item => {
                const product = item.product as {
                    kdsStation?: { code: string } | null;
                    category?: { kdsStation?: { code: string } | null };
                };

                // Resolver estacion: producto > categoria > default
                const stationCode =
                    product.kdsStation?.code ??
                    product.category?.kdsStation?.code ??
                    defaultCode;

                return {
                    ...item,
                    kdsStationCode: stationCode
                };
            })
        }));
    }

    /**
     * Filtra ordenes para mostrar solo items de una estacion especifica.
     * Excluye ordenes que no tienen items para esa estacion.
     * @private
     */
    private async filterOrdersByStation(
        orders: Awaited<ReturnType<typeof this.fetchRawOrders>>,
        stationCode: string,
        tenantId: number
    ) {
        const defaultStation = await kdsStationService.getDefaultStation(tenantId);
        const defaultCode = defaultStation?.code ?? null;

        const filteredOrders = orders.map(order => {
            const filteredItems = order.items.filter(item => {
                const product = item.product as {
                    kdsStation?: { code: string } | null;
                    category?: { kdsStation?: { code: string } | null };
                };

                // Resolver estacion del item
                const itemStationCode =
                    product.kdsStation?.code ??
                    product.category?.kdsStation?.code ??
                    defaultCode;

                return itemStationCode === stationCode;
            });

            if (filteredItems.length === 0) return null;

            return {
                ...order,
                items: filteredItems.map(item => ({
                    ...item,
                    kdsStationCode: stationCode
                }))
            };
        }).filter(Boolean);

        return filteredOrders;
    }

    /**
     * Metodo auxiliar para tipar el resultado de la query de ordenes.
     * @private
     */
    private async fetchRawOrders(_tenantId: number) {
        // Este metodo solo existe para inferir tipos, no se usa directamente
        return [] as Awaited<ReturnType<typeof prisma.order.findMany<{
            include: {
                items: {
                    include: {
                        product: {
                            include: {
                                kdsStation: true;
                                category: { include: { kdsStation: true } };
                            };
                        };
                        modifiers: { include: { modifierOption: true } };
                    };
                };
                table: true;
            };
        }>>>;
    }

    /**
     * Obtiene una orden con todas sus relaciones para transmitir via WebSocket.
     * Metodo auxiliar usado internamente despues de cada actualizacion.
     * @private
     */
    private async getOrderWithRelations(orderId: number, tenantId: number) {
        return await prisma.order.findFirst({
            where: { id: orderId, tenantId },
            include: {
                items: {
                    include: {
                        product: true,
                        modifiers: { include: { modifierOption: true } }
                    }
                },
                payments: true,
                client: true,
                driver: true
            }
        });
    }
}

export const orderKitchenService = new OrderKitchenService();
