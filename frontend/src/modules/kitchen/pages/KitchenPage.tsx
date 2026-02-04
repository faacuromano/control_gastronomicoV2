import React, { useEffect, useState } from 'react';
import { useSocket } from '../../../context/SocketContext';
import { TicketCard, type KitchenOrder, type KitchenOrderItem } from './components/TicketCard';
import { orderService } from '../../../services/orderService';
import { useKitchenStore } from '../../../store/kitchen.store';
import * as kdsStationService from '../../../services/kdsStationService';
import type { KdsStation } from '../../../services/kdsStationService';
import { BellOff, ChefHat, Clock, Flame, RefreshCw, Sparkles, Volume2, Wifi, WifiOff, MonitorPlay } from 'lucide-react';

export const KitchenPage: React.FC = () => {
  const { socket, isConnected } = useSocket();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [stations, setStations] = useState<KdsStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Store
  const { activeStation, setStation, soundEnabled, setSoundEnabled } = useKitchenStore();

  // Cargar estaciones al montar
  useEffect(() => {
    const loadStations = async () => {
      try {
        const data = await kdsStationService.getStations();
        setStations(data.filter(s => s.isActive));
      } catch (e) {
        console.error("Failed to load KDS stations", e);
      }
    };
    loadStations();
  }, []);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Cargar ordenes cuando cambia la estacion
  useEffect(() => {
    loadActiveOrders();
  }, [activeStation]);

  // Socket events
  useEffect(() => {
    if (socket && isConnected) {
        socket.emit('join:kitchen');
        if (activeStation !== 'ALL') {
             // Join station-specific room (backend sanitizes the station code)
             socket.emit('join:kitchen:station', activeStation.toUpperCase());
        }

        socket.on('kitchen:order_new', (newOrder) => {
            setOrders(prev => [...prev, newOrder]);
            if (soundEnabled) playSuccessSound();
        });

        socket.on('kitchen:items_new', (payload) => {
            // Nuevos items para esta estacion - recargar ordenes
            if (activeStation === 'ALL' || payload.stationCode === activeStation) {
                loadActiveOrders();
                if (soundEnabled) playSuccessSound();
            }
        });

        socket.on('order:new', (newOrder) => {
             setOrders(prev => {
                 if (prev.find(o => o.id === newOrder.id)) return prev;
                 if (soundEnabled) playSuccessSound();
                 return [...prev, newOrder];
             });
        });

        socket.on('kitchen:order_update', (updatedOrder) => {
            setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
        });

        socket.on('order:update', (updatedOrder) => {
             setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
        });

        return () => {
            socket.off('kitchen:order_new');
            socket.off('kitchen:items_new');
            socket.off('kitchen:order_update');
            socket.off('order:new');
            socket.off('order:update');
        };
    }
  }, [socket, isConnected, activeStation, soundEnabled]);

  const loadActiveOrders = async () => {
      setLoading(true);
      try {
          // Pasar codigo de estacion al API (undefined para ALL)
          const stationCode = activeStation === 'ALL' ? undefined : activeStation;
          const data = await orderService.getActiveOrders(stationCode);
          setOrders(data);
      } catch (e) {
          console.error("Failed to load KDS orders", e);
      } finally {
          setLoading(false);
      }
  };

  const playSuccessSound = () => {
     try {
         // Intentar reproducir el archivo local primero
         const audio = new Audio('/sounds/bell.mp3');
         audio.volume = 0.5;
         audio.play().catch(() => {
             // Fallback: usar Web Audio API para generar un beep
             try {
                 const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
                 const oscillator = audioContext.createOscillator();
                 const gainNode = audioContext.createGain();

                 oscillator.connect(gainNode);
                 gainNode.connect(audioContext.destination);

                 oscillator.frequency.value = 800; // Frecuencia del tono
                 oscillator.type = 'sine';
                 gainNode.gain.value = 0.3;

                 oscillator.start();
                 oscillator.stop(audioContext.currentTime + 0.2); // Duracion: 200ms
             } catch {
                 // Audio no disponible
             }
         });
     } catch {
         // ignore
     }
  };

  const handleStatusChange = async (orderId: number, status: string) => {
      try {
          const updatedOrder = await orderService.updateStatus(orderId, status);
          setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
      } catch (e) {
          console.error("Failed to update status", e);
      }
  };

  const handleItemChange = async (itemId: number, status: string) => {
      setOrders(prev => prev.map(order => ({
          ...order,
          items: order.items.map((item: KitchenOrderItem) =>
              item.id === itemId ? { ...item, status } : item
          )
      })));
      try {
          await orderService.updateItemStatus(itemId, status);
      } catch (e) {
          console.error("Failed item update", e);
          loadActiveOrders();
      }
  };

  const handleMarkServed = async (orderId: number) => {
      try {
          await orderService.markAllItemsServed(orderId);
          await orderService.updateStatus(orderId, 'DELIVERED');
          setOrders(prev => prev.filter(o => o.id !== orderId));
      } catch (e) {
          console.error("Failed to mark items as served", e);
      }
  };

  // Sort orders by status (el filtro por estacion ya viene del backend)
  const pendingOrders = orders.filter(o => o.status === 'PENDING' || o.status === 'OPEN' || o.status === 'CONFIRMED').sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const prepOrders = orders.filter(o => o.status === 'IN_PREPARATION' || o.status === 'COOKING').sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const readyOrders = orders.filter(o => o.status === 'READY' || o.status === 'PREPARED').sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  if (loading) {
    return (
      <div className="h-[100dvh] bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <ChefHat className="w-10 h-10 text-primary animate-pulse" />
          <p className="text-muted-foreground">Cargando cocina...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-muted/30 text-foreground flex flex-col overflow-hidden">

      {/* Header - Clean & Functional */}
      <header className="shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="flex justify-between items-center gap-4">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Flame className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                {activeStation === 'ALL' ? 'Cocina' : stations.find(s => s.code === activeStation)?.name || 'Cocina'}
              </h1>
              <p className="text-xs text-muted-foreground">Kitchen Display</p>
            </div>
          </div>

          {/* Center: Station Selector */}
          <div className="hidden lg:flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
            <button
              onClick={() => setStation('ALL')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeStation === 'ALL'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              Todos
            </button>
            {stations.map(station => (
              <button
                key={station.id}
                onClick={() => setStation(station.code)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  activeStation === station.code
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <MonitorPlay className="w-3.5 h-3.5" />
                {station.name}
              </button>
            ))}
          </div>

          {/* Mobile Station Selector */}
          <select
            value={activeStation}
            onChange={(e) => setStation(e.target.value)}
            className="lg:hidden px-3 py-2 bg-muted border border-border rounded-lg text-sm"
          >
            <option value="ALL">Todas las estaciones</option>
            {stations.map(station => (
              <option key={station.id} value={station.code}>
                {station.name}
              </option>
            ))}
          </select>

          {/* Center: Clock (hidden on mobile) */}
          <div className="hidden md:flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="font-mono text-sm">
              {currentTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2">
            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-lg transition-colors ${
                soundEnabled
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
              title={soundEnabled ? 'Sonido activado' : 'Sonido desactivado'}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
            </button>

            {/* Refresh */}
            <button
              onClick={loadActiveOrders}
              className="p-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Actualizar"
            >
              <RefreshCw className="w-5 h-5" />
            </button>

            {/* Connection Status */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-600'
                : 'bg-red-500/10 text-red-600'
            }`}>
              {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{isConnected ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden p-3 lg:p-4">
        <div className="grid grid-cols-3 gap-3 lg:gap-4 h-full">

          {/* Column: Pending - Red Theme */}
          <KanbanColumn
            title="Pendientes"
            count={pendingOrders.length}
            color="red"
            icon={<Clock className="w-5 h-5" />}
            emptyIcon="⏳"
            emptyText="Sin pedidos pendientes"
          >
            {pendingOrders.map((order, index) => (
              <div
                key={order.id}
                className="animate-slide-in-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <TicketCard
                  order={order}
                  onStatusChange={handleStatusChange}
                  onItemChange={handleItemChange}
                />
              </div>
            ))}
          </KanbanColumn>

          {/* Column: In Prep - Amber Theme */}
          <KanbanColumn
            title="En Cocina"
            count={prepOrders.length}
            color="amber"
            icon={<Flame className="w-5 h-5" />}
            emptyIcon="🔥"
            emptyText="Nada cocinándose"
          >
            {prepOrders.map((order, index) => (
              <div
                key={order.id}
                className="animate-slide-in-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <TicketCard
                  order={order}
                  onStatusChange={handleStatusChange}
                  onItemChange={handleItemChange}
                />
              </div>
            ))}
          </KanbanColumn>

          {/* Column: Ready - Green Theme */}
          <KanbanColumn
            title="Listos para Servir"
            count={readyOrders.length}
            color="emerald"
            icon={<Sparkles className="w-5 h-5" />}
            emptyIcon="✨"
            emptyText="Todo servido"
          >
            {readyOrders.map((order, index) => (
              <div
                key={order.id}
                className="animate-slide-in-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <TicketCard
                  order={order}
                  onStatusChange={handleStatusChange}
                  onMarkServed={handleMarkServed}
                  isHistory={false}
                />
              </div>
            ))}
          </KanbanColumn>
        </div>
      </div>

      {/* Bottom stats bar */}
      <footer className="shrink-0 border-t border-border bg-card px-4 py-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <StatBadge label="Total" value={orders.length} />
            <StatBadge label="Pendientes" value={pendingOrders.length} color="red" />
            <StatBadge label="Cocina" value={prepOrders.length} color="amber" />
            <StatBadge label="Listos" value={readyOrders.length} color="emerald" />
          </div>
          {activeStation !== 'ALL' && (
            <div className="text-xs text-muted-foreground">
              Estación: <span className="font-medium text-foreground">{stations.find(s => s.code === activeStation)?.name || activeStation}</span>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};

// Kanban Column Component
interface KanbanColumnProps {
  title: string;
  count: number;
  color: 'red' | 'amber' | 'emerald';
  icon: React.ReactNode;
  emptyIcon: string;
  emptyText: string;
  children: React.ReactNode;
}

const colorClasses = {
  red: {
    header: 'bg-red-50 border-red-200',
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-700',
    text: 'text-red-700',
  },
  amber: {
    header: 'bg-amber-50 border-amber-200',
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700',
    text: 'text-amber-700',
  },
  emerald: {
    header: 'bg-emerald-50 border-emerald-200',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700',
    text: 'text-emerald-700',
  },
};

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  title, count, color, icon, emptyIcon, emptyText, children
}) => {
  const colors = colorClasses[color];
  const hasItems = React.Children.count(children) > 0;

  return (
    <div className="flex flex-col bg-card rounded-xl border border-border h-full overflow-hidden">
      {/* Header */}
      <div className={`p-3 border-b ${colors.header}`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
            <h2 className={`font-semibold ${colors.text}`}>{title}</h2>
          </div>
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${colors.badge} text-sm font-semibold`}>
            {icon}
            <span>{count}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {hasItems ? children : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 py-8">
            <span className="text-3xl mb-2">{emptyIcon}</span>
            <p className="text-sm">{emptyText}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Stat Badge Component
interface StatBadgeProps {
  label: string;
  value: number;
  color?: 'red' | 'amber' | 'emerald';
}

const StatBadge: React.FC<StatBadgeProps> = ({ label, value, color }) => {
  const colorClass = color
    ? color === 'red' ? 'text-red-600'
    : color === 'amber' ? 'text-amber-600'
    : 'text-emerald-600'
    : 'text-foreground';

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className={`font-semibold ${colorClass}`}>{value}</span>
    </div>
  );
};
