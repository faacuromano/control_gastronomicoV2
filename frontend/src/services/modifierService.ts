import api from '../lib/api';

export interface ModifierOption {
    id: number;
    name: string;
    priceOverlay: number;
    ingredientId?: number | null;
    qtyUsed?: number;
    ingredient?: { name: string; unit: string };
}

export interface ModifierGroup {
    id: number;
    name: string;
    minSelection: number;
    maxSelection: number;
    options: ModifierOption[];
}

interface ModifierGroupApiResponse {
    id: number;
    name: string;
    minSelection: number;
    maxSelection: number;
    options: Array<{ id: number; name: string; priceOverlay: string; ingredientId?: number | null; qtyUsed?: number; ingredient?: { name: string; unit: string } }>;
}

export const modifierService = {
    getAll: async (): Promise<ModifierGroup[]> => {
         const response = await api.get('/modifiers/groups');
         return response.data.data.map((g: ModifierGroupApiResponse) => ({
             ...g,
             options: g.options.map((o) => ({
                 ...o,
                 priceOverlay: Number(o.priceOverlay)
             }))
         }));
    },

    createGroup: async (data: { name: string; minSelection: number; maxSelection: number }) => {
        const response = await api.post('/modifiers/groups', data);
        return response.data.data;
    },

    updateGroup: async (id: number, data: { name: string; minSelection: number; maxSelection: number }) => {
        const response = await api.put(`/modifiers/groups/${id}`, data);
        return response.data.data;
    },

    deleteGroup: async (id: number) => {
        const response = await api.delete(`/modifiers/groups/${id}`);
        return response.data;
    },

    addOption: async (groupId: number, data: { name: string; priceOverlay: number; ingredientId?: number; qtyUsed?: number }) => {
        const response = await api.post(`/modifiers/groups/${groupId}/options`, data);
        return {
             ...response.data.data,
             priceOverlay: Number(response.data.data.priceOverlay)
        };
    },

    updateOption: async (optionId: number, data: { name: string; priceOverlay: number; ingredientId?: number; qtyUsed?: number }) => {
        const response = await api.put(`/modifiers/options/${optionId}`, data);
        return {
             ...response.data.data,
             priceOverlay: Number(response.data.data.priceOverlay)
        };
    },

    deleteOption: async (optionId: number) => {
        const response = await api.delete(`/modifiers/options/${optionId}`);
        return response.data;
    }
};
