/**
 * @fileoverview Main Application Sidebar
 * 
 * @business_rule
 * Navigation items are dynamically rendered based on:
 * 1. TenantConfig feature flags (enableStock, enableDelivery, etc.)
 * 2. User role permissions (RBAC)
 * 3. Implementation status (hides WIP pages)
 * 
 * This prevents users from seeing modules they can't access.
 */

import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";
import { SIDEBAR_ITEMS, getFilteredNavItems } from "@/config/nav";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useAuthStore } from "@/store/auth.store";

/**
 * Main sidebar navigation component.
 * 
 * Renders navigation items filtered by feature flags and user permissions.
 */
export function Sidebar() {
    const location = useLocation();
    const navigate = useNavigate();
    
    // Feature flags for module visibility
    const { features, loading: flagsLoading } = useFeatureFlags();
    
    // Auth state for permissions and logout
    const { hasPermission, logout, user } = useAuthStore();
    
    // Handle logout
    const handleLogout = () => {
        logout();
        navigate('/login');
    };
    
    // Get filtered nav items based on flags and permissions
    const visibleItems = getFilteredNavItems(SIDEBAR_ITEMS, features, hasPermission);

    return (
        <div className="flex h-screen w-64 flex-col border-r bg-card text-card-foreground">
            {/* Header */}
            <div className="flex h-16 items-center border-b px-6">
                <h1 className="text-xl font-bold tracking-tight">PentiumPOS</h1>
            </div>
            
            {/* User info */}
            {user && (
                <div className="px-6 py-3 border-b text-sm">
                    <p className="font-medium text-foreground">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.role}</p>
                </div>
            )}
            
            {/* Navigation */}
            <nav className="flex-1 space-y-1 p-4">
                {flagsLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    visibleItems.map((item) => (
                        <Link key={item.href} to={item.href}>
                            <Button
                                variant={location.pathname === item.href ? "secondary" : "ghost"}
                                className={cn(
                                    "w-full justify-start",
                                    location.pathname === item.href && "bg-secondary"
                                )}
                            >
                                <item.icon className="mr-2 h-4 w-4" />
                                {item.label}
                            </Button>
                        </Link>
                    ))
                )}
            </nav>
            
            {/* Logout */}
            <div className="border-t p-4">
                <Button 
                    variant="ghost" 
                    className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={handleLogout}
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar Sesión
                </Button>
            </div>
        </div>
    );
}
