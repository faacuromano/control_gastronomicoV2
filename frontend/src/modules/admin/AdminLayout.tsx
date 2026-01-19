import { Outlet, Link, useLocation } from 'react-router-dom';
import { Users, Coffee, Grid, Package, Archive, Settings, ListPlus, Truck, ShoppingCart, BarChart3, ChevronDown, Shield, CreditCard, Wrench, Printer, QrCode, Bike } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFeatureFlags, type FeatureFlags } from '../../hooks/useFeatureFlags';
import { useState } from 'react';

interface SidebarItem {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    href: string;
    requiredFlag?: keyof FeatureFlags;
    isImplemented?: boolean;
}

interface SidebarGroup {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    items: SidebarItem[];
    requiredFlag?: keyof FeatureFlags;
}

/**
 * Admin sidebar navigation organized by functional groups
 */
const sidebarGroups: SidebarGroup[] = [
    {
        title: 'General',
        icon: BarChart3,
        items: [
            { icon: BarChart3, label: 'Dashboard', href: '/admin/dashboard', isImplemented: true },
        ]
    },
    {
        title: 'Catálogo',
        icon: Package,
        items: [
            { icon: Package, label: 'Productos', href: '/admin/products', isImplemented: true },
            { icon: Coffee, label: 'Categorías', href: '/admin/categories', isImplemented: true },
            { icon: ListPlus, label: 'Modificadores', href: '/admin/modifiers', isImplemented: true },
        ]
    },
    {
        title: 'Operación',
        icon: Grid,
        items: [
            { icon: Grid, label: 'Mesas y Áreas', href: '/admin/tables', isImplemented: true },
            { icon: Users, label: 'Personal', href: '/admin/users', isImplemented: true },
            { icon: Truck, label: 'Plataformas Delivery', href: '/admin/delivery-platforms', isImplemented: true, requiredFlag: 'enableDelivery' },
            { icon: Bike, label: 'Conductores', href: '/admin/delivery-drivers', isImplemented: true, requiredFlag: 'enableDelivery' },
        ]
    },
    {
        title: 'Inventario',
        icon: Archive,
        requiredFlag: 'enableStock',
        items: [
            { icon: Archive, label: 'Stock & Insumos', href: '/admin/ingredients', isImplemented: true },
            { icon: Truck, label: 'Proveedores', href: '/admin/suppliers', isImplemented: true },
            { icon: ShoppingCart, label: 'Órdenes de Compra', href: '/admin/purchase-orders', isImplemented: true },
        ]
    },
    {
        title: 'Configuración',
        icon: Settings,
        items: [
            { icon: QrCode, label: 'Menú QR', href: '/admin/qr', isImplemented: true },
            { icon: CreditCard, label: 'Métodos de Pago', href: '/admin/payment-methods', isImplemented: true },
            { icon: Shield, label: 'Roles y Permisos', href: '/admin/roles', isImplemented: true },
            { icon: Printer, label: 'Impresoras', href: '/admin/printers', isImplemented: true },
            { icon: Printer, label: 'Enrutamiento Impresión', href: '/admin/print-routing', isImplemented: true },
            { icon: Wrench, label: 'Ajustes Generales', href: '/admin/settings', isImplemented: true },
        ]
    },
];

export default function AdminLayout() {
    const location = useLocation();
    const { features, loading } = useFeatureFlags();
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    const toggleGroup = (title: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(title)) {
                next.delete(title);
            } else {
                next.add(title);
            }
            return next;
        });
    };

    if (loading) {
        return <div className="p-8">Loading configuration...</div>;
    }

    return (
        <div className="flex h-full bg-background">
            {/* Admin Sidebar */}
            <aside className="w-64 bg-card border-r border-border flex flex-col">
                <div className="p-6 border-b border-border">
                    <h2 className="text-xl font-bold text-foreground">Administración</h2>
                </div>

                <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
                    {sidebarGroups.map((group) => {
                        // Hide groups if feature flag is required and not enabled
                        if (group.requiredFlag && !features?.[group.requiredFlag]) {
                            return null;
                        }

                        const implementedItems = group.items.filter(item => item.isImplemented !== false);
                        if (implementedItems.length === 0) return null;

                        const isCollapsed = collapsedGroups.has(group.title);
                        const hasActiveItem = implementedItems.some(item => location.pathname === item.href);

                        return (
                            <div key={group.title}>
                                {/* Group Header */}
                                <button
                                    onClick={() => toggleGroup(group.title)}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors",
                                        hasActiveItem 
                                            ? "text-primary bg-primary/5" 
                                            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <group.icon className="w-4 h-4" />
                                        <span>{group.title}</span>
                                    </div>
                                    <ChevronDown className={cn(
                                        "w-4 h-4 transition-transform",
                                        isCollapsed && "-rotate-90"
                                    )} />
                                </button>

                                {/* Group Items */}
                                {!isCollapsed && (
                                    <div className="mt-1 ml-2 space-y-1">
                                        {implementedItems.map((item) => (
                                            <Link
                                                key={item.href}
                                                to={item.href}
                                                className={cn(
                                                    "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm font-medium",
                                                    location.pathname === item.href 
                                                        ? "bg-primary text-primary-foreground" 
                                                        : "hover:bg-accent text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                <item.icon className="w-4 h-4" />
                                                <span>{item.label}</span>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
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

