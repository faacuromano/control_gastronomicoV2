/**
 * Stock Alert Badge Component
 * Shows a badge with count of low stock items and dropdown with details
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Package, X } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { stockAlertService, type StockAlert } from '../../services/stockAlertService';

export const StockAlertBadge: React.FC = () => {
    const [alerts, setAlerts] = useState<StockAlert[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const { socket, isConnected } = useSocket();

    // Load initial alerts
    const loadAlerts = useCallback(async () => {
        try {
            const data = await stockAlertService.getLowStockItems();
            setAlerts(data);
        } catch (err) {
            console.error('Failed to load stock alerts:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAlerts();
    }, [loadAlerts]);

    // Subscribe to WebSocket updates
    useEffect(() => {
        if (!socket || !isConnected) return;

        // Join admin stock room
        socket.emit('join:admin:stock');

        // Listen for individual low stock alerts
        const handleLowStock = (alert: StockAlert) => {
            setAlerts(prev => {
                // Replace if same ingredient, otherwise add
                const existing = prev.findIndex(a => a.ingredientId === alert.ingredientId);
                if (existing >= 0) {
                    const newAlerts = [...prev];
                    newAlerts[existing] = alert;
                    return newAlerts;
                }
                return [alert, ...prev];
            });
        };

        // Listen for full status updates
        const handleStatus = (newAlerts: StockAlert[]) => {
            setAlerts(newAlerts);
        };

        socket.on('stock:low', handleLowStock);
        socket.on('stock:status', handleStatus);

        return () => {
            socket.off('stock:low', handleLowStock);
            socket.off('stock:status', handleStatus);
        };
    }, [socket, isConnected]);

    const criticalCount = alerts.filter(a => a.severity === 'critical').length;
    const warningCount = alerts.filter(a => a.severity === 'warning').length;
    const totalCount = alerts.length;

    if (loading || totalCount === 0) return null;

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    criticalCount > 0 
                        ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                }`}
            >
                <AlertTriangle size={18} />
                <span className="font-medium text-sm">Stock Bajo</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    criticalCount > 0 ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'
                }`}>
                    {totalCount}
                </span>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border z-50 overflow-hidden">
                        <div className="p-3 bg-slate-50 border-b flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Package size={18} />
                                Alertas de Stock
                            </h3>
                            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {alerts.map(alert => (
                                <div 
                                    key={alert.id}
                                    className={`p-3 border-b last:border-0 flex items-center justify-between ${
                                        alert.severity === 'critical' ? 'bg-red-50' : 'bg-amber-50'
                                    }`}
                                >
                                    <div>
                                        <p className="font-medium text-slate-800">{alert.ingredientName}</p>
                                        <p className="text-sm text-slate-500">
                                            Stock: <span className={alert.severity === 'critical' ? 'text-red-600 font-bold' : 'text-amber-600 font-bold'}>
                                                {alert.currentStock}
                                            </span> / {alert.minStock} {alert.unit}
                                        </p>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                        alert.severity === 'critical' 
                                            ? 'bg-red-200 text-red-700' 
                                            : 'bg-amber-200 text-amber-700'
                                    }`}>
                                        {alert.severity === 'critical' ? 'Sin Stock' : 'Bajo'}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="p-2 bg-slate-50 border-t">
                            <a 
                                href="/admin/ingredients" 
                                className="block text-center text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                                Ver Inventario →
                            </a>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
