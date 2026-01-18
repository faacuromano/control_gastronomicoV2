import api from '../lib/api';

export interface Supplier {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  taxId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierData {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
}

export interface UpdateSupplierData {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
}

class SupplierService {
  async getAll(): Promise<Supplier[]> {
    const response = await api.get('/suppliers');
    return response.data.data;
  }

  async getById(id: number): Promise<Supplier> {
    const response = await api.get(`/suppliers/${id}`);
    return response.data.data;
  }

  async create(data: CreateSupplierData): Promise<Supplier> {
    const response = await api.post('/suppliers', data);
    return response.data.data;
  }

  async update(id: number, data: UpdateSupplierData): Promise<Supplier> {
    const response = await api.put(`/suppliers/${id}`, data);
    return response.data.data;
  }

  async delete(id: number): Promise<void> {
    await api.delete(`/suppliers/${id}`);
  }
}

export const supplierService = new SupplierService();
