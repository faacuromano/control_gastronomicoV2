import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useTheme } from '../hooks/useTheme';
import { LogOut, User, Moon, Sun, ShoppingCart, Utensils, Settings, Wallet, Monitor, Bell, Truck } from 'lucide-react';
import { configService, type TenantConfig } from '../services/configService';
import { CloseShiftModal } from './cash/CloseShiftModal';
import { useSocket } from '../context/SocketContext';
import { useCashStore } from '../store/cash.store';

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

    useEffect(() => {
        checkShiftStatus();
        loadFeatureFlags();
        
        if (socket) {
            socket.on('order:update', (order: any) => {
                if (order.status === 'PREPARED') {
                    setReadyCount(prev => prev + 1);
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
        setReadyCount(0);
        navigate('/pos'); // Or Kitchen? Usually waiter wants to see orders or just clear notification
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
                    
                    {/* Dynamic Module Navigation - Feature Flag Aware */}
                    <nav className="flex items-center gap-2">
                        {/* Core: Always visible */}
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
                        
                        {/* Core: Always visible */}
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

                        {/* Cash: Permission Controlled */}
                        {hasPermission('cash', 'read') && (
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
                        
                        {/* KDS: Feature Flag Controlled */}
                        {features?.enableKDS && (
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
                        
                        {/* Admin: Always visible */}
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
                        
                        {/* Delivery: Feature Flag Controlled */}
                        {features?.enableDelivery && (
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
                    {/* Notifications */}
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
