import { create } from 'zustand';
import { cashShiftService, type CashShift, type ShiftReport } from '../services/cashShiftService';
import { getErrorMessage } from '../lib/errorUtils';

interface CashState {
    shift: CashShift | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    checkShiftStatus: () => Promise<void>;
    openShift: (initialAmount: number) => Promise<void>;
    closeShift: (finalAmount: number) => Promise<void>;
    closeShiftWithCount: (countedCash: number) => Promise<ShiftReport>;
}

export const useCashStore = create<CashState>((set) => ({
    shift: null,
    isLoading: false,
    error: null,

    checkShiftStatus: async () => {
        set({ isLoading: true, error: null });
        try {
            const shift = await cashShiftService.getCurrentShift();
            set({ shift, isLoading: false });
        } catch (error) {
            // If 404/Not Found, shift is null, expected behavior
            set({ shift: null, isLoading: false });
        }
    },

    openShift: async (initialAmount: number) => {
        set({ isLoading: true, error: null });
        try {
            const shift = await cashShiftService.openShift(initialAmount);
            set({ shift, isLoading: false });
        } catch (error: unknown) {
            set({ error: getErrorMessage(error, 'Error opening shift'), isLoading: false });
            throw error;
        }
    },

    closeShift: async (finalAmount: number) => {
        set({ isLoading: true, error: null });
        try {
            await cashShiftService.closeShift(finalAmount);
            set({ shift: null, isLoading: false });
        } catch (error: unknown) {
            set({ error: getErrorMessage(error, 'Error closing shift'), isLoading: false });
            throw error;
        }
    },

    closeShiftWithCount: async (countedCash: number) => {
        set({ isLoading: true, error: null });
        try {
            const report = await cashShiftService.closeShiftWithCount(countedCash);
            set({ shift: null, isLoading: false });
            return report;
        } catch (error: unknown) {
            set({ error: getErrorMessage(error, 'Error closing shift'), isLoading: false });
            throw error;
        }
    }
}));
