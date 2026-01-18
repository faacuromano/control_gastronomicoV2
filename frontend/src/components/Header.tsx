import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useTheme } from '../hooks/useTheme';
import { LogOut, User, Moon, Sun, ShoppingCart, Utensils, Settings, Wallet, Monitor, Bell, Truck } from 'lucide-react';
import { configService, type TenantConfig } from '../services/configService';
import { CloseShiftModal } from './cash/CloseShiftModal';
import { useSocket } from '../context/SocketContext';
import { useCashStore } from '../store/cash.store';
import { StockAlertBadge } from './alerts/StockAlertBadge';

export default function Header() {
    const location = useLocation();
    const navigate = useNavigate();
    const logout = useAuthStore((state) => state.logout);
    const user = useAuthStore((state) => state.user);
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { isDark, toggleTheme } = useTheme();
    const { socket } = useSocket();
    
    const checkShiftStatus = useCashStore((state) => state.checkShiftStatus);
    const shift = useCashStore((state) => state.shift);

    const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
    const [readyCount, setReadyCount] = useState(0);
    const [features, setFeatures] = useState<TenantConfig['features'] | null>(null);
    const [showNotifications, setShowNotifications] = useState(false);
    const [readyOrders, setReadyOrders] = useState<{ id: number; orderNumber: number; tableId?: number }[]>([]);

    useEffect(() => {
        checkShiftStatus();
        loadFeatureFlags();
        
        if (socket) {
            socket.on('order:update', (order: any) => {
                if (order.status === 'PREPARED') {
                    setReadyCount(prev => prev + 1);
                    setReadyOrders(prev => [
                        ...prev.filter(o => o.id !== order.id),
                        { id: order.id, orderNumber: order.orderNumber, tableId: order.tableId }
                    ]);
                    const audio = new Audio('/sounds/bell.mp3');
                    audio.play().catch(() => {});
                }
            });
            
            return () => {
                socket.off('order:update');
            };
        }
    }, [socket]);

    const loadFeatureFlags = async () => {
        try {
            const config = await configService.getConfig();
            setFeatures(config.features);
        } catch (err) {
            // Default to showing all if config fails
            setFeatures({
                enableStock: true,
                enableDelivery: true,
                enableKDS: true,
                enableFiscal: false,
                enableDigital: false
            });
        }
    };

    const handleBellClick = () => {
        setShowNotifications(prev => !prev);
    };

    const dismissNotification = (orderId: number) => {
        setReadyOrders(prev => prev.filter(o => o.id !== orderId));
        setReadyCount(prev => Math.max(0, prev - 1));
    };

    const clearAllNotifications = () => {
        setReadyOrders([]);
        setReadyCount(0);
        setShowNotifications(false);
    };



    const handleShiftClosed = () => {
        setShowCloseShiftModal(false);
        navigate('/');
    };

    const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

    return (
        <>
            <header className="bg-background border-b border-border px-6 py-3 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-8">
                    <h1 
                        className="text-2xl font-bold tracking-tight cursor-pointer hover:text-primary transition-colors" 
                        onClick={() => navigate('/')}
                    >
                        PentiumPOS
                    </h1>
                    
                    {/* Dynamic Module Navigation - Permission & Feature Flag Aware */}
                    <nav className="flex items-center gap-2">
                        {/* POS: Module Permission */}
                        {hasPermission('pos', 'access') && (
                            <button
                                onClick={() => navigate('/ventas')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                                    isActive('/ventas') 
                                        ? 'bg-primary text-primary-foreground shadow-sm' 
                                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                }`}
                            >
                                <ShoppingCart className="h-4 w-4" />
                                Venta
                            </button>
                        )}
                        
                        {/* Tables: Module Permission */}
                        {hasPermission('tables', 'access') && (
                            <button
                                onClick={() => navigate('/tables')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                                    isActive('/tables') 
                                        ? 'bg-primary text-primary-foreground shadow-sm' 
                                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                }`}
                            >
                                <Utensils className="h-4 w-4" />
                                Mesas
                            </button>
                        )}

                        {/* Cash: Module Permission */}
                        {hasPermission('cash', 'access') && (
                            <button
                                onClick={() => navigate('/cash')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                                    isActive('/cash') 
                                        ? 'bg-primary text-primary-foreground shadow-sm' 
                                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                }`}
                            >
                                <Wallet className="h-4 w-4" />
                                Caja
                            </button>
                        )}
                        
                        {/* KDS: Feature Flag + Module Permission */}
                        {features?.enableKDS && hasPermission('kds', 'access') && (
                            <button
                                onClick={() => navigate('/kitchen')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                                    isActive('/kitchen') 
                                        ? 'bg-primary text-primary-foreground shadow-sm' 
                                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                }`}
                            >
                                <Monitor className="h-4 w-4" />
                                Cocina
                            </button>
                        )}
                        
                        {/* Admin: Module Permission */}
                        {hasPermission('admin', 'access') && (
                            <button
                                onClick={() => navigate('/admin/products')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                                    isActive('/admin') 
                                        ? 'bg-primary text-primary-foreground shadow-sm' 
                                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                }`}
                            >
                                <Settings className="h-4 w-4" />
                                Admin
                            </button>
                        )}
                        
                        {/* Delivery: Feature Flag + Module Permission */}
                        {features?.enableDelivery && hasPermission('delivery', 'access') && (
                            <button
                                onClick={() => navigate('/delivery-dashboard')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                                    isActive('/delivery') 
                                        ? 'bg-primary text-primary-foreground shadow-sm' 
                                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                }`}
                            >
                                <Truck className="h-4 w-4" />
                                Delivery
                            </button>
                        )}
                    </nav>
                </div>
                
                <div className="flex items-center gap-4">
                    {/* Stock Alerts - Only for users with inventory access */}
                    {features?.enableStock && hasPermission('ingredients', 'read') && (
                        <StockAlertBadge />
                    )}

                    {/* Notifications */}
                    <div className="relative">
                        <button 
                            onClick={handleBellClick}
                            className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                            title="Notificaciones de Cocina"
                        >
                            <Bell className="w-5 h-5" />
                            {readyCount > 0 && (
                                <span className="absolute top-1 right-1 w-3 h-3 bg-red-600 rounded-full border-2 border-background"></span>
                            )}
                        </button>

                        {/* Notification Panel */}
                        {showNotifications && (
                            <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                                <div className="p-3 border-b border-border bg-muted/30 flex justify-between items-center">
                                    <span className="font-semibold text-sm">Pedidos Listos</span>
                                    {readyOrders.length > 0 && (
                                        <button 
                                            onClick={clearAllNotifications}
                                            className="text-xs text-muted-foreground hover:text-foreground"
                                        >
                                            Limpiar todo
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-64 overflow-y-auto">
                                    {readyOrders.length === 0 ? (
                                        <div className="p-6 text-center text-muted-foreground">
                                            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">No hay pedidos listos</p>
                                        </div>
                                    ) : (
                                        readyOrders.map(order => (
                                            <div 
                                                key={order.id}
                                                className="p-3 border-b border-border last:border-0 hover:bg-muted/20 flex justify-between items-center"
                                            >
                                                <div>
                                                    <p className="font-medium">Orden #{order.orderNumber}</p>
                                                    {order.tableId && (
                                                        <p className="text-xs text-muted-foreground">Mesa {order.tableId}</p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => dismissNotification(order.id)}
                                                    className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors"
                                                >
                                                    Enterado
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Close Shift Button */}
                    {shift && (
                        <>
                        <div className="flex items-center gap-2 px-3 py-2 bg-green-600/20 text-green-600 rounded-lg font-medium" data-testid="shift-status">
                            <Wallet className="h-4 w-4" />
                            Caja Abierta
                        </div>
                        <button
                            onClick={() => setShowCloseShiftModal(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors"
                            title="Cerrar turno de caja"
                            data-testid="btn-close-shift"
                        >
                            <Wallet className="h-4 w-4" />
                            Cerrar Turno
                        </button>
                        </>
                    )}

                    {/* Theme Toggle */}
                    <button 
                        onClick={toggleTheme}
                        className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent"
                        title={isDark ? 'Modo claro' : 'Modo oscuro'}
                    >
                        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>

                    <div className="flex items-center gap-3 pl-4 border-l border-border">
                        <div className="flex flex-col items-end">
                            <span className="text-sm font-medium">{user?.name || 'User'}</span>
                            <span className="text-xs text-muted-foreground">{user?.role || 'Staff'}</span>
                        </div>
                        <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                            <User className="w-5 h-5" />
                        </div>
                    </div>

                    <button 
                        onClick={() => logout()}
                        className="ml-2 p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        title="Cerrar sesión"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <CloseShiftModal
                isOpen={showCloseShiftModal}
                onClose={() => setShowCloseShiftModal(false)}
                onShiftClosed={handleShiftClosed}
            />
        </>
    );
}
