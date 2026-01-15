import { Outlet, Link, useLocation } from 'react-router-dom';
import { Users, Coffee, Grid, Package, Archive, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFeatureFlags, type FeatureFlags } from '../../hooks/useFeatureFlags';

interface SidebarItem {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    href: string;
    requiredFlag?: keyof FeatureFlags;
    /** Whether the route/page is implemented (hide WIP routes) */
    isImplemented?: boolean;
}

/**
 * Admin sidebar navigation items
 * Items with isImplemented: false are hidden to prevent dead links
 */
const sidebarItems: SidebarItem[] = [
    { icon: Package, label: 'Products', href: '/admin/products', isImplemented: true },
    { icon: Coffee, label: 'Categories', href: '/admin/categories', isImplemented: true },
    { icon: Grid, label: 'Mesas y Áreas', href: '/admin/tables', isImplemented: true },
    { icon: Users, label: 'Personal', href: '/admin/users', isImplemented: true },
    { icon: Users, label: 'Clientes', href: '/admin/clients', isImplemented: false }, // TODO: ClientsPage
    { icon: Archive, label: 'Stock & Insumos', href: '/admin/ingredients', requiredFlag: 'enableStock', isImplemented: true },
    { icon: Settings, label: 'Configuración', href: '/admin/settings', isImplemented: true },
];

export default function AdminLayout() {
    const location = useLocation();
    const { features, loading } = useFeatureFlags();

    if (loading) {
        return <div className="p-8">Loading configuration...</div>;
    }

    return (
        <div className="flex h-full bg-background">
            {/* Admin Sidebar */}
            <aside className="w-64 bg-card border-r border-border flex flex-col">
                <div className="p-6 border-b border-border">
                    <h2 className="text-xl font-bold text-foreground">Administration</h2>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                {sidebarItems.map((item) => {
                        // Hide unimplemented routes
                        if (item.isImplemented === false) {
                            return null;
                        }
                        
                        // Conditional Rendering based on Feature Flags
                        if (item.requiredFlag && !features?.[item.requiredFlag]) {
                            return null;
                        }

                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium",
                                    location.pathname === item.href 
                                        ? "bg-primary text-primary-foreground" 
                                        : "hover:bg-accent text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <item.icon className="w-5 h-5" />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            </aside>

            {/* Admin Content */}
            <div className="flex-1 overflow-auto">
                <div className="p-8">
                    <Outlet />
                </div>
            </div>
        </div>
    );
}
