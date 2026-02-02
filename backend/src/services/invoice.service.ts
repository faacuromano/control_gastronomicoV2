/**
 * @fileoverview Servicio de Facturacion
 *
 * Genera y consulta comprobantes fiscales (tickets y facturas) asociados a ordenes.
 * Usa numeracion secuencial atomica con formato YYYY-NNNNNNNN para evitar
 * colisiones en entornos concurrentes.
 *
 * La generacion del numero de factura se realiza dentro de una transaccion
 * con logica de reintentos para manejar condiciones de carrera (race conditions)
 * cuando multiples cajeros facturan simultaneamente.
 *
 * @module services/invoice.service
 */

import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import { getBusinessDate } from '../utils/businessDate';

interface GenerateInvoiceData {
    orderId: number;
    type?: 'RECEIPT' | 'INVOICE_B' | undefined;
    clientName?: string | undefined;
    clientTaxId?: string | undefined;
}

/**
 * Genera una factura/ticket para una orden.
 *
 * Utiliza transaccion con reintentos para prevenir condiciones de carrera
 * en la numeracion de facturas. El numero se genera dentro de la transaccion
 * para garantizar atomicidad.
 *
 * Flujo:
 * 1. Valida que la orden exista, no tenga factura previa y este pagada
 * 2. Calcula impuestos segun la tasa configurada en TenantConfig
 * 3. Genera numero secuencial dentro de transaccion con reintentos
 * 4. Crea el registro de factura con todos los datos
 */
export async function generateInvoice(tenantId: number, data: GenerateInvoiceData) {
    const { orderId, type = 'RECEIPT', clientName, clientTaxId } = data;

    // Validar la orden ANTES de la transaccion (lectura segura fuera del tx)
    const order = await prisma.order.findFirst({
        where: { id: orderId, tenantId },
        include: { invoice: true, client: true }
    });

    if (!order) {
        throw new NotFoundError('Order');
    }

    // Verificar que no exista ya una factura para esta orden (idempotencia)
    if (order.invoice) {
        throw new ConflictError('Invoice already exists for this order');
    }

    // Solo se puede facturar una orden completamente pagada
    if (order.paymentStatus !== 'PAID') {
        throw new ValidationError('Cannot generate invoice for unpaid order');
    }

    // Usar datos del cliente de la orden si no se proporcionan explicitamente
    const finalClientName = clientName || order.client?.name || null;
    const finalClientTaxId = clientTaxId || order.client?.taxId || null;

    // Calcular impuesto segun la tasa configurada en TenantConfig
    const tenantConfig = await prisma.tenantConfig.findFirst({
        where: { tenantId },
        select: { defaultTaxRate: true }
    });
    const taxRate = Number(tenantConfig?.defaultTaxRate || 0);
    if (taxRate < 0 || taxRate > 100) {
        throw new ValidationError(`Invalid tax rate: ${taxRate}%. Must be between 0 and 100.`);
    }
    const subtotal = Number(order.subtotal);
    // El impuesto esta incluido en el total: subtotal = total / (1 + tasa), impuesto = total - subtotal
    // Si la tasa es 0, el impuesto es 0
    const tax = taxRate > 0
        ? Math.round((subtotal - subtotal / (1 + taxRate / 100)) * 100) / 100
        : 0;

    // Bucle de reintentos para manejar colisiones en el numero de factura.
    // La restriccion @@unique([tenantId, invoiceNumber]) causa errores P2002 en colision.
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            return await prisma.$transaction(async (tx) => {
                // Generar numero de factura DENTRO de la transaccion para atomicidad
                // Formato: YYYY-NNNNNNNN (Anio + numero secuencial)
                // BIZ-016 FIX: Usar fecha de negocio para evitar problemas en el limite de zona horaria
                const year = getBusinessDate().getFullYear();

                const lastInvoice = await tx.invoice.findFirst({
                    where: {
                        tenantId,
                        invoiceNumber: {
                            startsWith: `${year}-`
                        }
                    },
                    orderBy: { invoiceNumber: 'desc' }
                });

                let nextNumber = 1;
                if (lastInvoice) {
                    const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-')[1] || '0');
                    nextNumber = lastNumber + 1;
                }

                const invoiceNumber = `${year}-${nextNumber.toString().padStart(8, '0')}`;

                // Crear la factura con el numero generado
                // PERF-014: Usar select en lugar de include completo para una respuesta mas liviana
                return await tx.invoice.create({
                    data: {
                        tenantId,
                        orderId,
                        invoiceNumber,
                        type,
                        clientName: finalClientName,
                        clientTaxId: finalClientTaxId,
                        subtotal: order.subtotal,
                        tax,
                        total: order.total
                    },
                    include: {
                        order: {
                            select: {
                                id: true,
                                orderNumber: true,
                                total: true,
                                subtotal: true,
                                items: {
                                    select: {
                                        id: true,
                                        quantity: true,
                                        unitPrice: true,
                                        product: { select: { id: true, name: true } }
                                    }
                                },
                                payments: {
                                    select: { id: true, method: true, amount: true }
                                }
                            }
                        }
                    }
                });
            });
        } catch (error: unknown) {
            // Reintentar solo en caso de violacion de constraint unico (P2002)
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && attempt < MAX_RETRIES - 1) {
                continue;
            }
            throw error;
        }
    }

    throw new ConflictError('Failed to generate invoice after maximum retries');
}

/**
 * Obtiene una factura por el ID de la orden, incluyendo items, pagos y cliente.
 */
export async function getByOrderId(orderId: number, tenantId: number) {
    const invoice = await prisma.invoice.findFirst({
        where: { orderId, tenantId },
        include: {
            order: {
                include: {
                    items: {
                        include: { product: true }
                    },
                    payments: true,
                    client: true
                }
            }
        }
    });

    if (!invoice) {
        throw new NotFoundError('Invoice');
    }

    return invoice;
}

/**
 * Obtiene una factura por su numero de comprobante.
 * El numero es unico por tenant (constraint @@unique([tenantId, invoiceNumber])).
 */
export async function getByInvoiceNumber(invoiceNumber: string, tenantId: number) {
    // FIX: El numero de factura es unico por Tenant. Usar findFirst con tenantId.
    const invoice = await prisma.invoice.findFirst({
        where: { invoiceNumber, tenantId },
        include: {
            order: {
                include: {
                    items: {
                        include: { product: true }
                    },
                    payments: true,
                    client: true
                }
            }
        }
    });

    if (!invoice) {
        throw new NotFoundError('Invoice');
    }

    return invoice;
}

interface GetAllFilters {
    type?: 'RECEIPT' | 'INVOICE_B';
    startDate?: Date;
    endDate?: Date;
}

/**
 * Lista todas las facturas del tenant con filtros opcionales por tipo y rango de fechas.
 * Limitado a 200 resultados para evitar respuestas excesivamente grandes.
 */
export async function getAll(tenantId: number, filters: GetAllFilters = {}) {
    const { type, startDate, endDate } = filters;

    const where: Prisma.InvoiceWhereInput = { tenantId };

    if (type) {
        where.type = type;
    }

    if (startDate || endDate) {
        where.createdAt = {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
        };
    }

    const invoices = await prisma.invoice.findMany({
        where,
        include: {
            order: {
                select: {
                    orderNumber: true,
                    total: true,
                    client: { select: { name: true } }
                }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: 200
    });

    return invoices;
}
