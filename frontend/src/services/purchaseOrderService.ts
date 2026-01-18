import api from '../lib/api';

export interface PurchaseOrderItem {
  id: number;
  ingredientId: number;
  ingredient: {
    id: number;
    name: string;
    unit: string;
  };
  quantity: number;
  unitCost: number;
}

export interface PurchaseOrder {
  id: number;
  orderNumber: number;
  supplierId: number;
  supplier: {
    id: number;
    name: string;
  };
  status: 'PENDING' | 'ORDERED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';
  subtotal: number;
  total: number;
  notes?: string | null;
  orderedAt: string;
  receivedAt?: string | null;
  items: PurchaseOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderListItem {
  id: number;
  orderNumber: number;
  supplier: { id: number; name: string };
  status: PurchaseOrder['status'];
  subtotal: number;
  total: number;
  orderedAt: string;
  receivedAt?: string | null;
  _count: { items: number };
}

export interface CreatePurchaseOrderData {
  supplierId: number;
  notes?: string;
  items: {
    ingredientId: number;
    quantity: number;
    unitCost: number;
  }[];
}

class PurchaseOrderService {
  async getAll(status?: string): Promise<PurchaseOrderListItem[]> {
    const params = status ? { status } : {};
    const response = await api.get('/purchase-orders', { params });
    return response.data.data;
  }

  async getById(id: number): Promise<PurchaseOrder> {
    const response = await api.get(`/purchase-orders/${id}`);
    return response.data.data;
  }

  async create(data: CreatePurchaseOrderData): Promise<PurchaseOrder> {
    const response = await api.post('/purchase-orders', data);
    return response.data.data;
  }

  async updateStatus(id: number, status: PurchaseOrder['status']): Promise<PurchaseOrder> {
    const response = await api.patch(`/purchase-orders/${id}/status`, { status });
    return response.data.data;
  }

  async receive(id: number): Promise<PurchaseOrder> {
    const response = await api.post(`/purchase-orders/${id}/receive`);
    return response.data.data;
  }

  async cancel(id: number): Promise<PurchaseOrder> {
    const response = await api.post(`/purchase-orders/${id}/cancel`);
    return response.data.data;
  }

  async delete(id: number): Promise<void> {
    await api.delete(`/purchase-orders/${id}`);
  }
}

export const purchaseOrderService = new PurchaseOrderService();
