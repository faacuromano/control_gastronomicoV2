import api from '../lib/api';

export interface Product {
    id: number;
    name: string;
    description?: string | null;
    price: number;
    image?: string | null;
    categoryId: number;
    productType: 'SIMPLE' | 'COMBO';
    isActive: boolean;
    isStockable: boolean;
    category?: { name: string };
    ingredients?: {
        ingredient: {
            id: number;
            name: string;
            stock: number;
            unit: string;
        };
        quantity: number;
        ingredientId: number;
    }[];
    modifiers?: {
        modifierGroupId: number;
        modifierGroup: {
            id: number;
            name: string;
            minSelection: number;
            maxSelection: number;
            options: {
                id: number;
                name: string;
                priceOverlay: number;
                isActive: boolean;
            }[];
        }
    }[];
}

export const productService = {
    getAll: async (categoryId?: number, isActive?: boolean) => {
        const params: any = {};
        if (categoryId) params.categoryId = categoryId;
        if (isActive !== undefined) params.isActive = isActive;
        const response = await api.get('/products', { params });
        return response.data.data.map((p: any) => ({ ...p, price: Number(p.price) }));
    },

    getById: async (id: number) => {
        const response = await api.get(`/products/${id}`);
        return { ...response.data.data, price: Number(response.data.data.price) };
    },

    create: async (data: any) => {
        const response = await api.post('/products', data);
        return { ...response.data.data, price: Number(response.data.data.price) };
    },

    update: async (id: number, data: any) => {
        const response = await api.put(`/products/${id}`, data);
        return { ...response.data.data, price: Number(response.data.data.price) };
    },

    delete: async (id: number) => {
        const response = await api.delete(`/products/${id}`);
        return response.data.data;
    },

    toggleActive: async (id: number) => {
        const response = await api.patch(`/products/${id}/toggle`);
        return response.data.data;
    }
};
