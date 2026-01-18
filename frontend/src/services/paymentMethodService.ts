import api from '../lib/api';

export interface PaymentMethodConfig {
  id: number;
  code: string;
  name: string;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface CreatePaymentMethodData {
  code: string;
  name: string;
  icon?: string;
  isActive?: boolean;
  sortOrder?: number;
}

class PaymentMethodService {
  async getAll(): Promise<PaymentMethodConfig[]> {
    const response = await api.get('/payment-methods');
    return response.data.data;
  }

  async getActive(): Promise<PaymentMethodConfig[]> {
    const response = await api.get('/payment-methods/active');
    return response.data.data;
  }

  async create(data: CreatePaymentMethodData): Promise<PaymentMethodConfig> {
    const response = await api.post('/payment-methods', data);
    return response.data.data;
  }

  async update(id: number, data: Partial<CreatePaymentMethodData>): Promise<PaymentMethodConfig> {
    const response = await api.put(`/payment-methods/${id}`, data);
    return response.data.data;
  }

  async toggleActive(id: number): Promise<PaymentMethodConfig> {
    const response = await api.patch(`/payment-methods/${id}/toggle`);
    return response.data.data;
  }

  async delete(id: number): Promise<void> {
    await api.delete(`/payment-methods/${id}`);
  }

  async seedDefaults(): Promise<void> {
    await api.post('/payment-methods/seed');
  }
}

export const paymentMethodService = new PaymentMethodService();
