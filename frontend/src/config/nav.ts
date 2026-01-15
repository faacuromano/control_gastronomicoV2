/**
 * @fileoverview Navigation Configuration
 * 
 * @business_rule
 * Navigation items are dynamically filtered based on:
 * 1. Feature Flags (TenantConfig) - Module visibility
 * 2. Permissions (Role RBAC) - Access control
 * 3. Implementation status - Hide unfinished routes
 * 
 * This ensures users only see what they can access.
 */

import { 
    LayoutDashboard, 
    ShoppingCart, 
    Archive, 
    Users, 
    Settings,
    ChefHat,
    Grid,
    Truck,
    Wallet,
    type LucideIcon
} from "lucide-react";
import type { FeatureFlags } from "../hooks/useFeatureFlags";

/**
 * Navigation item with conditional visibility rules
 */
export interface NavItem {
    icon: LucideIcon;
    label: string;
    href: string;
    /** Feature flag that must be enabled to show this item */
    requiredFlag?: keyof FeatureFlags;
    /** Permission required: { resource: 'orders', action: 'read' } */
    requiredPermission?: { resource: string; action: 'create' | 'read' | 'update' | 'delete' };
    /** Whether the route/page is implemented (hide WIP routes) */
    isImplemented?: boolean;
    /** Admin-only routes go to /admin section */
    isAdmin?: boolean;
}

/**
 * Main sidebar navigation items
 * Items with isImplemented: false are hidden in the sidebar
 */
export const SIDEBAR_ITEMS: NavItem[] = [
    { 
        icon: LayoutDashboard, 
        label: "Dashboard", 
        href: "/",
        isImplemented: true
    },
    { 
        icon: ShoppingCart, 
        label: "Ventas (POS)", 
        href: "/ventas",
        requiredPermission: { resource: 'orders', action: 'create' },
        isImplemented: true
    },
    { 
        icon: Grid, 
        label: "Mesas", 
        href: "/tables",
        requiredPermission: { resource: 'tables', action: 'read' },
        isImplemented: true
    },
    { 
        icon: ChefHat, 
        label: "Cocina (KDS)", 
        href: "/kitchen",
        requiredFlag: 'enableKDS',
        isImplemented: true
    },
    { 
        icon: Truck, 
        label: "Delivery", 
        href: "/delivery-dashboard",
        requiredFlag: 'enableDelivery',
        isImplemented: true
    },
    { 
        icon: Wallet, 
        label: "Caja", 
        href: "/cash",
        requiredPermission: { resource: 'cash', action: 'read' },
        isImplemented: true
    },
    { 
        icon: Archive, 
        label: "Inventario", 
        href: "/admin/ingredients",
        requiredFlag: 'enableStock',
        isAdmin: true,
        isImplemented: true
    },
    { 
        icon: Users, 
        label: "Usuarios", 
        href: "/admin/users",
        requiredPermission: { resource: 'users', action: 'read' },
        isAdmin: true,
        isImplemented: false // TODO: UserManagement page
    },
    { 
        icon: Settings, 
        label: "Configuración", 
        href: "/admin/settings",
        isAdmin: true,
        requiredPermission: { resource: 'config', action: 'read' },
        isImplemented: false // TODO: Settings page
    },
];

/**
 * Filter navigation items based on feature flags and permissions
 * 
 * @business_rule
 * An item is visible only if:
 * 1. It is implemented (isImplemented !== false)
 * 2. Required feature flag is enabled (or no flag required)
 * 3. User has required permission (or no permission required)
 */
export function getFilteredNavItems(
    items: NavItem[],
    featureFlags: FeatureFlags | undefined,
    hasPermission: (resource: string, action: 'create' | 'read' | 'update' | 'delete') => boolean
): NavItem[] {
    return items.filter(item => {
        // Hide unimplemented routes
        if (item.isImplemented === false) {
            return false;
        }

        // Check feature flag if required
        if (item.requiredFlag && !featureFlags?.[item.requiredFlag]) {
            return false;
        }

        // Check permission if required
        if (item.requiredPermission) {
            const { resource, action } = item.requiredPermission;
            if (!hasPermission(resource, action)) {
                return false;
            }
        }

        return true;
    });
}
