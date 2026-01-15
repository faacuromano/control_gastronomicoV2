
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
}

interface DOSState {
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, delta: number) => void;
  clearCart: () => void;
  total: () => number;
}

export const usePOSStore = create<DOSState>((set, get) => ({
  cart: [],

  addToCart: (product, quantity = 1) => {
    set((state) => {
      // Check if same product exists (logic can be complex with modifiers, for now simple)
      const existingItem = state.cart.find((item) => item.product.id === product.id);

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

  clearCart: () => set({ cart: [] }),

  total: () => {
    const { cart } = get();
    return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  },
}));
