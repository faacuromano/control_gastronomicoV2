
import React, { useState } from 'react';
import { useCashStore } from '../../store/cash.store';
import { useAuthStore } from '../../store/auth.store';
import { Loader2, DollarSign } from 'lucide-react';

interface OpenShiftModalProps {
    onShiftOpened: () => void;
}

export const OpenShiftModal: React.FC<OpenShiftModalProps> = ({ onShiftOpened }) => {
    const [amount, setAmount] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const user = useAuthStore((state) => state.user);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount < 0) {
            setError('Por favor ingrese un monto válido.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await useCashStore.getState().openShift(numAmount);
            onShiftOpened();
        } catch (err: any) {
            setError(err.response?.data?.error?.message || err.message || 'Error al abrir caja.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-6" data-testid="modal-open-shift">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <DollarSign className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Abrir Caja</h2>
                    <p className="text-zinc-400 mt-2">
                        Hola {user?.name}, debes abrir un turno para comenzar a vender.
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">
                            Monto Inicial en Efectivo
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full bg-zinc-800 border-zinc-700 text-white pl-8 pr-4 py-3 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-lg font-mono"
                                placeholder="0.00"
                                min="0"
                                step="any"
                                autoFocus
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        data-testid="btn-confirm-open"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                Abriendo...
                            </>
                        ) : (
                            'Abrir Turno'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};
