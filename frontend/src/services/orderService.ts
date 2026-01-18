
import api from '../lib/api';

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
}

export const orderService = {
    create: async (data: CreateOrderData): Promise<OrderResponse> => {
        const response = await api.post('/orders', data);
        return response.data.data;
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
        const response = await api.patch(`/delivery/${orderId}/assign`, { driverId });
        return response.data.data;
    },

    /**
     * Mark all items in an order as SERVED (for table orders when kitchen marks as ready)
     */
    markAllItemsServed: async (orderId: number): Promise<void> => {
        await api.post(`/orders/${orderId}/items/served`);
    }
};

