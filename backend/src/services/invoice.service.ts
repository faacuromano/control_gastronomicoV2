import { prisma } from '../lib/prisma';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';

interface GenerateInvoiceData {
    orderId: number;
    type?: 'RECEIPT' | 'INVOICE_B' | undefined;
    clientName?: string | undefined;
    clientTaxId?: string | undefined;
}

/**
 * Generate unique invoice number
 * Format: YYYY-NNNNNNNN (Year + sequential number)
 */
async function generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    
    // Get the last invoice number for this year
    const lastInvoice = await prisma.invoice.findFirst({
        where: {
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

    return `${year}-${nextNumber.toString().padStart(8, '0')}`;
}

/**
 * Generate invoice for an order
 */
export async function generateInvoice(data: GenerateInvoiceData) {
    const { orderId, type = 'RECEIPT', clientName, clientTaxId } = data;

    // Check if order exists and is paid
    const order = await prisma.order.findUnique({
        where: { id: orderId },
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

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Use client data from order if not provided
    const finalClientName = clientName || order.client?.name || null;
    const finalClientTaxId = clientTaxId || order.client?.taxId || null;

    // Create invoice
    const invoice = await prisma.invoice.create({
        data: {
            orderId,
            invoiceNumber,
            type,
            clientName: finalClientName,
            clientTaxId: finalClientTaxId,
            subtotal: order.subtotal,
            tax: 0, // TODO: Calculate based on InvoiceType
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

    return invoice;
}

/**
 * Get invoice by order ID
 */
export async function getByOrderId(orderId: number) {
    const invoice = await prisma.invoice.findUnique({
        where: { orderId },
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
export async function getByInvoiceNumber(invoiceNumber: string) {
    const invoice = await prisma.invoice.findUnique({
        where: { invoiceNumber },
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
export async function getAll(filters: GetAllFilters = {}) {
    const { type, startDate, endDate } = filters;

    const where: any = {};

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
        orderBy: { createdAt: 'desc' }
    });

    return invoices;
}
