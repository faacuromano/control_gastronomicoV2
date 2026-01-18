/**
 * Print Routing Service
 * Handles API calls for print routing configuration
 */

import api from '../lib/api';

export interface PrintRoutingCategory {
    id: number;
    name: string;
    printerId: number | null;
    printerName: string | null;
}

export interface PrintRoutingAreaOverride {
    id: number;
    categoryId: number | null;
    categoryName: string;
    printerId: number;
    printerName: string;
}

export interface PrintRoutingArea {
    id: number;
    name: string;
    overrides: PrintRoutingAreaOverride[];
}

export interface PrintRoutingPrinter {
    id: number;
    name: string;
    connectionType: 'NETWORK' | 'USB';
}

export interface PrintRoutingConfig {
    categories: PrintRoutingCategory[];
    areas: PrintRoutingArea[];
    printers: PrintRoutingPrinter[];
}

class PrintRoutingService {
    async getConfiguration(): Promise<PrintRoutingConfig> {
        const response = await api.get('/print-routing/config');
        return response.data.data;
    }

    async setCategoryPrinter(categoryId: number, printerId: number | null): Promise<void> {
        await api.patch(`/print-routing/category/${categoryId}/printer`, { printerId });
    }

    async setAreaOverride(areaId: number, categoryId: number | null, printerId: number): Promise<void> {
        await api.post(`/print-routing/area/${areaId}/override`, { categoryId, printerId });
    }

    async removeAreaOverride(areaId: number, categoryId: number | null): Promise<void> {
        await api.delete(`/print-routing/area/${areaId}/override`, { 
            data: { categoryId } 
        });
    }
}

export const printRoutingService = new PrintRoutingService();
