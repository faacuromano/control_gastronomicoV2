import React, { useState, useEffect } from 'react';
import { Users, Play, FileText, CheckSquare, Loader2, Clock, ChefHat, CheckCircle, X, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Table } from './TableMap';
import { tableService } from '../../../../services/tableService';
import { orderService } from '../../../../services/orderService';
import { printerService, type Printer as PrinterConfig } from '../../../../services/printerService';

interface OrderItem {
    id: number;
    productId: number;
    quantity: number;
    unitPrice: string;
    status: 'PENDING' | 'COOKING' | 'READY' | 'SERVED';
    notes?: string | null;
    product?: {
        id: number;
        name: string;
        price: string;
    };
    modifiers?: {
        id: number;
        modifierOptionId: number;
        priceCharged: string;
        modifierOption: {
            id: number;
            name: string;
        };
    }[];
}

interface TableDetailModalProps {
    table: Table | null;
    onClose: () => void;
    onTableUpdated?: () => void;
}

export const TableDetailModal: React.FC<TableDetailModalProps> = ({ table, onClose, onTableUpdated }) => {
    const navigate = useNavigate();
    const [pax, setPax] = useState(2);
    const [loading, setLoading] = useState(false);
    const [loadingItems, setLoadingItems] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [printers, setPrinters] = useState<PrinterConfig[]>([]);
    const [isPrinting, setIsPrinting] = useState(false);

    // Load order items when modal opens for occupied table
    useEffect(() => {
        if (table?.status === 'OCCUPIED' && table.currentOrderId) {
            loadOrderItems(table.id);
            loadPrinters();
        }
    }, [table]);

    const loadOrderItems = async (tableId: number) => {
        setLoadingItems(true);
        try {
            const order = await orderService.getOrderByTable(tableId);
            if (order?.items) {
                setOrderItems(order.items as OrderItem[]);
            }
        } catch (err) {
            console.error('Failed to load order items:', err);
        } finally {
            setLoadingItems(false);
        }
    };

    const loadPrinters = async () => {
        try {
            const allPrinters = await printerService.getAll();
            setPrinters(allPrinters);
        } catch (err) {
            console.error('Failed to load printers:', err);
        }
    };

    const handlePrintPreAccount = async () => {
        if (!table?.currentOrderId || printers.length === 0) {
            console.warn('[TableDetailModal] Cannot print: missing orderId or printers');
            return;
        }
        setIsPrinting(true);
        try {
            await printerService.printPreAccount(table.currentOrderId, printers[0].id);
            console.log('[TableDetailModal] Pre-account printed');
        } catch (err) {
            console.error('Failed to print pre-account:', err);
        } finally {
            setIsPrinting(false);
        }
    };

    if (!table) return null;

    const handleOpenTable = async () => {
        try {
            setLoading(true);
            setError(null);
            const order = await tableService.openTable(table.id, pax);
            navigate(`/ventas?orderId=${order.id}&tableId=${table.id}`);
            onClose();
            onTableUpdated?.();
        } catch (err: any) {
            console.error('Error opening table:', err);
            const errorMessage = err.response?.data?.error?.message || err.message || 'Error al abrir la mesa';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleResumeTable = () => {
        if (table.currentOrderId) {
            navigate(`/ventas?orderId=${table.currentOrderId}&tableId=${table.id}`);
        }
        onClose();
    };

    const handleCloseTable = () => {
        if (table.currentOrderId) {
            navigate(`/ventas?orderId=${table.currentOrderId}&tableId=${table.id}&action=checkout`);
        }
        onClose();
    };

    const handleMarkItemServed = async (itemId: number) => {
        try {
            await orderService.updateItemStatus(itemId, 'SERVED');
            // Refresh items
            if (table.id) {
                loadOrderItems(table.id);
            }
        } catch (err) {
            console.error('Failed to mark item as served:', err);
        }
    };

    // Status helpers
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'PENDING':
                return <Clock size={14} className="text-slate-400" />;
            case 'COOKING':
                return <ChefHat size={14} className="text-yellow-500" />;
            case 'READY':
                return <CheckCircle size={14} className="text-green-500" />;
            case 'SERVED':
                return <CheckCircle size={14} className="text-slate-400" />;
            default:
                return null;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'PENDING': return 'Pendiente';
            case 'COOKING': return 'En cocina';
            case 'READY': return '¡Listo!';
            case 'SERVED': return 'Servido';
            default: return status;
        }
    };

    const getStatusBg = (status: string) => {
        switch (status) {
            case 'PENDING': return 'bg-slate-100 text-slate-600';
            case 'COOKING': return 'bg-yellow-100 text-yellow-700';
            case 'READY': return 'bg-green-100 text-green-700 animate-pulse';
            case 'SERVED': return 'bg-slate-50 text-slate-400';
            default: return 'bg-slate-100';
        }
    };

    // Count ready items
    const readyCount = orderItems.filter(i => i.status === 'READY').length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-start">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">{table.name}</h2>
                        <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded mt-1 ${
                            table.status === 'FREE' ? 'bg-green-100 text-green-700' :
                            table.status === 'OCCUPIED' ? 'bg-red-100 text-red-700' : 
                            'bg-gray-100 text-gray-700'
                        }`}>
                            {table.status}
                        </span>
                        {readyCount > 0 && (
                            <span className="ml-2 inline-block text-xs font-bold px-2 py-0.5 rounded bg-green-500 text-white animate-pulse">
                                {readyCount} listo{readyCount > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {table.status === 'FREE' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Comensales</label>
                                <div className="flex items-center gap-2">
                                    <Users size={18} className="text-slate-400" />
                                    <input 
                                        type="number" 
                                        min="1" 
                                        value={pax}
                                        onChange={(e) => setPax(parseInt(e.target.value) || 1)}
                                        className="w-full border rounded-lg p-2"
                                    />
                                </div>
                            </div>
                            
                            <button 
                                onClick={handleOpenTable}
                                disabled={loading}
                                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                            >
                                {loading ? (
                                    <><Loader2 className="animate-spin" size={20} /> Abriendo...</>
                                ) : (
                                    <><Play size={20} /> Abrir Mesa</>
                                )}
                            </button>
                        </div>
                    )}

                    {table.status === 'OCCUPIED' && (
                        <div className="space-y-4">
                            {table.currentOrderId && (
                                <div className="text-sm text-center text-slate-500 p-2 bg-slate-50 rounded-lg">
                                    <span className="font-bold">Orden #{table.currentOrderId}</span>
                                </div>
                            )}

                            {/* Item Status List */}
                            {loadingItems ? (
                                <div className="text-center py-4 text-slate-400">
                                    <Loader2 className="animate-spin mx-auto" size={24} />
                                    <p className="text-sm mt-2">Cargando items...</p>
                                </div>
                            ) : orderItems.length > 0 ? (
                                <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                                    {orderItems.map((item) => (
                                        <div 
                                            key={item.id} 
                                            className={`p-3 flex items-center justify-between gap-2 ${
                                                item.status === 'SERVED' ? 'opacity-50' : ''
                                            }`}
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm">{item.quantity}x</span>
                                                    <span className={`text-sm ${item.status === 'SERVED' ? 'line-through text-slate-400' : ''}`}>
                                                        {item.product?.name}
                                                    </span>
                                                </div>
                                                {/* Modifiers */}
                                                {item.modifiers && item.modifiers.length > 0 && (
                                                    <div className="ml-6 mt-1 space-y-0.5">
                                                        {item.modifiers.map((mod) => (
                                                            <p key={mod.id} className="text-xs text-blue-600">
                                                                + {mod.modifierOption?.name ?? 'Modificador'}
                                                                {Number(mod.priceCharged) > 0 && ` (+$${Number(mod.priceCharged).toFixed(0)})`}
                                                            </p>
                                                        ))}
                                                    </div>
                                                )}
                                                {item.notes && (
                                                    <p className="text-xs text-yellow-600 mt-0.5">{item.notes}</p>
                                                )}
                                            </div>
                                            
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded flex items-center gap-1 ${getStatusBg(item.status)}`}>
                                                    {getStatusIcon(item.status)}
                                                    {getStatusLabel(item.status)}
                                                </span>
                                                
                                                {item.status === 'READY' && (
                                                    <button
                                                        onClick={() => handleMarkItemServed(item.id)}
                                                        className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                                                        title="Marcar como servido"
                                                    >
                                                        <CheckCircle size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4 text-slate-400 text-sm">
                                    No hay items en esta orden
                                </div>
                            )}

                            {/* Order Totals */}
                            {orderItems.length > 0 && (
                                <div className="mt-4 p-3 bg-slate-50 rounded-lg space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600">Subtotal:</span>
                                        <span className="font-bold">
                                            ${orderItems.reduce((acc, item) => {
                                                const itemBase = Number(item.unitPrice) * item.quantity;
                                                const mods = (item.modifiers || []).reduce((sum, m) => sum + Number(m.priceCharged), 0) * item.quantity;
                                                return acc + itemBase + mods;
                                            }, 0).toFixed(0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-base font-bold border-t pt-1">
                                        <span>Total:</span>
                                        <span className="text-lg">
                                            ${orderItems.reduce((acc, item) => {
                                                const itemBase = Number(item.unitPrice) * item.quantity;
                                                const mods = (item.modifiers || []).reduce((sum, m) => sum + Number(m.priceCharged), 0) * item.quantity;
                                                return acc + itemBase + mods;
                                            }, 0).toFixed(0)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="space-y-2 pt-2">
                                {/* Print Pre-Account Button */}
                                {printers.length > 0 && (
                                    <button 
                                        onClick={handlePrintPreAccount}
                                        disabled={isPrinting}
                                        className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-400 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                                    >
                                        {isPrinting ? (
                                            <><Loader2 className="animate-spin" size={20} /> Imprimiendo...</>
                                        ) : (
                                            <><Printer size={20} /> Imprimir Cuenta</>
                                        )}
                                    </button>
                                )}

                                <button 
                                    onClick={handleResumeTable}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                                >
                                    <FileText size={20} />
                                    Agregar Items
                                </button>

                                <button 
                                    onClick={handleCloseTable}
                                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors border border-slate-200"
                                >
                                    <CheckSquare size={20} />
                                    Cerrar Mesa (Cobrar)
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
