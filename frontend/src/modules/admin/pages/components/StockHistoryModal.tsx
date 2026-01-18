import { useEffect, useState } from 'react';
import { X, ArrowDown, ArrowUp, RotateCcw, ShoppingCart } from 'lucide-react';
import { ingredientService, type StockMovement } from '../../../../services/ingredientService';

interface StockHistoryModalProps {
    ingredientId: number;
    ingredientName: string;
    isOpen: boolean;
    onClose: () => void;
}

export default function StockHistoryModal({ ingredientId, ingredientName, isOpen, onClose }: StockHistoryModalProps) {
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && ingredientId) {
            loadHistory();
        }
    }, [isOpen, ingredientId]);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const data = await ingredientService.getHistory(ingredientId);
            setMovements(data);
        } catch (error) {
            console.error("Failed to load history", error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
                <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50 rounded-t-xl">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Historial de Stock</h2>
                        <p className="text-sm text-slate-500">{ingredientName}</p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full text-slate-500">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-0">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0">
                            <tr>
                                <th className="px-6 py-3">Fecha</th>
                                <th className="px-6 py-3">Tipo</th>
                                <th className="px-6 py-3 text-right">Cantidad</th>
                                <th className="px-6 py-3">Razón / Referencia</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-500">Cargando movimientos...</td></tr>
                            ) : movements.length === 0 ? (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-500">No hay movimientos registrados.</td></tr>
                            ) : (
                                movements.map((move) => (
                                    <tr key={move.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-3 whitespace-nowrap text-slate-600">
                                            {new Date(move.createdAt).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-3">
                                            <BadgeType type={move.type} />
                                        </td>
                                        <td className={`px-6 py-3 text-right font-mono font-medium ${
                                            ['SALE', 'WASTE'].includes(move.type) ? 'text-red-600' : 'text-green-600'
                                        }`}>
                                            {['SALE', 'WASTE'].includes(move.type) ? '-' : '+'}{Number(move.quantity)}
                                        </td>
                                        <td className="px-6 py-3 text-slate-600 font-medium">
                                            {move.reason || '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-medium shadow-sm">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}

function BadgeType({ type }: { type: string }) {
    switch (type) {
        case 'SALE':
            return <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700"><ShoppingCart size={12} /> VENTA</div>;
        case 'PURCHASE':
            return <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700"><ArrowUp size={12} /> COMPRA</div>;
        case 'WASTE':
            return <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700"><ArrowDown size={12} /> MERMA</div>;
        case 'ADJUSTMENT':
            return <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-700"><RotateCcw size={12} /> AJUSTE</div>;
        default:
            return <span className="px-2 py-1 bg-slate-100 rounded text-xs">{type}</span>;
    }
}
