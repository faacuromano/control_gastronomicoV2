import React, { useEffect, useState } from 'react';
import { useSocket } from '../../../context/SocketContext';
import { TicketCard } from './components/TicketCard';
// import { api } from '../../../services/api'; // Use kdsService from frontend? Or direct fetch?
// Direct fetch for now or adding to orderService
import { orderService } from '../../../services/orderService';

export const KitchenPage: React.FC = () => {
  const { socket, isConnected } = useSocket();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActiveOrders();

    if (socket && isConnected) {
        socket.emit('join:kitchen');
        
        socket.on('order:new', (newOrder) => {
            // New order received via socket
            setOrders(prev => [...prev, newOrder]);
            // Play sound?
        });

        socket.on('order:update', (updatedOrder) => {
            // Order status updated
            setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
        });

        return () => {
            socket.off('order:new');
            socket.off('order:update');
        };
    }
  }, [socket, isConnected]);

  const loadActiveOrders = async () => {
      try {
          // We need to add getActiveOrders to frontend orderService
          const data = await orderService.getActiveOrders(); 
          setOrders(data);
      } catch (e) {
          console.error("Failed to load KDS orders", e);
      } finally {
          setLoading(false);
      }
  };

  const handleStatusChange = async (orderId: number, status: string) => {
      try {
          await orderService.updateStatus(orderId, status);
          // Optimistic update handled by socket event usually, but we can also update locally
      } catch (e) {
          console.error("Failed to update status", e);
      }
  };

  if (loading) return <div className="p-10 text-white text-center">Loading KDS...</div>;

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
        <header className="flex justify-between items-center mb-6 border-b border-border pb-4">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Kitchen Display System</h1>
            <div className="flex gap-4">
                <span className={`px-3 py-1 rounded-full text-xs font-mono flex items-center gap-2 ${isConnected ? 'bg-green-900/50 text-green-300' : 'bg-destructive/20 text-destructive'}`}>
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-destructive'}`} />
                    {isConnected ? 'ONLINE' : 'DISCONNECTED'}
                </span>
            </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {orders.filter(o => o.status !== 'PREPARED').map(order => (
                <TicketCard 
                    key={order.id} 
                    order={order} 
                    onStatusChange={handleStatusChange} 
                    onItemChange={async (itemId, status) => {
                        try {
                            await orderService.updateItemStatus(itemId, status);
                        } catch (e) {
                            console.error("Failed to update item", e);
                        }
                    }}
                />
            ))}
        </div>
        
        {/* Prepared Orders Section (Optional) */}
        {orders.some(o => o.status === 'PREPARED') && (
            <div className="mt-8 pt-8 border-t border-border">
                <h2 className="text-xl text-muted-foreground mb-4">Ready for Delivery / Pickup</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 opacity-75">
                     {orders.filter(o => o.status === 'PREPARED').map(order => (
                        <TicketCard key={order.id} order={order} onStatusChange={handleStatusChange} isHistory />
                    ))}
                </div>
            </div>
        )}
    </div>
  );
};
