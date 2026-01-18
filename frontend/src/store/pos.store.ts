
import { create } from 'zustand';
import { type Product } from '../services/productService';

/**
 * Represents a selected modifier option in the cart
 */
export interface ModifierSelection {
  modifierGroupId: number;
  modifierOptionId: number;
  name: string;
  priceOverlay: number;
}

export interface CartItem {
  id: string; // Unique ID for cart entry (allows duplicate products with different mods)
  product: Product;
  quantity: number;
  modifiers?: ModifierSelection[]; // Typed modifier selections
  notes?: string;
  removedIngredientIds?: number[];
}

interface DOSState {
  cart: CartItem[];
  selectedClientId: number | null;  // Client for loyalty points
  addToCart: (product: Product, quantity?: number, modifiers?: ModifierSelection[], notes?: string, removedIngredientIds?: number[]) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, delta: number) => void;
  clearCart: () => void;
  setSelectedClient: (clientId: number | null) => void;
  total: () => number;
}

export const usePOSStore = create<DOSState>((set, get) => ({
  cart: [],
  selectedClientId: null,

  addToCart: (product, quantity = 1, modifiers = [], notes = '', removedIngredientIds = []) => {
    set((state) => {
      // Create a unique signature for this configuration
      const newItemSignature = JSON.stringify({
          pid: product.id,
          mods: modifiers.sort((a,b) => a.modifierOptionId - b.modifierOptionId),
          notes: notes.trim(),
          removed: removedIngredientIds.sort((a, b) => a - b)
      });

      // Find if exact same item exists
      const existingItem = state.cart.find((item) => {
          const itemSignature = JSON.stringify({
              pid: item.product.id,
              mods: (item.modifiers || []).sort((a,b) => a.modifierOptionId - b.modifierOptionId),
              notes: (item.notes || '').trim(),
              removed: (item.removedIngredientIds || []).sort((a, b) => a - b)
          });
          return newItemSignature === itemSignature;
      });

      if (existingItem) {
        return {
          cart: state.cart.map((item) =>
            item.id === existingItem.id
              ? { ...item, quantity: item.quantity + quantity }
              : item
          ),
        };
      }

      const newItem: CartItem = {
        id: Math.random().toString(36).substr(2, 9),
        product,
        quantity,
        modifiers,
        notes,
        removedIngredientIds
      };

      return { cart: [...state.cart, newItem] };
    });
  },

  removeFromCart: (cartItemId) => {
    set((state) => ({
      cart: state.cart.filter((item) => item.id !== cartItemId),
    }));
  },

  updateQuantity: (cartItemId, delta) => {
    set((state) => {
      return {
        cart: state.cart.map((item) => {
            if (item.id === cartItemId) {
                const newQuantity = item.quantity + delta;
                return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
            }
            return item;
        }).filter(item => item.quantity > 0) // Optional: remove if 0? better keep at 1 or explicit remove
      };
    });
  },

  clearCart: () => set({ cart: [], selectedClientId: null }),

  setSelectedClient: (clientId) => set({ selectedClientId: clientId }),

  total: () => {
    const { cart } = get();
    return cart.reduce((sum, item) => {
        const itemBase = Number(item.product.price);
        const itemMods = (item.modifiers || []).reduce((acc, m) => acc + Number(m.priceOverlay), 0);
        return sum + ((itemBase + itemMods) * item.quantity);
    }, 0);
  },
}));
