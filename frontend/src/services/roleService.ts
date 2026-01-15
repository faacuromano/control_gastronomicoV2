import api from '../lib/api';

export interface Role {
    id: number;
    name: string;
}

export const roleService = {
    getAll: async (): Promise<Role[]> => {
        const response = await api.get('/roles');
        return response.data.data;
    },

    create: async (name: string): Promise<Role> => {
        const response = await api.post('/roles', { name });
        return response.data.data;
    },

    delete: async (id: number): Promise<void> => {
        await api.delete(`/roles/${id}`);
    }
};
