import React from 'react';
import { Clock, CheckCircle, ChefHat, RefreshCw, Truck } from 'lucide-react';
import { KitchenTimer } from '../../components/KitchenTimer';

interface TicketCardProps {
    order: any;
    onStatusChange: (orderId: number, status: string) => void;
    onItemChange?: (itemId: number, status: string) => void;
    onMarkServed?: (orderId: number) => void; // For table orders: mark all items as served
    isHistory?: boolean;
}

export const TicketCard: React.FC<TicketCardProps> = ({ order, onStatusChange, onItemChange, onMarkServed, isHistory = false }) => {
  // Helpers
  const isPending = ['PENDING', 'OPEN', 'CONFIRMED'].includes(order.status);
  const isCooking = ['IN_PREPARATION', 'COOKING'].includes(order.status);
  const isReady = ['READY', 'PREPARED'].includes(order.status);
  
  // Detect if this is a delivery order (channel or has delivery address)
  const isDelivery = order.channel === 'DELIVERY_APP' || !!order.deliveryAddress;

  return (
    <div className={`rounded-lg border flex flex-col overflow-hidden shadow-sm transition-all duration-200 
        ${isPending ? 'bg-slate-800 border-slate-700' : ''}
        ${isCooking ? 'bg-slate-800 border-yellow-500/50 shadow-yellow-500/10' : ''}
        ${isReady ? 'bg-slate-800/50 border-green-500/30' : ''}
    `} data-testid="ticket-card">
        {/* Header */}
        <div className={`px-3 py-2 flex justify-between items-center ${isHistory ? 'bg-slate-800' : 'bg-slate-700'}`}>
            <div>
                {isDelivery ? (
                    <span className="text-[10px] text-purple-400 block uppercase tracking-wide flex items-center gap-1">
                        <Truck size={10} /> Delivery
                    </span>
                ) : (
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wide">Mesa #{order.tableId || 'N/A'}</span>
                )}
                <h3 className="text-base font-bold text-white leading-tight">#{order.orderNumber}</h3>
            </div>
            <KitchenTimer startTime={order.createdAt} />
        </div>

        {/* Items */}
        <div className="p-2 overflow-y-auto max-h-[250px] scrollbar-thin">
            <ul className="space-y-1">
                {order.items.map((item: any, idx: number) => {
                    const isCompleted = item.status === 'READY' || item.status === 'SERVED';
                    const isCookingItem = item.status === 'COOKING';
                    
                    return (
                    <li key={idx} className={`border-b border-slate-700/50 pb-1 last:border-0 last:pb-0 ${isCompleted ? 'opacity-50' : ''}`}>
                        <div className="flex justify-between items-start gap-2">
                             <div className="flex items-start gap-2 flex-1">
                                <span className={`text-sm font-bold font-mono ${isCompleted ? 'text-green-500' : 'text-white'}`}>{item.quantity}</span>
                                <div className="flex-1">
                                    <span className={`text-sm block ${isCompleted ? 'line-through text-slate-500' : 'text-slate-200'}`}>{item.product.name}</span>
                                    {/* Modifiers */}
                                    {item.modifiers?.map((mod: any, mIdx: number) => (
                                        <div key={mIdx} className="text-[11px] text-blue-300 pl-2 leading-tight">
                                            + {mod.modifierOption?.name}
                                        </div>
                                    ))}
                                    {item.notes && (
                                        <div className="text-[10px] text-yellow-400 mt-0.5 leading-none">
                                            {item.notes}
                                        </div>
                                    )}
                                </div>
                             </div>

                            {!isHistory && onItemChange && (
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // Toggle logic: PENDING -> COOKING -> READY
                                        let nextStatus = 'PENDING';
                                        if (item.status === 'PENDING') nextStatus = 'COOKING';
                                        else if (item.status === 'COOKING') nextStatus = 'READY';
                                        else if (item.status === 'READY') nextStatus = 'PENDING';
                                        
                                        onItemChange(item.id, nextStatus);
                                    }}
                                    className={`p-1 rounded transition-colors ${
                                        isCompleted
                                            ? 'text-green-500'
                                            : isCookingItem
                                                ? 'text-yellow-500' 
                                                : 'text-slate-500 hover:text-white'
                                    }`}
                                    data-testid="item-status"
                                >
                                    {isCookingItem ? <Clock size={14} /> : <CheckCircle size={14} />}
                                </button>
                            )}
                        </div>
                    </li>
                )})}
            </ul>
        </div>

        {/* Footer Actions */}
        {!isHistory && (
             <div className="p-2 bg-slate-800/50 border-t border-slate-700/50 mt-auto">
                {isPending && (
                    <button 
                        onClick={() => onStatusChange(order.id, 'IN_PREPARATION')}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                        <ChefHat size={16} />
                        COCINAR
                    </button>
                )}

                {isCooking && (
                     <button 
                        onClick={() => onStatusChange(order.id, 'PREPARED')}
                        className="w-full bg-green-600 hover:bg-green-500 text-white text-sm font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                        <CheckCircle size={16} />
                        TERMINAR
                    </button>
                )}

                {isReady && (
                    <div className="flex gap-2 w-full">
                        <button 
                            onClick={() => onStatusChange(order.id, 'IN_PREPARATION')} // Undo
                            className="px-3 bg-yellow-600/10 hover:bg-yellow-600/20 text-yellow-600 text-sm font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors border border-yellow-600/30"
                            title="Deshacer"
                        >
                            <RefreshCw size={16} />
                        </button>
                        
                        {isDelivery ? (
                            // DELIVERY ORDER: Just visual confirmation - order stays PREPARED
                            // Dispatch happens from Delivery Dashboard
                            <div className="flex-1 bg-green-700/20 text-green-400 text-sm font-bold py-2 rounded flex items-center justify-center gap-2 border border-green-600/30">
                                <CheckCircle size={16} />
                                LISTO ✓
                            </div>
                        ) : (
                            // TABLE ORDER: Mark items as served, order goes to DELIVERED
                            <button 
                                onClick={() => {
                                    if (onMarkServed) {
                                        onMarkServed(order.id);
                                    } else {
                                        // Fallback: use old behavior if onMarkServed not provided
                                        onStatusChange(order.id, 'DELIVERED');
                                    }
                                }} 
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors border border-slate-600"
                            >
                                <CheckCircle size={16} />
                                ENTREGAR
                            </button>
                        )}
                    </div>
                )}
             </div>
        )}
    </div>
  );
};
