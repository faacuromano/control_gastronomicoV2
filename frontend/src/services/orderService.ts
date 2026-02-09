
import api from '../lib/api';
import { offlineDb, type PendingOrderItem, type PendingPayment } from '../lib/offlineDb';
import { isOnline } from '../lib/connectivity';
import { useCashStore } from '../store/cash.store';

/**
 * Order item as returned from the API
 */
export interface OrderItemModifier {
    id: number;
    modifierOptionId: number;
    name?: string;
    priceCharged: string;
}

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
    modifiers?: OrderItemModifier[];
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

// Double-click guard: prevents duplicate order creation
let _creatingOrder = false;

export const orderService = {
    /**
     * Create order - with offline fallback
     * If online: sends to API
     * If offline: stores in IndexedDB queue
     */
    create: async (data: CreateOrderData): Promise<OrderResponse> => {
        if (_creatingOrder) {
            throw new Error('Ya se está procesando una orden. Por favor espera.');
        }
        _creatingOrder = true;
        try {
            return await orderService._createInternal(data);
        } finally {
            _creatingOrder = false;
        }
    },

    /** @internal Actual creation logic, guarded by _creatingOrder flag */
    _createInternal: async (data: CreateOrderData): Promise<OrderResponse> => {
        // Try online first
        if (isOnline()) {
            try {
                const response = await api.post('/orders', data);
                return response.data.data;
            } catch (error: unknown) {
                // If network error, fall through to offline mode
                if (!(error && typeof error === 'object' && 'response' in error && (error as Record<string, unknown>).response)) {
                    console.warn('[OrderService] Network error, falling back to offline mode');
                } else {
                    throw error; // Re-throw API errors (validation, etc.)
                }
            }
        }

        // Offline mode: store in IndexedDB
        console.log('[OrderService] Creating order offline');
        const tempId = offlineDb.generateTempId();
        
        // Get the persisted shift ID so backend can associate the order
        const currentShift = useCashStore.getState().shift;

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
            shiftId: currentShift?.id,
            createdAt: new Date(),
            status: 'pending' as const
        };

        await offlineDb.pendingOrders.add(pendingOrder);

        // Also queue any payments included with the order
        if (data.payments && data.payments.length > 0) {
            for (const payment of data.payments) {
                await offlineDb.pendingPayments.add({
                    tempOrderId: tempId,
                    method: payment.method as PendingPayment['method'],
                    amount: payment.amount,
                    createdAt: new Date(),
                    status: 'pending'
                });
            }
        }

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

    /**
     * Obtiene ordenes activas para el KDS.
     * @param stationCode - Opcional. Filtrar por estacion KDS (ej: 'KITCHEN', 'BAR')
     */
    getActiveOrders: async (stationCode?: string): Promise<OrderResponse[]> => {
        const params = stationCode ? { station: stationCode } : {};
        const response = await api.get('/orders/kds', { params });
        return response.data.data;
    },

    updateStatus: async (orderId: number, status: string): Promise<OrderResponse> => {
        const response = await api.patch(`/orders/${orderId}/status`, { status });
        return response.data.data;
    },

    updateItemStatus: async (itemId: number, status: string): Promise<OrderItemResponse> => {
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
     * Calls POST /orders/:id/payments - with offline fallback.
     */
    addPayments: async (orderId: number, payments: { method: string; amount: number }[], closeOrder = true): Promise<OrderResponse> => {
        // Try online first
        if (isOnline()) {
            try {
                const response = await api.post(`/orders/${orderId}/payments`, { payments, closeOrder });
                return response.data.data;
            } catch (error: unknown) {
                // If network error, fall through to offline mode
                if (error && typeof error === 'object' && 'response' in error && (error as Record<string, unknown>).response) {
                    throw error; // Re-throw API errors (validation, etc.)
                }
                console.warn('[OrderService] Network error on payment, falling back to offline mode');
            }
        }

        // Offline mode: queue payments in IndexedDB
        console.log('[OrderService] Queueing payment offline for order', orderId);
        for (const payment of payments) {
            await offlineDb.pendingPayments.add({
                // real_ prefix tells sync that this references an existing server order ID
                tempOrderId: `real_${orderId}`,
                method: payment.method as PendingPayment['method'],
                amount: payment.amount,
                createdAt: new Date(),
                status: 'pending'
            });
        }

        // Return a synthetic response so UI can continue
        return {
            id: orderId,
            orderNumber: 0,
            channel: 'POS',
            status: 'PENDING',
            paymentStatus: 'PENDING',
            subtotal: '0',
            total: '0',
            createdAt: new Date().toISOString(),
            items: [],
            isOffline: true
        };
    },

    /**
     * Mark all items in an order as SERVED (for table orders when kitchen marks as ready)
     */
    markAllItemsServed: async (orderId: number): Promise<void> => {
        await api.post(`/orders/${orderId}/items/served`);
    }
};

