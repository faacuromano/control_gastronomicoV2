/**
 * @fileoverview Servicio de enrutamiento de impresion (estilo Toast POS).
 * Determina a que impresora deben enviarse los items de una orden basandose en:
 * 1. Sobrecargas por area (prioridad mas alta) - ej: terraza usa impresora X
 * 2. Impresora asignada a la categoria (enrutamiento por defecto) - ej: bebidas van a barra
 *
 * Esto permite que en un restaurante, los items de cocina se impriman en la cocina,
 * las bebidas en la barra, y los postres en la estacion de postres, automaticamente.
 *
 * @module services/printRouting.service
 * @pattern Strategy - Diferentes estrategias de enrutamiento segun el contexto
 *
 * @example
 * // Obtener enrutamiento para una orden
 * const routes = await printRoutingService.getRoutingForOrder(orderId);
 * // retorna Map<printerId, OrderItem[]>
 */

import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { NotFoundError } from '../utils/errors';

/**
 * Estructura de un item de orden con los datos necesarios para enrutamiento.
 * Incluye producto y categoria para determinar a que impresora enviarlo.
 */
interface OrderItemForRouting {
    id: number;
    productId: number;
    quantity: number;
    notes: string | null;
    product: {
        id: number;
        name: string;
        categoryId: number;
        category: {
            id: number;
            name: string;
            printerId: number | null;
        };
    };
}

/**
 * Representa una ruta de impresion: una impresora con los items que debe imprimir.
 */
interface PrintRoute {
    printerId: number;
    printerName: string;
    items: OrderItemForRouting[];
}

/**
 * Resultado del enrutamiento: rutas asignadas y items sin impresora asignada.
 */
interface RoutingResult {
    routes: PrintRoute[];
    unrouted: OrderItemForRouting[];  // Items sin impresora asignada
}

export class PrintRoutingService {
    /**
     * Obtiene el enrutamiento de impresion para una orden.
     * Agrupa los items por impresora destino segun la jerarquia de prioridades:
     * 1. Sobrecarga especifica de categoria para el area de la mesa
     * 2. Sobrecarga general del area (todas las categorias a una impresora)
     * 3. Impresora por defecto de la categoria del producto
     *
     * @param orderId - ID de la orden a enrutar
     * @param tenantId - ID del tenant para aislamiento multi-tenant
     * @returns Resultado con rutas de impresion y items sin asignar
     */
    async getRoutingForOrder(orderId: number, tenantId: number): Promise<RoutingResult> {
        // PERF-006: Seleccionar solo los campos necesarios para el enrutamiento en vez de relaciones completas
        const order = await prisma.order.findFirst({
            where: { id: orderId, tenantId },
            select: {
                id: true,
                table: {
                    select: {
                        areaId: true,
                        area: {
                            select: {
                                printerOverrides: {
                                    select: {
                                        categoryId: true,
                                        printerId: true,
                                        printer: { select: { name: true } }
                                    }
                                }
                            }
                        }
                    }
                },
                items: {
                    select: {
                        id: true,
                        productId: true,
                        quantity: true,
                        notes: true,
                        product: {
                            select: {
                                id: true,
                                name: true,
                                categoryId: true,
                                category: {
                                    select: {
                                        id: true,
                                        name: true,
                                        printerId: true,
                                        printer: { select: { id: true, name: true } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!order) {
            throw new NotFoundError(`Order ${orderId}`);
        }

        // 2. Obtener sobrecargas del area (si la orden tiene mesa asignada)
        const areaOverrides = order.table?.area?.printerOverrides ?? [];

        // Construir mapa de sobrecargas: categoryId -> printerId
        // categoryId = null significa "todas las categorias" para esta area
        const overrideMap = new Map<number | null, { printerId: number; printerName: string }>();
        for (const override of areaOverrides) {
            overrideMap.set(override.categoryId, {
                printerId: override.printerId,
                printerName: override.printer.name
            });
        }

        // Verificar si existe una sobrecarga general del area (categoryId = null)
        const areaWideOverride = overrideMap.get(null);

        // 3. Enrutar cada item a la impresora correspondiente segun la jerarquia de prioridades
        const routeMap = new Map<number, PrintRoute>();
        const unrouted: OrderItemForRouting[] = [];

        for (const item of order.items) {
            const categoryId = item.product.categoryId;
            let targetPrinter: { printerId: number; printerName: string } | null = null;

            // Prioridad 1: Sobrecarga especifica de la categoria para esta area
            if (overrideMap.has(categoryId)) {
                targetPrinter = overrideMap.get(categoryId)!;
            }
            // Prioridad 2: Sobrecarga general del area (aplica a todas las categorias)
            else if (areaWideOverride) {
                targetPrinter = areaWideOverride;
            }
            // Prioridad 3: Impresora por defecto de la categoria del producto
            else if (item.product.category.printerId && item.product.category.printer) {
                targetPrinter = {
                    printerId: item.product.category.printerId,
                    printerName: item.product.category.printer.name
                };
            }

            // Agregar a la ruta correspondiente o a la lista de no enrutados
            if (targetPrinter) {
                if (!routeMap.has(targetPrinter.printerId)) {
                    routeMap.set(targetPrinter.printerId, {
                        printerId: targetPrinter.printerId,
                        printerName: targetPrinter.printerName,
                        items: []
                    });
                }
                routeMap.get(targetPrinter.printerId)!.items.push(item);
            } else {
                unrouted.push(item);
            }
        }

        const result: RoutingResult = {
            routes: Array.from(routeMap.values()),
            unrouted
        };

        logger.debug('Print routing calculated', {
            orderId,
            areaId: order.table?.areaId,
            routeCount: result.routes.length,
            unroutedCount: result.unrouted.length
        });

        return result;
    }

    /**
     * Obtiene el enrutamiento para items especificos (para impresiones parciales como "agregar items").
     * Se usa cuando se agregan items a una orden existente y solo necesitan imprimirse los nuevos.
     *
     * @param tenantId - ID del tenant
     * @param items - Items a enrutar con productId y cantidad
     * @param areaId - ID del area opcional para buscar sobrecargas
     */
    async getRoutingForItems(
        tenantId: number,
        items: Array<{ productId: number; quantity: number; notes?: string }>,
        areaId?: number
    ): Promise<RoutingResult> {
        // Obtener productos con sus categorias e impresoras asignadas
        const productIds = items.map(i => i.productId);
        const products = await prisma.product.findMany({
            where: { id: { in: productIds }, tenantId },
            include: {
                category: {
                    include: { printer: true }
                }
            }
        });

        const productMap = new Map(products.map(p => [p.id, p]));

        // Obtener sobrecargas del area si se proporciono areaId
        let overrideMap = new Map<number | null, { printerId: number; printerName: string }>();
        let areaWideOverride: { printerId: number; printerName: string } | null = null;

        if (areaId) {
            // Verificar que el area pertenezca al tenant
            const area = await prisma.area.findFirst({ where: { id: areaId, tenantId } });
            if (!area) throw new NotFoundError('Area');

            const overrides = await prisma.areaPrinterOverride.findMany({
                where: { areaId, tenantId },
                include: { printer: true }
            });

            for (const override of overrides) {
                overrideMap.set(override.categoryId, {
                    printerId: override.printerId,
                    printerName: override.printer.name
                });
            }
            areaWideOverride = overrideMap.get(null) ?? null;
        }

        // Enrutar cada item usando la misma jerarquia de prioridades
        const routeMap = new Map<number, PrintRoute>();
        const unrouted: OrderItemForRouting[] = [];

        for (const item of items) {
            const product = productMap.get(item.productId);
            if (!product) continue;

            const categoryId = product.categoryId;
            let targetPrinter: { printerId: number; printerName: string } | null = null;

            // Prioridad 1: Sobrecarga especifica de categoria
            if (overrideMap.has(categoryId)) {
                targetPrinter = overrideMap.get(categoryId)!;
            }
            // Prioridad 2: Sobrecarga general del area
            else if (areaWideOverride) {
                targetPrinter = areaWideOverride;
            }
            // Prioridad 3: Impresora por defecto de la categoria
            else if (product.category.printerId && product.category.printer) {
                targetPrinter = {
                    printerId: product.category.printerId,
                    printerName: product.category.printer.name
                };
            }

            const routingItem: OrderItemForRouting = {
                id: 0, // Aun no persistido en base de datos
                productId: item.productId,
                quantity: item.quantity,
                notes: item.notes ?? null,
                product: {
                    id: product.id,
                    name: product.name,
                    categoryId: product.categoryId,
                    category: {
                        id: product.category.id,
                        name: product.category.name,
                        printerId: product.category.printerId
                    }
                }
            };

            if (targetPrinter) {
                if (!routeMap.has(targetPrinter.printerId)) {
                    routeMap.set(targetPrinter.printerId, {
                        printerId: targetPrinter.printerId,
                        printerName: targetPrinter.printerName,
                        items: []
                    });
                }
                routeMap.get(targetPrinter.printerId)!.items.push(routingItem);
            } else {
                unrouted.push(routingItem);
            }
        }

        return {
            routes: Array.from(routeMap.values()),
            unrouted
        };
    }

    /**
     * Obtiene toda la configuracion de enrutamiento de impresion (para la UI de administracion).
     * Retorna categorias con sus impresoras, areas con sus sobrecargas, y todas las impresoras.
     */
    async getRoutingConfiguration(tenantId: number) {
        const [categories, areas, printers] = await Promise.all([
            prisma.category.findMany({
                where: { tenantId },
                include: { printer: true },
                orderBy: { name: 'asc' }
            }),
            prisma.area.findMany({
                where: { tenantId },
                include: {
                    printerOverrides: {
                        include: { printer: true, category: true }
                    }
                },
                orderBy: { name: 'asc' }
            }),
            prisma.printer.findMany({
                where: { tenantId },
                orderBy: { name: 'asc' }
            })
        ]);

        return {
            categories: categories.map(c => ({
                id: c.id,
                name: c.name,
                printerId: c.printerId,
                printerName: c.printer?.name ?? null
            })),
            areas: areas.map(a => ({
                id: a.id,
                name: a.name,
                overrides: a.printerOverrides.map(o => ({
                    id: o.id,
                    categoryId: o.categoryId,
                    categoryName: o.category?.name ?? 'All Categories',
                    printerId: o.printerId,
                    printerName: o.printer.name
                }))
            })),
            printers: printers.map(p => ({
                id: p.id,
                name: p.name,
                connectionType: p.connectionType
            }))
        };
    }

    /**
     * Asigna la impresora por defecto a una categoria.
     * Todos los items de productos en esta categoria se imprimiran en esta impresora
     * a menos que exista una sobrecarga de area.
     */
    async setCategoryPrinter(tenantId: number, categoryId: number, printerId: number | null) {
        // Verificar que la categoria pertenezca al tenant
        const category = await prisma.category.findFirst({ where: { id: categoryId, tenantId } });
        if (!category) throw new NotFoundError('Category');

        // SEC-021: Verificar que la impresora pertenezca al mismo tenant
        if (printerId !== null) {
            const printer = await prisma.printer.findFirst({ where: { id: printerId, tenantId } });
            if (!printer) throw new NotFoundError('Printer not found or belongs to another tenant');
        }

        // Defensa en profundidad: updateMany garantiza que tenantId este en la clausula WHERE
        return prisma.category.updateMany({
            where: { id: categoryId, tenantId },
            data: { printerId }
        });
    }

    /**
     * Configura una sobrecarga de impresora para un area especifica.
     * Si categoryId es null, establece una sobrecarga general del area (todas las categorias van a una impresora).
     * Si categoryId tiene valor, solo esa categoria usa la impresora indicada en esa area.
     */
    async setAreaOverride(tenantId: number, areaId: number, categoryId: number | null, printerId: number) {
        // Verificar que el area pertenezca al tenant
        const area = await prisma.area.findFirst({ where: { id: areaId, tenantId } });
        if (!area) throw new NotFoundError('Area not found');

        // SEC-021: Verificar que la impresora pertenezca al mismo tenant
        const printer = await prisma.printer.findFirst({ where: { id: printerId, tenantId } });
        if (!printer) throw new NotFoundError('Printer not found or belongs to another tenant');

        // SEC-021: Verificar que la categoria pertenezca al mismo tenant (si se especifica)
        if (categoryId !== null) {
            const category = await prisma.category.findFirst({ where: { id: categoryId, tenantId } });
            if (!category) throw new NotFoundError('Category not found or belongs to another tenant');
        }

        // Prisma no genera correctamente el unique compuesto para campos nullable.
        // Usamos findFirst + create/update manual en vez de upsert.
        const existing = await prisma.areaPrinterOverride.findFirst({
            where: { areaId, categoryId, tenantId }
        });

        if (existing) {
            // Defensa en profundidad: updateMany garantiza que tenantId este en la clausula WHERE
            return prisma.areaPrinterOverride.updateMany({
                where: { id: existing.id, tenantId },
                data: { printerId }
            });
        } else {
            return prisma.areaPrinterOverride.create({
                data: { tenantId, areaId, categoryId, printerId }
            });
        }
    }

    /**
     * Elimina una sobrecarga de impresora para un area.
     * Los items de esa area volveran a usar la impresora por defecto de su categoria.
     */
    async removeAreaOverride(tenantId: number, areaId: number, categoryId: number | null) {
        // Verificar que el area pertenezca al tenant
        const area = await prisma.area.findFirst({ where: { id: areaId, tenantId } });
        if (!area) throw new NotFoundError('Area not found');

        // Buscar y eliminar la sobrecarga (unique compuesto con nullable requiere findFirst)
        const existing = await prisma.areaPrinterOverride.findFirst({
            where: { areaId, categoryId, tenantId }
        });

        if (existing) {
            // Defensa en profundidad: deleteMany garantiza que tenantId este en la clausula WHERE
            return prisma.areaPrinterOverride.deleteMany({
                where: { id: existing.id, tenantId }
            });
        }
        return null;
    }

    /**
     * Atajo para configurar una sobrecarga general de area.
     * Todas las categorias de esa area se imprimen en una unica impresora.
     */
    async setAreaWideOverride(tenantId: number, areaId: number, printerId: number) {
        return this.setAreaOverride(tenantId, areaId, null, printerId);
    }

    /**
     * Atajo para eliminar la sobrecarga general de area.
     * Cada categoria volvera a usar su impresora por defecto.
     */
    async removeAreaWideOverride(tenantId: number, areaId: number) {
        return this.removeAreaOverride(tenantId, areaId, null);
    }
}

export const printRoutingService = new PrintRoutingService();
