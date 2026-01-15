
import React, { useState } from 'react';
import { type ShiftReport } from '../../services/cashShiftService';
import { useCashStore } from '../../store/cash.store';
import { Loader2, X, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface CloseShiftModalProps {
    isOpen: boolean;
    onClose: () => void;
    onShiftClosed: () => void;
}

export const CloseShiftModal: React.FC<CloseShiftModalProps> = ({ isOpen, onClose, onShiftClosed }) => {
    const [amount, setAmount] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [report, setReport] = useState<ShiftReport | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount < 0) {
            setError('Por favor ingrese un monto válido.');
            return;
        }

        if (!confirm('¿Estás seguro de que deseas cerrar la caja? Esta acción no se puede deshacer.')) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const shiftReport = await useCashStore.getState().closeShiftWithCount(numAmount);
            setReport(shiftReport as ShiftReport);
        } catch (err: any) {
            setError(err.response?.data?.error?.message || err.message || 'Error al cerrar caja.');
        } finally {
            setLoading(false);
        }
    };

    const handleDone = () => {
        setReport(null);
        setAmount('');
        onShiftClosed();
    };

    const getDifferenceIcon = (diff: number | null) => {
        if (diff === null) return null;
        if (diff > 0) return <TrendingUp className="text-green-400" size={20} />;
        if (diff < 0) return <TrendingDown className="text-red-400" size={20} />;
        return <Minus className="text-zinc-400" size={20} />;
    };

    const getDifferenceColor = (diff: number | null) => {
        if (diff === null) return 'text-zinc-400';
        if (diff > 0) return 'text-green-400';
        if (diff < 0) return 'text-red-400';
        return 'text-zinc-400';
    };

    // Show report after closing
    if (report) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
                    <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-green-900/30">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                            Turno Cerrado
                        </h2>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Shift Info */}
                        <div className="bg-zinc-800/50 rounded-lg p-4">
                            <p className="text-sm text-zinc-400">Cajero: <span className="text-white">{report.shift.userName}</span></p>
                            <p className="text-sm text-zinc-400 mt-1">
                                {new Date(report.shift.startTime).toLocaleTimeString()} - {new Date(report.shift.endTime!).toLocaleTimeString()}
                            </p>
                        </div>

                        {/* Sales Summary */}
                        <div>
                            <h3 className="text-sm font-semibold text-zinc-400 mb-3">Resumen de Ventas</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-zinc-800 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-white">{report.sales.totalOrders}</p>
                                    <p className="text-xs text-zinc-400">Órdenes</p>
                                </div>
                                <div className="bg-zinc-800 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-emerald-400">${report.sales.totalSales.toFixed(2)}</p>
                                    <p className="text-xs text-zinc-400">Total Ventas</p>
                                </div>
                            </div>
                        </div>

                        {/* Payments by Method */}
                        {report.sales.byPaymentMethod.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-zinc-400 mb-2">Por Método de Pago</h3>
                                <div className="space-y-2">
                                    {report.sales.byPaymentMethod.map((pm) => (
                                        <div key={pm.method} className="flex justify-between items-center bg-zinc-800/50 rounded-lg px-3 py-2">
                                            <span className="text-sm text-zinc-300">{pm.method}</span>
                                            <span className="text-sm font-semibold text-white">${pm.total.toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Cash Reconciliation */}
                        <div className="border-t border-zinc-700 pt-4">
                            <h3 className="text-sm font-semibold text-zinc-400 mb-3">Arqueo de Caja</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-zinc-400">Monto Inicial</span>
                                    <span className="text-white">${report.cash.startAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-400">+ Ventas en Efectivo</span>
                                    <span className="text-white">${report.cash.cashSales.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between border-t border-zinc-700 pt-2">
                                    <span className="text-zinc-300 font-medium">Esperado</span>
                                    <span className="text-white font-semibold">${report.cash.expectedCash.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-300 font-medium">Contado</span>
                                    <span className="text-white font-semibold">${report.cash.countedCash?.toFixed(2) ?? '-'}</span>
                                </div>
                                <div className={`flex justify-between items-center border-t border-zinc-700 pt-2 ${getDifferenceColor(report.cash.difference)}`}>
                                    <span className="font-medium flex items-center gap-2">
                                        {getDifferenceIcon(report.cash.difference)}
                                        Diferencia
                                    </span>
                                    <span className="font-bold text-lg">
                                        {report.cash.difference !== null 
                                            ? `${report.cash.difference >= 0 ? '+' : ''}$${report.cash.difference.toFixed(2)}`
                                            : '-'
                                        }
                                    </span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleDone}
                            className="w-full px-4 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium transition-colors"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Input form
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden" data-testid="modal-close-shift">
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-800/50">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        Cerrar Caja
                    </h2>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm text-center">
                            {error}
                        </div>
                    )}

                    <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3 mb-6">
                        <p className="text-sm text-amber-200">
                            <strong>Arqueo Ciego:</strong> Cuente el efectivo sin ver el total esperado.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">
                                Efectivo Contado
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full bg-zinc-800 border-zinc-700 text-white pl-8 pr-4 py-3 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all text-lg font-mono"
                                    placeholder="0.00"
                                    min="0"
                                    step="any"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold transition-colors flex items-center justify-center disabled:opacity-50"
                                data-testid="btn-confirm-close"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    'Cerrar Turno'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
