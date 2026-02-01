import { prisma } from '../lib/prisma';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';

interface GenerateInvoiceData {
    orderId: number;
    type?: 'RECEIPT' | 'INVOICE_B' | undefined;
    clientName?: string | undefined;
    clientTaxId?: string | undefined;
}

/**
 * Generate invoice for an order
 *
 * Uses transaction with retry logic to prevent invoice number race conditions.
 * The invoice number is generated inside the transaction to ensure atomicity.
 */
export async function generateInvoice(tenantId: number, data: GenerateInvoiceData) {
    const { orderId, type = 'RECEIPT', clientName, clientTaxId } = data;

    // Validate order BEFORE transaction (read-only, safe outside)
    const order = await prisma.order.findFirst({
        where: { id: orderId, tenantId },
        include: { invoice: true, client: true }
    });

    if (!order) {
        throw new NotFoundError('Order');
    }

    // Check if invoice already exists for this order
    if (order.invoice) {
        throw new ConflictError('Invoice already exists for this order');
    }

    // Validate payment status
    if (order.paymentStatus !== 'PAID') {
        throw new ValidationError('Cannot generate invoice for unpaid order');
    }

    // Use client data from order if not provided
    const finalClientName = clientName || order.client?.name || null;
    const finalClientTaxId = clientTaxId || order.client?.taxId || null;

    // Calculate tax based on tenant config
    const tenantConfig = await prisma.tenantConfig.findFirst({
        where: { tenantId },
        select: { defaultTaxRate: true }
    });
    const taxRate = Number(tenantConfig?.defaultTaxRate || 0);
    const subtotal = Number(order.subtotal);
    // Tax is included in total: subtotal = total / (1 + rate), tax = total - subtotal
    // If rate is 0, tax is 0
    const tax = taxRate > 0
        ? Math.round((subtotal - subtotal / (1 + taxRate / 100)) * 100) / 100
        : 0;

    // Retry loop for race condition on invoice number
    // The @@unique([tenantId, invoiceNumber]) constraint will cause P2002 errors on collision
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            return await prisma.$transaction(async (tx) => {
                // Generate invoice number INSIDE transaction for atomicity
                // Format: YYYY-NNNNNNNN (Year + sequential number)
                const year = new Date().getFullYear();

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

                // Create invoice with generated number
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
                            include: {
                                items: {
                                    include: { product: true }
                                },
                                payments: true
                            }
                        }
                    }
                });
            });
        } catch (error: any) {
            // Retry on unique constraint violation (P2002)
            if (error.code === 'P2002' && attempt < MAX_RETRIES - 1) {
                continue;
            }
            throw error;
        }
    }

    throw new Error('Failed to generate invoice after maximum retries');
}

/**
 * Get invoice by order ID
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
 * Get invoice by invoice number
 */
export async function getByInvoiceNumber(invoiceNumber: string, tenantId: number) {
    // FIX: Invoice number is unique per Tenant. Use findFirst.
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
 * Get all invoices with optional filters
 */
export async function getAll(tenantId: number, filters: GetAllFilters = {}) {
    const { type, startDate, endDate } = filters;

    const where: any = { tenantId };

    if (type) {
        where.type = type;
    }

    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
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
