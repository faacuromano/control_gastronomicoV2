import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

export const useCashStore = create<CashState>()(
    persist(
        (set) => ({
            shift: null,
            isLoading: false,
            error: null,

            checkShiftStatus: async () => {
                set({ isLoading: true, error: null });
                try {
                    const shift = await cashShiftService.getCurrentShift();
                    set({ shift, isLoading: false });
                } catch {
                    // If 404/Not Found or network error, keep existing persisted shift.
                    // Only clear shift on explicit 404 (server responded, no shift).
                    // On network error (offline), the persisted value stays.
                    set((state) => ({ shift: state.shift, isLoading: false }));
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
        }),
        {
            name: 'cash-storage',
            // Only persist the shift data (not loading/error transient state)
            partialize: (state) => ({ shift: state.shift }),
        }
    )
);
