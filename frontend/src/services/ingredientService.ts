import api from '../lib/api';

export interface Ingredient {
    id: number;
    name: string;
    unit: string;
    stock: number;
    minStock: number;
    cost: number;
}

export interface StockMovement {
    id: number;
    ingredientId: number;
    type: 'PURCHASE' | 'SALE' | 'WASTE' | 'ADJUSTMENT';
    quantity: number;
    reason?: string;
    createdAt: string;
}

export const ingredientService = {
    getAll: async () => {
        const response = await api.get<{ success: boolean; data: Ingredient[] }>('/ingredients');
        return response.data.data;
    },

    getHistory: async (id: number) => {
        const response = await api.get<{ success: boolean; data: StockMovement[] }>(`/stock-movements?ingredientId=${id}`);
        return response.data.data;
    },

    create: async (data: Omit<Ingredient, 'id'>) => {
        const response = await api.post<{ success: boolean; data: Ingredient }>('/ingredients', data);
        return response.data.data;
    },

    update: async (id: number, data: Partial<Ingredient>) => {
        const response = await api.put<{ success: boolean; data: Ingredient }>(`/ingredients/${id}`, data);
        return response.data.data;
    },

    delete: async (id: number) => {
        await api.delete(`/ingredients/${id}`);
    },
    
    updateStock: async (id: number, quantity: number, type: 'ADD' | 'SUBTRACT' | 'SET') => {
        const response = await api.patch<{ success: boolean; data: Ingredient }>(`/ingredients/${id}/stock`, { quantity, type });
        return response.data.data;
    }
};
