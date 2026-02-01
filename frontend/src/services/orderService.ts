
import api from '../lib/api';
import { offlineDb, type PendingOrderItem } from '../lib/offlineDb';
import { isOnline } from '../lib/connectivity';

/**
 * Order item as returned from the API
 */
export interface OrderItemResponse {
    id: number;
    productId: number;
    quantity: number;
    unitPrice: string; // Decimal as string from Prisma
    notes?: string | null;
    product?: {
        id: number;
        name: string;
        price: string;
    };
}

/**
 * Order as returned from the API
 */
export interface OrderResponse {
    id: number;
    orderNumber: number;
    channel: string;
    status: string;
    paymentStatus: string;
    subtotal: string;
    total: string;
    createdAt: string;
    closedAt?: string | null;
    items: OrderItemResponse[];
    // Offline fields
    tempId?: string;
    isOffline?: boolean;
}

export interface CreateOrderData {
    items: {
        productId: number;
        quantity: number;
        notes?: string;
        modifiers?: { id: number; price: number }[];
        removedIngredientIds?: number[];
    }[];
    paymentMethod?: string;
    payments?: { method: string; amount: number }[];
    channel?: 'POS' | 'DELIVERY_APP' | 'WAITER_APP' | 'QR_MENU';
    tableId?: number;
    clientId?: number;
    deliveryData?: {
        address: string;
        notes?: string;
        phone: string;
        name: string;
        driverId?: number;
    };
    discount?: number;
}

export const orderService = {
    /**
     * Create order - with offline fallback
     * If online: sends to API
     * If offline: stores in IndexedDB queue
     */
    create: async (data: CreateOrderData): Promise<OrderResponse> => {
        // Try online first
        if (isOnline()) {
            try {
                const response = await api.post('/orders', data);
                return response.data.data;
            } catch (error: any) {
                // If network error, fall through to offline mode
                if (!error.response) {
                    console.warn('[OrderService] Network error, falling back to offline mode');
                } else {
                    throw error; // Re-throw API errors (validation, etc.)
                }
            }
        }

        // Offline mode: store in IndexedDB
        console.log('[OrderService] Creating order offline');
        const tempId = offlineDb.generateTempId();
        
        const pendingOrder = {
            tempId,
            items: data.items.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                notes: item.notes,
                modifiers: item.modifiers,
                removedIngredientIds: item.removedIngredientIds
            } as PendingOrderItem)),
            channel: data.channel || 'POS',
            tableId: data.tableId,
            clientId: data.clientId,
            createdAt: new Date(),
            status: 'pending' as const
        };

        await offlineDb.pendingOrders.add(pendingOrder);

        // Return a fake response for UI
        const offlineResponse: OrderResponse = {
            id: -1, // Negative ID indicates offline
            orderNumber: 0, // Will be assigned on sync
            channel: data.channel || 'POS',
            status: 'PENDING',
            paymentStatus: 'PENDING',
            subtotal: '0',
            total: '0',
            createdAt: new Date().toISOString(),
            items: data.items.map((item, index) => ({
                id: -(index + 1),
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: '0',
                notes: item.notes
            })),
            tempId,
            isOffline: true
        };

        return offlineResponse;
    },
    
    getRecent: async (): Promise<OrderResponse[]> => {
        const response = await api.get('/orders');
        return response.data.data;
    },

    getOrderByTable: async (tableId: number): Promise<OrderResponse | null> => {
        const response = await api.get(`/orders/table/${tableId}`);
        return response.data.data;
    },

    addItemsToOrder: async (orderId: number, items: CreateOrderData['items']): Promise<OrderResponse> => {
        const response = await api.post(`/orders/${orderId}/items`, { items });
        return response.data.data;
    },

    getActiveOrders: async (): Promise<OrderResponse[]> => {
        const response = await api.get('/orders/kds');
        return response.data.data;
    },

    updateStatus: async (orderId: number, status: string): Promise<OrderResponse> => {
        const response = await api.patch(`/orders/${orderId}/status`, { status });
        return response.data.data;
    },

    updateItemStatus: async (itemId: number, status: string): Promise<any> => {
        const response = await api.patch(`/orders/items/${itemId}/status`, { status });
        return response.data.data;
    },

    // Delivery Methods
    getDeliveryOrders: async (): Promise<OrderResponse[]> => {
        const response = await api.get('/delivery/orders');
        return response.data.data;
    },

    assignDriver: async (orderId: number, driverId: number): Promise<OrderResponse> => {
        const response = await api.patch(`/delivery/orders/${orderId}/assign`, { driverId });
        return response.data.data;
    },

    /**
     * Add payments to an existing order (used for table checkout).
     * Calls POST /orders/:id/payments
     */
    addPayments: async (orderId: number, payments: { method: string; amount: number }[], closeOrder = true): Promise<any> => {
        const response = await api.post(`/orders/${orderId}/payments`, { payments, closeOrder });
        return response.data.data;
    },

    /**
     * Mark all items in an order as SERVED (for table orders when kitchen marks as ready)
     */
    markAllItemsServed: async (orderId: number): Promise<void> => {
        await api.post(`/orders/${orderId}/items/served`);
    }
};

