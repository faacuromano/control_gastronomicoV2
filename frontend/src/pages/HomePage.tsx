import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    ShoppingCart, Utensils, Wallet, Monitor, Settings, Truck,
    TrendingUp, AlertTriangle, Clock, CheckCircle, Loader2
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { useCashStore } from '../store/cash.store';
import { analyticsService, type SalesSummary, type LowStockItem } from '../services/analyticsService';
import { configService, type TenantConfig } from '../services/configService';

interface QuickAccessItem {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    path: string;
    color: string;
    permission?: { resource: string; action: string };
    flag?: keyof TenantConfig['features'];
}

const QUICK_ACCESS: QuickAccessItem[] = [
    { icon: ShoppingCart, label: 'Ventas', path: '/ventas', color: 'bg-indigo-500 hover:bg-indigo-600', permission: { resource: 'orders', action: 'create' } },
    { icon: Utensils, label: 'Mesas', path: '/tables', color: 'bg-emerald-500 hover:bg-emerald-600', permission: { resource: 'tables', action: 'read' } },
    { icon: Monitor, label: 'Cocina', path: '/kitchen', color: 'bg-orange-500 hover:bg-orange-600', flag: 'enableKDS' },
    { icon: Wallet, label: 'Caja', path: '/cash', color: 'bg-blue-500 hover:bg-blue-600', permission: { resource: 'cash', action: 'read' } },
    { icon: Truck, label: 'Delivery', path: '/delivery-dashboard', color: 'bg-purple-500 hover:bg-purple-600', flag: 'enableDelivery' },
    { icon: Settings, label: 'Admin', path: '/admin', color: 'bg-slate-600 hover:bg-slate-700', permission: { resource: 'admin', action: 'access' } },
];

export const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const shift = useCashStore((state) => state.shift);
    const checkShiftStatus = useCashStore((state) => state.checkShiftStatus);

    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<SalesSummary | null>(null);
    const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
    const [features, setFeatures] = useState<TenantConfig['features'] | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [summaryData, stockData, config] = await Promise.allSettled([
                analyticsService.getSalesSummary(),
                analyticsService.getLowStockItems(),
                configService.getConfig()
            ]);

            if (summaryData.status === 'fulfilled') setSummary(summaryData.value);
            if (stockData.status === 'fulfilled') setLowStock(stockData.value);
            if (config.status === 'fulfilled') setFeatures(config.value.features);

            await checkShiftStatus();
        } catch (error) {
            console.error('Failed to load home data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Buenos días';
        if (hour < 19) return 'Buenas tardes';
        return 'Buenas noches';
    };

    const formatTime = (date: string | Date) => {
        return new Date(date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    };

    const canAccess = (item: QuickAccessItem): boolean => {
        if (item.permission && !hasPermission(item.permission.resource, item.permission.action as 'access' | 'create' | 'read' | 'update' | 'delete')) {
            return false;
        }
        if (item.flag && features && !features[item.flag]) {
            return false;
        }
        return true;
    };

    const accessibleItems = QUICK_ACCESS.filter(canAccess);

    return (
        <div className="p-6 max-w-6xl mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground">
                    {getGreeting()}, <span className="text-primary">{user?.name || 'Usuario'}</span>
                </h1>
                <p className="text-muted-foreground mt-1">
                    {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>

            {/* Shift Status */}
            {shift ? (
                <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white">
                            <CheckCircle size={20} />
                        </div>
                        <div>
                            <p className="font-semibold text-green-800 dark:text-green-200">Turno Activo</p>
                            <p className="text-sm text-green-600 dark:text-green-400">
                                Iniciado a las {formatTime(shift.startTime)} • ${Number(shift.startAmount).toFixed(2)} inicial
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => navigate('/cash')}
                        className="text-green-700 dark:text-green-300 hover:underline font-medium text-sm"
                    >
                        Ver Caja →
                    </button>
                </div>
            ) : (
                <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-white">
                            <Clock size={20} />
                        </div>
                        <div>
                            <p className="font-semibold text-amber-800 dark:text-amber-200">Sin Turno Abierto</p>
                            <p className="text-sm text-amber-600 dark:text-amber-400">
                                Abre un turno para comenzar a operar
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => navigate('/cash')}
                        className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                    >
                        Abrir Caja
                    </button>
                </div>
            )}

            {/* Quick Access Grid */}
            <div className="mb-8">
                <h2 className="text-lg font-semibold text-foreground mb-4">Acceso Rápido</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {accessibleItems.map((item) => (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`${item.color} text-white rounded-xl p-6 flex flex-col items-center gap-3 transition-all transform hover:scale-105 shadow-lg`}
                        >
                            <item.icon className="w-8 h-8" />
                            <span className="font-semibold">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Row */}
            {loading ? (
                <div className="flex items-center justify-center h-32">
                    <Loader2 className="animate-spin text-primary" size={32} />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Today's Sales */}
                    <div className="bg-card border border-border rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                            </div>
                            <span className="text-sm font-medium text-muted-foreground">Ventas Hoy</span>
                        </div>
                        <p className="text-3xl font-bold text-foreground">
                            ${summary?.totalRevenue.toFixed(2) || '0.00'}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                            {summary?.orderCount || 0} órdenes
                        </p>
                    </div>

                    {/* Average Ticket */}
                    <div className="bg-card border border-border rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="text-sm font-medium text-muted-foreground">Ticket Promedio</span>
                        </div>
                        <p className="text-3xl font-bold text-foreground">
                            ${summary?.averageTicket.toFixed(2) || '0.00'}
                        </p>
                    </div>

                    {/* Low Stock Alerts */}
                    <div className="bg-card border border-border rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`p-2 rounded-lg ${lowStock.length > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                                <AlertTriangle className={`w-5 h-5 ${lowStock.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} />
                            </div>
                            <span className="text-sm font-medium text-muted-foreground">Stock Bajo</span>
                        </div>
                        <p className="text-3xl font-bold text-foreground">
                            {lowStock.length}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                            {lowStock.length > 0 ? 'ingredientes críticos' : 'Todo OK'}
                        </p>
                    </div>
                </div>
            )}

            {/* Low Stock Details */}
            {lowStock.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        <h3 className="font-semibold text-red-800 dark:text-red-200">Alertas de Stock</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {lowStock.slice(0, 5).map((item) => (
                            <span 
                                key={item.id}
                                className="bg-red-100 dark:bg-red-800/50 text-red-700 dark:text-red-200 px-3 py-1 rounded-full text-sm font-medium"
                            >
                                {item.name}: {item.currentStock.toFixed(1)} {item.unit}
                            </span>
                        ))}
                        {lowStock.length > 5 && (
                            <button 
                                onClick={() => navigate('/admin/ingredients')}
                                className="text-red-700 dark:text-red-300 underline text-sm font-medium"
                            >
                                +{lowStock.length - 5} más
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
