import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../lib/api';

/**
 * Permission structure following RBAC pattern.
 * Maps resource/module names to allowed actions.
 * @example { "pos": ["access"], "orders": ["create", "read"] }
 */
export interface RolePermissions {
    [resource: string]: ('access' | 'create' | 'read' | 'update' | 'delete')[];
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
 * 
 * FIX P0-004: Token is NO LONGER stored here. JWT is now in HttpOnly cookie
 * managed by the browser, making it inaccessible to JavaScript/XSS.
 * 
 * Only user data is persisted to localStorage under 'auth-storage' key.
 */
interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    
    /**
     * Authenticate user with email and password.
     * Token is set via Set-Cookie header, not stored in JS.
     * @throws Error if credentials are invalid
     */
    login: (email: string, password: string) => Promise<void>;
    
    /**
     * Authenticate user with 6-digit PIN.
     * Token is set via Set-Cookie header, not stored in JS.
     * @throws Error if PIN is invalid
     */
    loginPin: (pin: string) => Promise<void>;
    
    /**
     * Clear authentication state and log out user.
     * Calls logout endpoint to clear the HttpOnly cookie.
     */
    logout: () => Promise<void>;
    
    /**
     * Check if current user has permission for a specific action on a resource/module.
     * @param resource - The resource or module name (e.g., 'pos', 'orders', 'products')
     * @param action - The action to check (e.g., 'access', 'create', 'read')
     * @returns true if user has permission, false otherwise. ADMIN always returns true.
     */
    hasPermission: (resource: string, action: 'access' | 'create' | 'read' | 'update' | 'delete') => boolean;
}

/**
 * Global authentication store using Zustand.
 * 
 * FIX P0-004: No longer persists token to localStorage.
 * Only user data is persisted. Authentication is maintained via HttpOnly cookie.
 */
export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            isAuthenticated: false,

            login: async (email: string, password: string) => {
                const response = await api.post('/auth/login', { email, password });
                // FIX P0-004: Token is in Set-Cookie header, not in response body
                const { user } = response.data.data;
                set({ user, isAuthenticated: true });
            },

            loginPin: async (pin: string) => {
                const response = await api.post('/auth/login/pin', { pin });
                // FIX P0-004: Token is in Set-Cookie header, not in response body
                const { user } = response.data.data;
                set({ user, isAuthenticated: true });
            },

            logout: async () => {
                try {
                    // FIX P0-004: Call logout endpoint to clear HttpOnly cookie
                    await api.post('/auth/logout');
                } catch (error) {
                    // Ignore errors on logout - clear local state anyway
                    console.warn('Logout API call failed, clearing local state');
                }
                set({ user: null, isAuthenticated: false });
            },
            
            hasPermission: (resource: string, action: 'access' | 'create' | 'read' | 'update' | 'delete') => {
                const user = get().user;
                if (!user) return false;
                
                // ADMIN role always has full access
                if (user.role === 'ADMIN') return true;
                
                if (!user.permissions) return false;
                
                const resourcePermissions = user.permissions[resource];
                if (!resourcePermissions) return false;
                
                return resourcePermissions.includes(action);
            },
        }),
        {
            name: 'auth-storage',
            // FIX P0-004: Only persist user data, not sensitive tokens
            partialize: (state) => ({ 
                user: state.user, 
                isAuthenticated: state.isAuthenticated 
            }),
        }
    )
);

