import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type KitchenStation = 'ALL' | 'HOT' | 'COLD' | 'DESSERT';

export interface KitchenState {
    // Filters
    activeStation: KitchenStation;
    setStation: (station: KitchenStation) => void;
    
    // UI preferences
    showCompleted: boolean;
    toggleShowCompleted: () => void;
    
    // Audio context
    soundEnabled: boolean;
    setSoundEnabled: (enabled: boolean) => void;
}

export const useKitchenStore = create<KitchenState>()(
    persist(
        (set) => ({
            activeStation: 'ALL',
            setStation: (station) => set({ activeStation: station }),
            
            showCompleted: false,
            toggleShowCompleted: () => set((state) => ({ showCompleted: !state.showCompleted })),
            
            soundEnabled: false,
            setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
        }),
        {
            name: 'kitchen-storage',
        }
    )
);
