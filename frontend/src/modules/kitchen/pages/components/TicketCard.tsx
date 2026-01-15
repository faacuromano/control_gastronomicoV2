import React, { useState } from 'react';
import { Clock, CheckCircle } from 'lucide-react';
import { useInterval } from '../../../../hooks/useInterval';

interface TicketCardProps {
    order: any;
    onStatusChange: (orderId: number, status: string) => void;
    onItemChange?: (itemId: number, status: string) => void;
    isHistory?: boolean;
}

export const TicketCard: React.FC<TicketCardProps> = ({ order, onStatusChange, onItemChange, isHistory = false }) => {
  const [now, setNow] = useState(Date.now());

  useInterval(() => {
    setNow(Date.now());
  }, 60000); // Update every minute

  const elapsedMinutes = Math.floor((now - new Date(order.createdAt).getTime()) / 60000);
  
  // Color coding based on time
  let timerColor = 'text-slate-400';
  if (elapsedMinutes > 15) timerColor = 'text-yellow-500';
  if (elapsedMinutes > 30) timerColor = 'text-red-500';

  return (
    <div className={`rounded-xl border ${isHistory ? 'bg-slate-800 border-slate-700' : 'bg-slate-800 border-slate-600 shadow-xl'} flex flex-col overflow-hidden`} data-testid="ticket-card">
        {/* Header */}
        <div className={`p-3 flex justify-between items-center ${isHistory ? 'bg-slate-800' : 'bg-slate-700'}`}>
            <div>
                <span className="text-xs text-slate-400 block">Tablet #{order.tableId || 'N/A'}</span>
                <h3 className="text-lg font-bold text-white">Ord #{order.orderNumber}</h3>
            </div>
            <div className={`flex items-center gap-1 font-mono text-sm ${timerColor}`}>
                <Clock size={14} />
                {elapsedMinutes}m
            </div>
        </div>

        {/* Items */}
        <div className="p-3 flex-1 overflow-y-auto max-h-[300px]">
            <ul className="space-y-3">
                {order.items.map((item: any, idx: number) => {
                    const isCompleted = item.status === 'READY' || item.status === 'SERVED';
                    const isCooking = item.status === 'COOKING';
                    
                    return (
                    <li key={idx} className={`border-b border-slate-700 pb-2 last:border-0 last:pb-0 ${isCompleted ? 'opacity-50' : ''}`}>
                        <div className="flex justify-between items-start">
                             <div className="flex items-start gap-2 flex-1">
                                <span className={`font-bold ${isCompleted ? 'text-green-500' : 'text-white'}`}>{item.quantity}x</span>
                                <div className="flex-1 mx-2">
                                    <span className={`block ${isCompleted ? 'line-through text-slate-500' : 'text-slate-200'}`}>{item.product.name}</span>
                                    {item.notes && (
                                        <div className="text-xs text-yellow-400 mt-1 bg-yellow-900/30 p-1 rounded inline-block">
                                            {item.notes}
                                        </div>
                                    )}
                                </div>
                             </div>

                            {!isHistory && (
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // Toggle logic: PENDING -> COOKING -> READY
                                        let nextStatus = 'PENDING';
                                        if (item.status === 'PENDING') nextStatus = 'COOKING';
                                        else if (item.status === 'COOKING') nextStatus = 'READY';
                                        else if (item.status === 'READY') nextStatus = 'PENDING'; // Undo/Cycle
                                        
                                        if (onItemChange) {
                                            onItemChange(item.id, nextStatus);
                                        }
                                    }}
                                    className={`p-1 rounded-full transition-colors ${
                                        isCompleted
                                            ? 'bg-green-600/20 text-green-500 hover:bg-green-600/40'
                                            : isCooking
                                                ? 'bg-yellow-600/20 text-yellow-500 hover:bg-yellow-600/40' 
                                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                                    }`}
                                    data-testid="item-status"
                                >
                                    {isCooking ? <Clock size={16} /> : <CheckCircle size={16} />}
                                </button>
                            )}
                        </div>
                    </li>
                )})}
            </ul>
        </div>

        {/* Footer Actions */}
        {!isHistory && (
             <div className="p-3 bg-slate-800 border-t border-slate-700">
                <button 
                    onClick={() => onStatusChange(order.id, 'PREPARED')}
                    className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                    <CheckCircle size={18} />
                    MARCAR LISTO
                </button>
             </div>
        )}
         {isHistory && (
             <div className="p-2 bg-slate-800 border-t border-slate-700 flex justify-between items-center">
                 <div className="text-xs text-green-400 font-bold uppercase tracking-wider pl-2">
                     LISTO
                 </div>
                 <button 
                     onClick={() => onStatusChange(order.id, 'CONFIRMED')}
                     className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded transition-colors"
                     title="Volver a cocina"
                 >
                     Deshacer
                 </button>
             </div>
        )}
    </div>
  );
};
