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
        console.log('[KDS] Socket connected!', {
            socketId: socket.id,
            connected: socket.connected,
            activeStation
        });

        // Debug: Listen for ALL events to verify socket is working
        socket.onAny((eventName, ...args) => {
            console.log('[KDS] Event received:', eventName, args);
        });

        // Siempre unirse a la cocina general para eventos de actualizacion
        socket.emit('join:kitchen');
        console.log('[KDS] Emitted join:kitchen');

        // Si hay una estacion especifica, tambien unirse a su room
        if (activeStation !== 'ALL') {
             socket.emit('join:kitchen:station', activeStation.toUpperCase());
             console.log('[KDS] Joined station room:', activeStation.toUpperCase());
        }

        // Eventos de nueva orden - solo agregar si estamos en vista ALL
        // Para vistas de estacion, kitchen:items_new manejara la carga
        socket.on('kitchen:order_new', (newOrder) => {
            console.log('[KDS] kitchen:order_new received:', newOrder?.id, 'activeStation:', activeStation);
            if (activeStation === 'ALL') {
                setOrders(prev => {
                    if (prev.find(o => o.id === newOrder.id)) return prev;
                    if (soundEnabled) playSuccessSound();
                    return [...prev, newOrder];
                });
            }
        });

        // Nuevos items para estaciones - este es el evento principal para vistas filtradas
        socket.on('kitchen:items_new', (payload) => {
            console.log('[KDS] kitchen:items_new received:', payload?.stationCode, 'orderId:', payload?.orderId, 'activeStation:', activeStation);
            if (activeStation === 'ALL' || payload.stationCode === activeStation) {
                console.log('[KDS] Reloading orders...');
                // Recargar para obtener los items filtrados correctamente
                loadActiveOrders();
                if (soundEnabled) playSuccessSound();
            }
        });

        // Evento legacy - solo procesar en vista ALL para evitar duplicados
        socket.on('order:new', (newOrder) => {
            console.log('[KDS] order:new received:', newOrder?.id, 'activeStation:', activeStation);
            if (activeStation === 'ALL') {
                setOrders(prev => {
                    if (prev.find(o => o.id === newOrder.id)) return prev;
                    if (soundEnabled) playSuccessSound();
                    return [...prev, newOrder];
                });
            }
        });

        // Actualizaciones de orden - mantener items filtrados por estacion
        // IMPORTANTE: El backend envía la orden completa con TODOS los items,
        // pero si estamos viendo una estación específica, debemos mantener solo
        // los items de esa estación (que ya fueron filtrados por el API)
        socket.on('kitchen:order_update', (updatedOrder) => {
            console.log('[KDS] kitchen:order_update received:', updatedOrder?.id);
            setOrders(prev => prev.map(o => {
                if (o.id !== updatedOrder.id) return o;
                // Actualizar el status de la orden pero mantener los items filtrados
                // Solo actualizar items que existen en nuestra vista actual
                const updatedItems = o.items.map((item: KitchenOrderItem) => {
                    const serverItem = updatedOrder.items?.find((i: KitchenOrderItem) => i.id === item.id);
                    return serverItem ? { ...item, status: serverItem.status } : item;
                });
                return { ...o, status: updatedOrder.status, items: updatedItems };
            }));
        });

        socket.on('order:update', (updatedOrder) => {
            console.log('[KDS] order:update received:', updatedOrder?.id);
            setOrders(prev => prev.map(o => {
                if (o.id !== updatedOrder.id) return o;
                // Mismo tratamiento: mantener items filtrados, actualizar status
                const updatedItems = o.items.map((item: KitchenOrderItem) => {
                    const serverItem = updatedOrder.items?.find((i: KitchenOrderItem) => i.id === item.id);
                    return serverItem ? { ...item, status: serverItem.status } : item;
                });
                return { ...o, status: updatedOrder.status, items: updatedItems };
            }));
        });

        // Actualización de item individual
        socket.on('kitchen:item_update', (payload) => {
            console.log('[KDS] kitchen:item_update received:', payload);
            setOrders(prev => prev.map(order => {
                if (order.id !== payload.orderId) return order;
                return {
                    ...order,
                    items: order.items.map((item: KitchenOrderItem) =>
                        item.id === payload.itemId ? { ...item, status: payload.status } : item
                    )
                };
            }));
        });

        return () => {
            socket.offAny(); // Remove debug listener
            socket.off('kitchen:order_new');
            socket.off('kitchen:items_new');
            socket.off('kitchen:order_update');
            socket.off('order:new');
            socket.off('order:update');
            socket.off('kitchen:item_update');
        };
    }
  }, [socket, isConnected, activeStation, soundEnabled]);

  const loadActiveOrders = async () => {
      console.log('[KDS] loadActiveOrders called, activeStation:', activeStation);
      setLoading(true);
      try {
          // Pasar codigo de estacion al API (undefined para ALL)
          const stationCode = activeStation === 'ALL' ? undefined : activeStation;
          const data = await orderService.getActiveOrders(stationCode);
          console.log('[KDS] Loaded orders:', data.length, 'orders');
          setOrders(data);
      } catch (e) {
          console.error("[KDS] Failed to load KDS orders", e);
      } finally {
          setLoading(false);
      }
  };

  // AudioContext persistente para evitar problemas de autoplay
  const audioContextRef = React.useRef<AudioContext | null>(null);

  const playSuccessSound = () => {
     try {
         // Usar Web Audio API directamente (mas confiable que archivos externos)
         if (!audioContextRef.current) {
             audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
         }

         const audioContext = audioContextRef.current;

         // Reanudar si esta suspendido (requiere interaccion previa del usuario)
         if (audioContext.state === 'suspended') {
             audioContext.resume();
         }

         // Crear un sonido de "ding" agradable con dos tonos
         const now = audioContext.currentTime;

         // Tono principal (campana)
         const osc1 = audioContext.createOscillator();
         const gain1 = audioContext.createGain();
         osc1.connect(gain1);
         gain1.connect(audioContext.destination);
         osc1.frequency.value = 880; // A5
         osc1.type = 'sine';
         gain1.gain.setValueAtTime(0.3, now);
         gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
         osc1.start(now);
         osc1.stop(now + 0.5);

         // Tono secundario (armónico)
         const osc2 = audioContext.createOscillator();
         const gain2 = audioContext.createGain();
         osc2.connect(gain2);
         gain2.connect(audioContext.destination);
         osc2.frequency.value = 1320; // E6
         osc2.type = 'sine';
         gain2.gain.setValueAtTime(0.15, now);
         gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
         osc2.start(now);
         osc2.stop(now + 0.3);
     } catch {
         // Audio no disponible en este navegador
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

  // Determinar el estado efectivo de una orden basado en sus items
  // Cuando vemos una estación específica, el estado debe derivarse de los items visibles
  const getEffectiveStatus = (order: KitchenOrder): 'pending' | 'cooking' | 'ready' => {
      const items = order.items;
      if (items.length === 0) return 'pending';

      // Si todos los items están READY o SERVED, la orden está lista
      const allReady = items.every(i => i.status === 'READY' || i.status === 'SERVED');
      if (allReady) return 'ready';

      // Si algún item está COOKING, la orden está en preparación
      const hasCooking = items.some(i => i.status === 'COOKING');
      if (hasCooking) return 'cooking';

      // Por defecto, pendiente
      return 'pending';
  };

  // Filtrar y ordenar órdenes según estado
  // Cuando hay estación activa, derivar estado de los items; de lo contrario usar status de orden
  const categorizeOrder = (order: KitchenOrder): 'pending' | 'cooking' | 'ready' => {
      if (activeStation !== 'ALL') {
          // Para vistas filtradas, usar estado efectivo basado en items
          return getEffectiveStatus(order);
      }
      // Para vista "Todos", usar el estado de la orden
      if (['PENDING', 'OPEN', 'CONFIRMED'].includes(order.status)) return 'pending';
      if (['IN_PREPARATION', 'COOKING'].includes(order.status)) return 'cooking';
      if (['READY', 'PREPARED'].includes(order.status)) return 'ready';
      return 'pending';
  };

  const pendingOrders = orders.filter(o => categorizeOrder(o) === 'pending').sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const prepOrders = orders.filter(o => categorizeOrder(o) === 'cooking').sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const readyOrders = orders.filter(o => categorizeOrder(o) === 'ready').sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
            {/* Sound Toggle - click to toggle, long-press/double-click to test sound */}
            <button
              onClick={() => {
                const newEnabled = !soundEnabled;
                setSoundEnabled(newEnabled);
                // Play sound on enable to verify it works (and to satisfy browser interaction requirement)
                if (newEnabled) {
                  playSuccessSound();
                }
              }}
              className={`p-2 rounded-lg transition-colors ${
                soundEnabled
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
              title={soundEnabled ? 'Sonido activado (click para desactivar)' : 'Sonido desactivado (click para activar)'}
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
                  itemLevelOnly={activeStation !== 'ALL'}
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
                  itemLevelOnly={activeStation !== 'ALL'}
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
                  onItemChange={handleItemChange}
                  onMarkServed={handleMarkServed}
                  isHistory={false}
                  itemLevelOnly={activeStation !== 'ALL'}
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
