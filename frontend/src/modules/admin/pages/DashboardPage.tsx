import React, { useState, useEffect } from 'react';
import { 
    DollarSign, ShoppingCart, TrendingUp, TrendingDown, 
    Package, AlertTriangle, Loader2, BarChart3, Wallet, Calendar, ChevronRight
} from 'lucide-react';
import { 
    analyticsService, 
    type SalesSummary, 
    type TopProduct, 
    type PaymentBreakdown,
    type LowStockItem,
    type DailySales
} from '../../../services/analyticsService';
import { cashShiftService, type CashShift } from '../../../services/cashShiftService';
import { useNavigate } from 'react-router-dom';

// Payment method labels
const PAYMENT_LABELS: Record<string, string> = {
    CASH: 'Efectivo',
    CARD: 'Tarjeta',
    TRANSFER: 'Transferencia',
    QR_INTEGRATED: 'QR MP',
    ONLINE: 'Online'
};

type DatePreset = 'today' | 'week' | 'month' | 'custom';

// FIX DS-002: Use local timezone for date formatting, not UTC
const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getDateRange = (preset: DatePreset): { startDate: string; endDate: string } | undefined => {
    const now = new Date();
    const end = formatLocalDate(now);
    
    switch (preset) {
        case 'today':
            return undefined; // Let backend use default today range (same as Home)
        case 'week': {
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return { startDate: formatLocalDate(weekAgo), endDate: end };
        }
        case 'month': {
            const monthAgo = new Date(now);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return { startDate: formatLocalDate(monthAgo), endDate: end };
        }
        default:
            return undefined;
    }
};

export const DashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [datePreset, setDatePreset] = useState<DatePreset>('today');
    
    const [summary, setSummary] = useState<SalesSummary | null>(null);
    const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
    const [payments, setPayments] = useState<PaymentBreakdown[]>([]);
    const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
    const [dailySales, setDailySales] = useState<DailySales[]>([]);
    const [recentShifts, setRecentShifts] = useState<CashShift[]>([]);

    useEffect(() => {
        loadData();
    }, [datePreset]);

    const loadData = async () => {
        setLoading(true);
        try {
            const range = getDateRange(datePreset);
            const startDate = range?.startDate;
            const endDate = range?.endDate;
            
            const [summaryData, productsData, paymentsData, stockData, dailyData, shiftsData] = await Promise.all([
                analyticsService.getSalesSummary(startDate, endDate),
                analyticsService.getTopProducts(5, startDate, endDate),
                analyticsService.getPaymentBreakdown(startDate, endDate),
                analyticsService.getLowStockItems(),
                analyticsService.getDailySales(startDate, endDate),
                cashShiftService.getAll({ fromDate: startDate })
            ]);
            
            setSummary(summaryData);
            setTopProducts(productsData);
            setPayments(paymentsData);
            setLowStock(stockData);
            setDailySales(dailyData);
            setRecentShifts(shiftsData.slice(0, 5));
        } catch (error) {
            console.error('Failed to load analytics', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
    // FIX NL-007: Defensive guard against null/undefined dates
    const formatTime = (date: string | null | undefined) => {
        if (!date) return '';
        return new Date(date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    };
    const formatDate = (date: string) => new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        );
    }

    const maxSales = Math.max(...dailySales.map(d => d.total), 1);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header with Period Selector */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
                    <p className="text-sm text-muted-foreground">Analíticas y estadísticas del negocio</p>
                </div>
                
                <div className="flex bg-muted rounded-lg p-1 border border-border">
                    {(['today', 'week', 'month'] as DatePreset[]).map((preset) => (
                        <button
                            key={preset}
                            onClick={() => setDatePreset(preset)}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                                datePreset === preset 
                                    ? 'bg-primary text-primary-foreground shadow' 
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {preset === 'today' ? 'Hoy' : preset === 'week' ? 'Semana' : 'Mes'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Revenue */}
                <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground shadow-lg">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-primary-foreground/80 text-sm font-medium">Ventas Totales</p>
                            <p className="text-4xl font-black mt-2">{formatCurrency(summary?.totalRevenue || 0)}</p>
                        </div>
                        <div className="bg-white/20 p-3 rounded-xl">
                            <DollarSign size={24} />
                        </div>
                    </div>
                    {summary && summary.revenueChange !== 0 && (
                        <div className={`mt-4 flex items-center gap-1 text-sm ${summary.revenueChange > 0 ? 'text-green-200' : 'text-red-200'}`}>
                            {summary.revenueChange > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                            <span>{Math.abs(summary.revenueChange).toFixed(1)}% vs período anterior</span>
                        </div>
                    )}
                </div>

                {/* Order Count */}
                <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-muted-foreground text-sm font-medium">Órdenes</p>
                            <p className="text-4xl font-black text-foreground mt-2">{summary?.orderCount || 0}</p>
                        </div>
                        <div className="bg-primary/10 text-primary p-3 rounded-xl">
                            <ShoppingCart size={24} />
                        </div>
                    </div>
                </div>

                {/* Average Ticket */}
                <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-muted-foreground text-sm font-medium">Ticket Promedio</p>
                            <p className="text-4xl font-black text-foreground mt-2">{formatCurrency(summary?.averageTicket || 0)}</p>
                        </div>
                        <div className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 p-3 rounded-xl">
                            <BarChart3 size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Daily Sales Chart */}
                <div className="lg:col-span-2 bg-card rounded-2xl p-6 shadow-lg border border-border">
                    <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                        <Calendar size={20} className="text-primary" />
                        Ventas por Día
                    </h2>
                    {dailySales.length === 0 ? (
                        <div className="h-48 flex items-center justify-center text-muted-foreground">
                            Sin datos de ventas
                        </div>
                    ) : (
                        <div className="h-48 flex items-end gap-1">
                            {dailySales.slice(-30).map((day, idx) => (
                                <div 
                                    key={idx} 
                                    className="flex-1 bg-primary rounded-t hover:bg-primary/80 transition-colors cursor-pointer group relative"
                                    style={{ height: `${(day.total / maxSales) * 100}%`, minHeight: '4px' }}
                                    title={`${day.date}: ${formatCurrency(day.total)}`}
                                >
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-foreground text-background text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">
                                        {day.date.substring(5)}: {formatCurrency(day.total)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Top Products */}
                <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
                    <h2 className="text-lg font-bold text-foreground mb-4">Top Productos</h2>
                    {topProducts.length === 0 ? (
                        <div className="text-muted-foreground text-center py-8">Sin datos</div>
                    ) : (
                        <div className="space-y-3">
                            {topProducts.map((product, idx) => (
                                <div key={product.productId} className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-yellow-400 text-yellow-900' : idx === 1 ? 'bg-slate-300 text-slate-700' : idx === 2 ? 'bg-amber-600 text-amber-100' : 'bg-muted text-muted-foreground'}`}>
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-foreground truncate">{product.productName}</p>
                                        <p className="text-xs text-muted-foreground">{product.quantitySold} vendidos</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-foreground">{formatCurrency(product.revenue)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Second Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cash Shifts History */}
                <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <Wallet size={20} className="text-primary" />
                            Turnos de Caja
                        </h2>
                        <button 
                            onClick={() => navigate('/admin/cash-shifts')}
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                            Ver todos <ChevronRight size={16} />
                        </button>
                    </div>
                    {recentShifts.length === 0 ? (
                        <div className="text-muted-foreground text-center py-8">
                            <Wallet size={32} className="mx-auto mb-2 opacity-50" />
                            Sin turnos registrados
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {recentShifts.map((shift) => (
                                <div key={shift.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${shift.endTime ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
                                        <div>
                                            <p className="font-medium text-sm text-foreground">
                                                {formatDate(shift.startTime)} • {formatTime(shift.startTime)}
                                                {shift.endTime && ` - ${formatTime(shift.endTime)}`}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Inicio: {formatCurrency(Number(shift.startAmount))}
                                                {shift.endAmount && ` → Cierre: ${formatCurrency(Number(shift.endAmount))}`}
                                            </p>
                                        </div>
                                    </div>
                                    {shift.difference !== undefined && shift.difference !== null && (
                                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                                            shift.difference >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        }`}>
                                            {shift.difference >= 0 ? '+' : ''}{formatCurrency(shift.difference)}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Payment Methods */}
                <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
                    <h2 className="text-lg font-bold text-foreground mb-4">Métodos de Pago</h2>
                    {payments.length === 0 ? (
                        <div className="text-muted-foreground text-center py-8">Sin datos</div>
                    ) : (
                        <div className="space-y-3">
                            {payments.map(payment => (
                                <div key={payment.method} className="flex items-center gap-3">
                                    <div className="flex-1">
                                        <div className="flex justify-between mb-1">
                                            <span className="font-medium text-foreground">{PAYMENT_LABELS[payment.method] || payment.method}</span>
                                            <span className="text-muted-foreground">{payment.percentage.toFixed(1)}%</span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-primary rounded-full transition-all"
                                                style={{ width: `${payment.percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-right w-24">
                                        <p className="font-bold text-foreground">{formatCurrency(payment.total)}</p>
                                        <p className="text-xs text-muted-foreground">{payment.count} pagos</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Low Stock Alerts */}
            <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
                <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="text-amber-500" size={20} />
                    <h2 className="text-lg font-bold text-foreground">Stock Bajo</h2>
                    {lowStock.length > 0 && (
                        <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">
                            {lowStock.length}
                        </span>
                    )}
                </div>
                {lowStock.length === 0 ? (
                    <div className="text-green-600 dark:text-green-400 text-center py-8 flex flex-col items-center gap-2">
                        <Package size={32} className="text-green-400" />
                        <span>Todo el stock está OK</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {lowStock.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800/50">
                                <div>
                                    <p className="font-medium text-foreground">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">Mín: {item.minStock} {item.unit}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-red-600 dark:text-red-400">{item.currentStock.toFixed(1)}</p>
                                    <p className="text-xs text-red-500">-{item.deficit.toFixed(1)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
