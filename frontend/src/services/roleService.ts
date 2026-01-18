import api from '../lib/api';

export interface Role {
    id: number;
    name: string;
    permissions: RolePermissions;
    _count?: {
        users: number;
    };
}

export type RolePermissions = {
    [resource: string]: string[];
};

export interface PermissionOptions {
    modules: string[];
    resources: string[];
    actions: string[];
}

export const roleService = {
    getAll: async (): Promise<Role[]> => {
        const response = await api.get('/roles');
        return response.data.data;
    },

    getById: async (id: number): Promise<Role> => {
        const response = await api.get(`/roles/${id}`);
        return response.data.data;
    },

    getPermissionOptions: async (): Promise<PermissionOptions> => {
        const response = await api.get('/roles/permission-options');
        return response.data.data;
    },

    create: async (name: string): Promise<Role> => {
        const response = await api.post('/roles', { name });
        return response.data.data;
    },

    updatePermissions: async (id: number, permissions: RolePermissions): Promise<Role> => {
        const response = await api.put(`/roles/${id}/permissions`, { permissions });
        return response.data.data;
    },

    delete: async (id: number): Promise<void> => {
        await api.delete(`/roles/${id}`);
    }
};
