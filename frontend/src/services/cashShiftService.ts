
import axios from '../lib/api';

export interface CashShift {
    id: number;
    userId: number;
    startAmount: number;
    startTime: string;
    endTime: string | null;
    endAmount: number | null;
    businessDate: string;
    expectedCash?: number;  // Optional as listing might not always have it
    difference?: number;
}

export interface ShiftReport {
    shift: {
        id: number;
        startTime: string;
        endTime: string | null;
        startAmount: number;
        endAmount: number | null;
        userName: string;
    };
    sales: {
        totalOrders: number;
        totalSales: number;
        byPaymentMethod: { method: string; count: number; total: number }[];
    };
    cash: {
        startAmount: number;
        cashSales: number;
        expectedCash: number;
        countedCash: number | null;
        difference: number | null;
    };
}

const API_URL = '/cash-shifts';

export const cashShiftService = {
    openShift: async (startAmount: number): Promise<CashShift> => {
        const response = await axios.post(`${API_URL}/open`, { startAmount });
        return response.data.data;
    },

    closeShift: async (endAmount: number): Promise<CashShift> => {
        const response = await axios.post(`${API_URL}/close`, { endAmount });
        return response.data.data;
    },

    // Close with blind count (arqueo ciego)
    closeShiftWithCount: async (countedCash: number): Promise<ShiftReport> => {
        const response = await axios.post(`${API_URL}/close-with-count`, { countedCash });
        return response.data.data;
    },

    // Get shift report
    getShiftReport: async (shiftId: number): Promise<ShiftReport> => {
        const response = await axios.get(`${API_URL}/${shiftId}/report`);
        return response.data.data;
    },

    getCurrentShift: async (): Promise<CashShift | null> => {
        try {
            const response = await axios.get(`${API_URL}/current`);
            return response.data.data;
        } catch (error) {
            return null;
        }
    },

    getAll: async (filters?: { fromDate?: string; userId?: number }): Promise<CashShift[]> => {
        const params = new URLSearchParams();
        if (filters?.fromDate) params.append('fromDate', filters.fromDate);
        if (filters?.userId) params.append('userId', filters.userId.toString());
        
        const response = await axios.get(`${API_URL}?${params.toString()}`);
        return response.data.data;
    }
};
