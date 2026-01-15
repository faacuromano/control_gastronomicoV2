import api from '../lib/api';

export interface Client {
    id: number;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    taxId?: string;
}

export const clientService = {
    async search(query: string = '') {
        const response = await api.get<Client[]>(`/clients/search?q=${encodeURIComponent(query)}`);
        return response.data;
    },

    async create(data: Omit<Client, 'id'>) {
        const response = await api.post<Client>('/clients', data);
        return response.data;
    }
};
