"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInvoice = generateInvoice;
exports.getByOrderId = getByOrderId;
exports.getByInvoiceNumber = getByInvoiceNumber;
exports.getAll = getAll;
const prisma_1 = require("../lib/prisma");
const errors_1 = require("../utils/errors");
/**
 * Generate unique invoice number
 * Format: YYYY-NNNNNNNN (Year + sequential number)
 */
async function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    // Get the last invoice number for this year
    const lastInvoice = await prisma_1.prisma.invoice.findFirst({
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
async function generateInvoice(data) {
    const { orderId, type = 'RECEIPT', clientName, clientTaxId } = data;
    // Check if order exists and is paid
    const order = await prisma_1.prisma.order.findUnique({
        where: { id: orderId },
        include: { invoice: true, client: true }
    });
    if (!order) {
        throw new errors_1.NotFoundError('Order');
    }
    // Check if invoice already exists for this order
    if (order.invoice) {
        throw new errors_1.ConflictError('Invoice already exists for this order');
    }
    // Validate payment status
    if (order.paymentStatus !== 'PAID') {
        throw new errors_1.ValidationError('Cannot generate invoice for unpaid order');
    }
    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();
    // Use client data from order if not provided
    const finalClientName = clientName || order.client?.name || null;
    const finalClientTaxId = clientTaxId || order.client?.taxId || null;
    // Create invoice
    const invoice = await prisma_1.prisma.invoice.create({
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
async function getByOrderId(orderId) {
    const invoice = await prisma_1.prisma.invoice.findUnique({
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
        throw new errors_1.NotFoundError('Invoice');
    }
    return invoice;
}
/**
 * Get invoice by invoice number
 */
async function getByInvoiceNumber(invoiceNumber) {
    const invoice = await prisma_1.prisma.invoice.findUnique({
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
        throw new errors_1.NotFoundError('Invoice');
    }
    return invoice;
}
/**
 * Get all invoices with optional filters
 */
async function getAll(filters = {}) {
    const { type, startDate, endDate } = filters;
    const where = {};
    if (type) {
        where.type = type;
    }
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate)
            where.createdAt.gte = startDate;
        if (endDate)
            where.createdAt.lte = endDate;
    }
    const invoices = await prisma_1.prisma.invoice.findMany({
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
//# sourceMappingURL=invoice.service.js.map