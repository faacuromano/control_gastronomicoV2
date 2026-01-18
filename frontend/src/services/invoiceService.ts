import api from '../lib/api';

export interface Invoice {
    id: number;
    orderId: number;
    invoiceNumber: string;
    type: 'RECEIPT' | 'INVOICE_B';
    clientName: string | null;
    clientTaxId: string | null;
    subtotal: number;
    tax: number;
    total: number;
    createdAt: string;
    order?: {
        orderNumber: number;
        total: number;
        items?: Array<{
            id: number;
            quantity: number;
            unitPrice: number;
            product: {
                name: string;
            };
        }>;
        payments?: Array<{
            id: number;
            amount: number;
            method: string;
        }>;
        client?: {
            name: string;
        };
    };
}

export interface GenerateInvoiceRequest {
    orderId: number;
    type?: 'RECEIPT' | 'INVOICE_B';
    clientName?: string;
    clientTaxId?: string;
}

export interface InvoiceFilters {
    type?: 'RECEIPT' | 'INVOICE_B';
    startDate?: string;
    endDate?: string;
}

export const invoiceService = {
    /**
     * Generate invoice for a paid order
     */
    generate: async (data: GenerateInvoiceRequest): Promise<Invoice> => {
        const response = await api.post('/invoices', data);
        return response.data.data;
    },

    /**
     * Get invoice by order ID
     */
    getByOrderId: async (orderId: number): Promise<Invoice> => {
        const response = await api.get(`/invoices/order/${orderId}`);
        return response.data.data;
    },

    /**
     * Get invoice by invoice number
     */
    getByNumber: async (invoiceNumber: string): Promise<Invoice> => {
        const response = await api.get(`/invoices/${invoiceNumber}`);
        return response.data.data;
    },

    /**
     * Get all invoices with optional filters
     */
    getAll: async (filters?: InvoiceFilters): Promise<Invoice[]> => {
        const params = new URLSearchParams();
        if (filters?.type) params.append('type', filters.type);
        if (filters?.startDate) params.append('startDate', filters.startDate);
        if (filters?.endDate) params.append('endDate', filters.endDate);
        
        const response = await api.get(`/invoices?${params.toString()}`);
        return response.data.data;
    },

    /**
     * Check if order already has an invoice
     */
    hasInvoice: async (orderId: number): Promise<boolean> => {
        try {
            await api.get(`/invoices/order/${orderId}`);
            return true;
        } catch {
            return false;
        }
    }
};
