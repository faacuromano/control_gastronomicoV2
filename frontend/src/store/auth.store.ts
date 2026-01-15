import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../lib/api';

/**
 * Permission structure following RBAC pattern.
 * Maps resource names to allowed actions.
 * @example { "orders": ["create", "read"], "products": ["create", "read", "update", "delete"] }
 */
export interface RolePermissions {
    [resource: string]: ('create' | 'read' | 'update' | 'delete')[];
}

/**
 * Authenticated user data structure.
 * Matches backend auth response payload.
 */
export interface User {
    id: number;
    name: string;
    role: string;
    permissions: RolePermissions;
}

/**
 * Authentication state managed by Zustand.
 * Persisted to localStorage under 'auth-storage' key.
 */
interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    
    /**
     * Authenticate user with email and password.
     * @throws Error if credentials are invalid
     */
    login: (email: string, password: string) => Promise<void>;
    
    /**
     * Authenticate user with 6-digit PIN.
     * @throws Error if PIN is invalid
     */
    loginPin: (pin: string) => Promise<void>;
    
    /**
     * Clear authentication state and log out user.
     */
    logout: () => void;
    
    /**
     * Check if current user has permission for a specific action on a resource.
     * @param resource - The resource name (e.g., 'orders', 'products')
     * @param action - The action to check (e.g., 'create', 'read')
     * @returns true if user has permission, false otherwise
     */
    hasPermission: (resource: string, action: 'create' | 'read' | 'update' | 'delete') => boolean;
}

/**
 * Global authentication store using Zustand.
 * Automatically persists to localStorage.
 */
export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,

            login: async (email: string, password: string) => {
                const response = await api.post('/auth/login', { email, password });
                const { user, token } = response.data.data;
                set({ user, token, isAuthenticated: true });
            },

            loginPin: async (pin: string) => {
                const response = await api.post('/auth/login/pin', { pin });
                const { user, token } = response.data.data;
                set({ user, token, isAuthenticated: true });
            },

            logout: () => {
                set({ user: null, token: null, isAuthenticated: false });
            },
            
            hasPermission: (resource: string, action: 'create' | 'read' | 'update' | 'delete') => {
                const user = get().user;
                if (!user || !user.permissions) return false;
                
                const resourcePermissions = user.permissions[resource];
                if (!resourcePermissions) return false;
                
                return resourcePermissions.includes(action);
            },
        }),
        {
            name: 'auth-storage',
        }
    )
);
