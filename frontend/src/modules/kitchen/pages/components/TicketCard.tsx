import React from 'react';
import { Check, ChefHat, Clock, Flame, RefreshCcw, Send, Truck } from 'lucide-react';
import { KitchenTimer } from '../../components/KitchenTimer';

export interface KitchenOrderModifier {
    id: number;
    modifierOption?: { id: number; name: string; priceOverlay: string };
}

export interface KitchenOrderItem {
    id: number;
    productId: number;
    quantity: number;
    unitPrice: string;
    status: 'PENDING' | 'COOKING' | 'READY' | 'SERVED';
    notes?: string | null;
    product: { id: number; name: string; price: string };
    modifiers?: KitchenOrderModifier[];
}

export interface KitchenOrder {
    id: number;
    orderNumber: number;
    status: string;
    channel: string;
    tableId?: number | null;
    deliveryAddress?: string | null;
    createdAt: string;
    items: KitchenOrderItem[];
}

interface TicketCardProps {
    order: KitchenOrder;
    onStatusChange: (orderId: number, status: string) => void;
    onItemChange?: (itemId: number, status: string) => void;
    onMarkServed?: (orderId: number) => void;
    isHistory?: boolean;
    /** Cuando true, solo muestra controles a nivel de item (para vistas filtradas por estación) */
    itemLevelOnly?: boolean;
}

/** Acciones a nivel de item para vistas filtradas por estación */
const ItemLevelActions: React.FC<{
    order: KitchenOrder;
    onItemChange?: (itemId: number, status: string) => void;
}> = ({ order, onItemChange }) => {
    if (!onItemChange) return null;

    const pendingItems = order.items.filter(i => i.status === 'PENDING');
    const cookingItems = order.items.filter(i => i.status === 'COOKING');
    const allReady = order.items.every(i => i.status === 'READY' || i.status === 'SERVED');

    // Marcar todos los pendientes como COOKING
    const handleStartAll = () => {
        pendingItems.forEach(item => onItemChange(item.id, 'COOKING'));
    };

    // Marcar todos los cooking como READY
    const handleReadyAll = () => {
        cookingItems.forEach(item => onItemChange(item.id, 'READY'));
    };

    if (allReady) {
        return (
            <div className="flex items-center justify-center gap-2 text-emerald-600 py-2">
                <Check className="w-4 h-4" />
                <span className="text-sm font-medium">Items listos</span>
            </div>
        );
    }

    if (pendingItems.length > 0) {
        return (
            <button
                onClick={handleStartAll}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
                <ChefHat className="w-4 h-4" />
                Comenzar ({pendingItems.length})
            </button>
        );
    }

    if (cookingItems.length > 0) {
        return (
            <button
                onClick={handleReadyAll}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
                <Check className="w-4 h-4" />
                Listo ({cookingItems.length})
            </button>
        );
    }

    return null;
};

export const TicketCard: React.FC<TicketCardProps> = ({
    order,
    onStatusChange,
    onItemChange,
    onMarkServed,
    isHistory = false,
    itemLevelOnly = false
}) => {
    // Cuando itemLevelOnly, derivar el estado visual desde los items
    // en lugar del status de la orden (que puede incluir items de otras estaciones)
    const getEffectiveStatus = (): 'pending' | 'cooking' | 'ready' => {
        if (!itemLevelOnly) {
            // Modo normal: usar status de la orden
            if (['PENDING', 'OPEN', 'CONFIRMED'].includes(order.status)) return 'pending';
            if (['IN_PREPARATION', 'COOKING'].includes(order.status)) return 'cooking';
            return 'ready';
        }
        // Modo item-level: derivar de items visibles
        const items = order.items;
        if (items.length === 0) return 'pending';
        const allReady = items.every(i => i.status === 'READY' || i.status === 'SERVED');
        if (allReady) return 'ready';
        const hasCooking = items.some(i => i.status === 'COOKING');
        if (hasCooking) return 'cooking';
        return 'pending';
    };

    const effectiveStatus = getEffectiveStatus();
    const isPending = effectiveStatus === 'pending';
    const isCooking = effectiveStatus === 'cooking';
    const isReady = effectiveStatus === 'ready';
    const isDelivery = order.channel === 'DELIVERY_APP' || !!order.deliveryAddress;

    // Status-based styling - Clean light theme
    const statusStyles = {
        pending: {
            border: 'border-red-200',
            headerBg: 'bg-red-50',
            accentBar: 'bg-red-500',
        },
        cooking: {
            border: 'border-amber-200',
            headerBg: 'bg-amber-50',
            accentBar: 'bg-amber-500',
        },
        ready: {
            border: 'border-emerald-200',
            headerBg: 'bg-emerald-50',
            accentBar: 'bg-emerald-500',
        },
    };

    const styles = statusStyles[effectiveStatus];

    return (
        <div
            className={`rounded-lg border ${styles.border} flex flex-col overflow-hidden bg-card shadow-sm`}
            data-testid="ticket-card"
        >
            {/* Accent bar at top */}
            <div className={`h-1 ${styles.accentBar}`} />

            {/* Header */}
            <div className={`px-3 py-2 ${styles.headerBg} border-b border-border/50`}>
                <div className="flex justify-between items-start">
                    <div>
                        {/* Order type badge */}
                        {isDelivery ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                                <Truck className="w-3 h-3" />
                                Delivery
                            </span>
                        ) : (
                            <span className="text-[10px] font-medium text-muted-foreground">
                                Mesa {order.tableId || '—'}
                            </span>
                        )}

                        {/* Order number */}
                        <h3 className="text-xl font-bold text-foreground mt-0.5">
                            <span className="text-muted-foreground">#</span>
                            <span className="font-mono">{order.orderNumber}</span>
                        </h3>
                    </div>

                    {/* Timer */}
                    <KitchenTimer startTime={order.createdAt} />
                </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto max-h-[240px]">
                <ul className="divide-y divide-border">
                    {order.items.map((item, idx) => {
                        const isCompleted = item.status === 'READY' || item.status === 'SERVED';
                        const isCookingItem = item.status === 'COOKING';

                        return (
                            <li
                                key={idx}
                                className={`px-3 py-2 ${isCompleted ? 'opacity-50 bg-emerald-50' : ''} ${isCookingItem ? 'bg-amber-50' : ''}`}
                            >
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex items-start gap-2 flex-1 min-w-0">
                                        {/* Quantity */}
                                        <span className={`
                                            flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs font-bold
                                            ${isCompleted ? 'bg-emerald-200 text-emerald-700'
                                                : isCookingItem ? 'bg-amber-200 text-amber-700'
                                                : 'bg-muted text-foreground'}
                                        `}>
                                            {item.quantity}
                                        </span>

                                        {/* Item details */}
                                        <div className="flex-1 min-w-0">
                                            <span className={`text-sm font-medium block truncate ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                                {item.product.name}
                                            </span>

                                            {/* Modifiers */}
                                            {item.modifiers && item.modifiers.length > 0 && (
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    {item.modifiers.map((mod, mIdx) => (
                                                        <span key={mIdx}>+{mod.modifierOption?.name}{mIdx < item.modifiers!.length - 1 && ', '}</span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Notes */}
                                            {item.notes && (
                                                <p className="text-xs text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded mt-1 inline-block">
                                                    {item.notes}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Item status toggle */}
                                    {!isHistory && onItemChange && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                let nextStatus = 'PENDING';
                                                if (item.status === 'PENDING') nextStatus = 'COOKING';
                                                else if (item.status === 'COOKING') nextStatus = 'READY';
                                                else if (item.status === 'READY') nextStatus = 'PENDING';
                                                onItemChange(item.id, nextStatus);
                                            }}
                                            className={`
                                                flex-shrink-0 p-1.5 rounded transition-colors
                                                ${isCompleted ? 'bg-emerald-100 text-emerald-600'
                                                    : isCookingItem ? 'bg-amber-100 text-amber-600'
                                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'}
                                            `}
                                            data-testid="item-status"
                                        >
                                            {isCompleted ? <Check className="w-4 h-4" />
                                                : isCookingItem ? <Flame className="w-4 h-4" />
                                                : <Clock className="w-4 h-4" />}
                                        </button>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>

            {/* Footer Actions */}
            {!isHistory && (
                <div className="p-2 border-t border-border bg-muted/30 mt-auto">
                    {/* Modo item-level: muestra botones para marcar items de esta estación */}
                    {itemLevelOnly ? (
                        <ItemLevelActions order={order} onItemChange={onItemChange} />
                    ) : (
                        <>
                            {isPending && (
                                <button
                                    onClick={() => onStatusChange(order.id, 'IN_PREPARATION')}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
                                >
                                    <ChefHat className="w-4 h-4" />
                                    Comenzar
                                </button>
                            )}

                            {isCooking && (
                                <button
                                    onClick={() => onStatusChange(order.id, 'PREPARED')}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Check className="w-4 h-4" />
                                    Listo
                                </button>
                            )}

                            {isReady && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onStatusChange(order.id, 'IN_PREPARATION')}
                                        className="p-2.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                                        title="Volver a cocina"
                                    >
                                        <RefreshCcw className="w-4 h-4" />
                                    </button>

                                    {isDelivery ? (
                                        <div className="flex-1 bg-emerald-100 text-emerald-700 text-sm font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2">
                                            <Check className="w-4 h-4" />
                                            Listo despacho
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                if (onMarkServed) {
                                                    onMarkServed(order.id);
                                                } else {
                                                    onStatusChange(order.id, 'DELIVERED');
                                                }
                                            }}
                                            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <Send className="w-4 h-4" />
                                            Entregar
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
