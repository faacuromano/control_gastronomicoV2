import React, { useState } from 'react';
import { Users, Play, FileText, CheckSquare, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Table } from './TableMap';
import { tableService } from '../../../../services/tableService';

interface TableDetailModalProps {
    table: Table | null;
    onClose: () => void;
    onTableUpdated?: () => void; // Callback to refresh table list
}

export const TableDetailModal: React.FC<TableDetailModalProps> = ({ table, onClose, onTableUpdated }) => {
    const navigate = useNavigate();
    const [pax, setPax] = useState(2);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!table) return null;

    const handleOpenTable = async () => {
        try {
            setLoading(true);
            setError(null);
            
            // Call backend to create empty order and mark table as OCCUPIED
            const order = await tableService.openTable(table.id, pax);
            
            // Navigate to POS with the new orderId
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-4 bg-slate-50 border-b border-slate-100">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">{table.name}</h2>
                        <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded mt-1 ${
                            table.status === 'FREE' ? 'bg-green-100 text-green-700' :
                            table.status === 'OCCUPIED' ? 'bg-red-100 text-red-700' : 
                            'bg-gray-100 text-gray-700'
                        }`}>
                            {table.status}
                        </span>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
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

                            <button 
                                onClick={onClose}
                                className="w-full text-slate-500 hover:text-slate-700 py-2 text-sm font-medium"
                            >
                                Cancelar
                            </button>
                        </div>
                    )}

                    {table.status === 'OCCUPIED' && (
                        <div className="space-y-3">
                            {table.currentOrderId && (
                                <div className="text-sm text-center text-slate-500 mb-4 p-3 bg-slate-50 rounded-lg">
                                    <span className="font-bold">Orden #{table.currentOrderId}</span>
                                    <p className="text-xs mt-1">Puedes seguir agregando items</p>
                                </div>
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

                            <button 
                                onClick={onClose}
                                className="w-full text-slate-500 hover:text-slate-700 py-2 text-sm font-medium"
                            >
                                Cancelar
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

