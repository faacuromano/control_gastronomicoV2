import React, { useEffect, useState } from 'react';
import { useSocket } from '../../../context/SocketContext';
import { TicketCard } from './components/TicketCard';
import { orderService } from '../../../services/orderService';
import { useKitchenStore } from '../../../store/kitchen.store';
import { BellOff, RefreshCw, Volume2 } from 'lucide-react';

export const KitchenPage: React.FC = () => {
  const { socket, isConnected } = useSocket();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Store
  const { activeStation, soundEnabled, setSoundEnabled } = useKitchenStore();

  useEffect(() => {
    loadActiveOrders();

    if (socket && isConnected) {
        socket.emit('join:kitchen');
        if (activeStation !== 'ALL') {
             socket.emit('join:kitchen:station', activeStation.toLowerCase());
        }
        
        socket.on('kitchen:order_new', (newOrder) => { // Updated event name
            setOrders(prev => [...prev, newOrder]);
            if (soundEnabled) playSuccessSound();
        });

        // Legacy compatibility
        socket.on('order:new', (newOrder) => {
             // Check if we already added it (deduplication)
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
            socket.off('kitchen:order_update');
            socket.off('order:new');
            socket.off('order:update');
        };
    }
  }, [socket, isConnected, activeStation, soundEnabled]);

  const loadActiveOrders = async () => {
      try {
          const data = await orderService.getActiveOrders(); 
          setOrders(data);
      } catch (e) {
          console.error("Failed to load KDS orders", e);
      } finally {
          setLoading(false);
      }
  };

  const playSuccessSound = () => {
     try {
         const audio = new Audio('/sounds/bell.mp3'); // We need to add this asset later or use B64
         audio.play().catch(e => console.log("Audio autoplay blocked", e));
     } catch (e) {
         // ignore
     }
  };

  const handleStatusChange = async (orderId: number, status: string) => {
      try {
          const updatedOrder = await orderService.updateStatus(orderId, status);
          // Update local state immediately with API response
          setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
      } catch (e) {
          console.error("Failed to update status", e);
      }
  };

  const handleItemChange = async (itemId: number, status: string) => {
      // Optimistic update: reflect item status change immediately
      setOrders(prev => prev.map(order => ({
          ...order,
          items: order.items.map((item: any) =>
              item.id === itemId ? { ...item, status } : item
          )
      })));
      try {
          await orderService.updateItemStatus(itemId, status);
      } catch (e) {
          console.error("Failed item update", e);
          // Revert on failure by reloading
          loadActiveOrders();
      }
  };

  const handleMarkServed = async (orderId: number) => {
      try {
          await orderService.markAllItemsServed(orderId);
          const updatedOrder = await orderService.updateStatus(orderId, 'DELIVERED');
          // Remove delivered order from KDS
          setOrders(prev => prev.filter(o => o.id !== orderId));
      } catch (e) {
          console.error("Failed to mark items as served", e);
      }
  };

  if (loading) return <div className="p-10 text-white text-center flex items-center justify-center h-screen"><RefreshCw className="animate-spin mr-2" /> Loading KDS...</div>;

  // Filter Logic (Mocked for now as stations are not fully in backend)
  const filteredOrders = orders.filter(_o => activeStation === 'ALL' ? true : true); 

  // Kanban Columns
  const pendingOrders = filteredOrders.filter(o => o.status === 'PENDING' || o.status === 'OPEN' || o.status === 'CONFIRMED').sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const prepOrders = filteredOrders.filter(o => o.status === 'IN_PREPARATION' || o.status === 'COOKING').sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const readyOrders = filteredOrders.filter(o => o.status === 'READY' || o.status === 'PREPARED').sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()); // Newest finished first

  return (
    <div className="h-[100dvh] bg-background text-foreground flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex justify-between items-center shrink-0 bg-card border-b border-border p-3 px-6 shadow-sm z-10">
            <div className="flex items-center gap-6">
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <span className="text-primary">Pentium</span>KDS
                </h1>
            </div>

            <div className="flex items-center gap-4">
                <button 
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`p-2 rounded-full transition-colors ${soundEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                    title="Toggle Sound"
                >
                    {soundEnabled ? <Volume2 size={20} /> : <BellOff size={20} />}
                </button>

                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full border border-border text-xs font-mono">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-destructive'}`} />
                    {isConnected ? 'ONLINE' : 'OFFLINE'}
                </div>
            </div>
        </header>

        {/* Kanban Board */}
        <div className="flex-1 overflow-hidden p-4">
            <div className="grid grid-cols-3 gap-6 h-full">
                
                {/* Column: Pending */}
                <div className="flex flex-col bg-muted/30 rounded-xl border border-border/50 h-full overflow-hidden">
                    <div className="p-3 border-b border-border bg-card/50 flex justify-between items-center backdrop-blur-sm sticky top-0 z-10">
                        <h2 className="font-bold text-foreground flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 ring-4 ring-red-500/10"></span>
                            Pendientes
                            <span className="bg-primary/10 text-primary text-xs px-2.5 py-0.5 rounded-full font-mono ml-2">{pendingOrders.length}</span>
                        </h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin scrollbar-thumb-border">
                        {pendingOrders.map(order => (
                            <TicketCard
                                key={order.id}
                                order={order}
                                onStatusChange={handleStatusChange}
                                onItemChange={handleItemChange}
                            />
                        ))}
                         {pendingOrders.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                                <span className="text-4xl mb-4">🍽️</span>
                                <p className="font-medium">Todo al día</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Column: In Prep */}
                <div className="flex flex-col bg-muted/30 rounded-xl border border-border/50 h-full overflow-hidden">
                    <div className="p-3 border-b border-border bg-card/50 flex justify-between items-center backdrop-blur-sm sticky top-0 z-10">
                        <h2 className="font-bold text-foreground flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 ring-4 ring-yellow-500/10"></span>
                            En Cocina
                            <span className="bg-yellow-500/10 text-yellow-500 text-xs px-2.5 py-0.5 rounded-full font-mono ml-2">{prepOrders.length}</span>
                        </h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin scrollbar-thumb-border">
                        {prepOrders.map(order => (
                            <TicketCard
                                key={order.id}
                                order={order}
                                onStatusChange={handleStatusChange}
                                onItemChange={handleItemChange}
                            />
                        ))}
                    </div>
                </div>

                {/* Column: Ready */}
                <div className="flex flex-col bg-muted/30 rounded-xl border border-border/50 h-full overflow-hidden">
                    <div className="p-3 border-b border-border bg-card/50 flex justify-between items-center backdrop-blur-sm sticky top-0 z-10">
                        <h2 className="font-bold text-foreground flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500 ring-4 ring-green-500/10"></span>
                            Listos para Servir
                             <span className="bg-green-500/10 text-green-500 text-xs px-2.5 py-0.5 rounded-full font-mono ml-2">{readyOrders.length}</span>
                        </h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin scrollbar-thumb-border">
                        {readyOrders.map(order => (
                            <TicketCard 
                                key={order.id} 
                                order={order} 
                                onStatusChange={handleStatusChange}
                                onMarkServed={handleMarkServed}
                                isHistory={false} 
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

