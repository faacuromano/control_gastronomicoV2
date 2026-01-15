import api from '../lib/api';

export interface User {
    id: number;
    name: string;
    email?: string;
    pin?: string; // Optional in response for security, but needed for create/update logic types
    roleId?: number;
    role?: {
        id: number;
        name: string;
    };
}

export const userService = {
    getAll: async (): Promise<User[]> => {
        const response = await api.get('/users');
        return response.data.data;
    },

    getUsersByRole: async (role: string): Promise<User[]> => {
        const response = await api.get(`/users?role=${role}`);
        return response.data.data;
    },

    create: async (data: Omit<User, 'id'> & { pin: string, roleId: number }): Promise<User> => {
        const response = await api.post('/users', data);
        return response.data.data;
    },

    update: async (id: number, data: Partial<User> & { pin?: string, roleId?: number }): Promise<User> => {
        const response = await api.put(`/users/${id}`, data);
        return response.data.data;
    },

    delete: async (userId: number): Promise<void> => {
        await api.delete(`/users/${userId}`);
    },

    getUsersWithCapability: async (capability: string): Promise<User[]> => {
        const response = await api.get(`/users/with-capability?type=${capability}`);
        return response.data.data;
    }
};
