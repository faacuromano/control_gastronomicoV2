import api from '../lib/api';

export interface Category {
    id: number;
    name: string;
    printerId?: number | null;
    activeProductsCount?: number;
    totalProductsCount?: number;
}

export const categoryService = {
    getAll: async () => {
        const response = await api.get('/categories');
        return response.data.data;
    },

    create: async (data: { name: string; printerId?: number }) => {
        const response = await api.post('/categories', data);
        return response.data.data;
    },

    delete: async (id: number) => {
        const response = await api.delete(`/categories/${id}`);
        return response.data.data;
    },

    update: async (id: number, data: Partial<Category>) => {
        const response = await api.put(`/categories/${id}`, data);
        return response.data.data;
    }
};
