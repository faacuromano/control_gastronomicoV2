import api from '../lib/api';

export interface Area {
    id: number;
    name: string;
    tables: Table[];
}

export interface Table {
    id: number;
    areaId: number;
    name: string;
    x: number;
    y: number;
    status: 'FREE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';
    currentOrderId?: number;
}

class TableService {
    async getAreas(): Promise<Area[]> {
        const response = await api.get('/areas');
        return response.data.data;
    }

    async getTable(id: number): Promise<Table> {
        const response = await api.get(`/tables/${id}`);
        return response.data.data;
    }

    async createArea(data: { name: string }): Promise<Area> {
        const response = await api.post('/areas', data);
        return response.data.data;
    }

    async updateArea(id: number, data: { name: string }): Promise<Area> {
        const response = await api.put(`/areas/${id}`, data);
        return response.data.data;
    }

    async deleteArea(id: number): Promise<void> {
        await api.delete(`/areas/${id}`);
    }

    async createTable(data: { name: string; areaId: number; x?: number; y?: number }): Promise<Table> {
        const response = await api.post('/tables', data);
        return response.data.data;
    }

    async updateTable(id: number, data: { name: string; x?: number; y?: number }): Promise<Table> {
        const response = await api.put(`/tables/${id}`, data);
        return response.data.data;
    }

    async deleteTable(id: number): Promise<void> {
        await api.delete(`/tables/${id}`);
    }

    // Operations
    /**
     * Opens a table, marks it as OCCUPIED, and creates an order for it.
     * Backend handles both status change and order creation atomically.
     */
    async openTable(id: number, pax = 1): Promise<any> {
        const response = await api.post(`/tables/${id}/open`, { pax });
        return response.data.data;
    }

    /**
     * Closes a table: processes payment on the active order and marks table as FREE.
     * Backend handles payment recording + order close + table status atomically.
     */
    async closeTable(id: number, payments?: { method: string; amount: number }[]): Promise<any> {
        const response = await api.post(`/tables/${id}/close`, payments ? { payments } : undefined);
        return response.data.data;
    }
    async updatePositions(updates: { id: number; x: number; y: number }[]): Promise<void> {
        await api.put('/tables/positions', { updates });
    }
}

export const tableService = new TableService();
