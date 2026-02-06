import React, { useState, useEffect } from 'react';
import { X, Star, Wallet, Plus, Minus, Loader2 } from 'lucide-react';
import { clientService, type Client, type LoyaltyBalance } from '../../../../services/clientService';
import { toast } from 'sonner';

interface ClientDetailProps {
    client: Client;
    onClose: () => void;
    onUpdated: () => void;
}

export const ClientDetail: React.FC<ClientDetailProps> = ({ client, onClose, onUpdated }) => {
    const [balance, setBalance] = useState<LoyaltyBalance | null>(null);
    const [loading, setLoading] = useState(true);
    const [redeemAmount, setRedeemAmount] = useState('');
    const [walletAmount, setWalletAmount] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadBalance();
    }, [client.id]);

    const loadBalance = async () => {
        setLoading(true);
        try {
            const data = await clientService.getLoyaltyBalance(client.id);
            setBalance(data);
        } catch {
            // Client may not have loyalty data yet — use local values
            setBalance({ points: client.points || 0, walletBalance: Number(client.walletBalance) || 0 });
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
    };

    const handleRedeemPoints = async () => {
        const pts = parseInt(redeemAmount);
        if (!pts || pts <= 0) return;
        setSubmitting(true);
        try {
            const result = await clientService.redeemPoints(client.id, pts);
            toast.success(`${pts} puntos canjeados — Descuento: ${formatCurrency(result.discountAmount)}`);
            setRedeemAmount('');
            loadBalance();
            onUpdated();
        } catch {
            toast.error('Error al canjear puntos');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddWallet = async () => {
        const amt = parseFloat(walletAmount);
        if (!amt || amt <= 0) return;
        setSubmitting(true);
        try {
            await clientService.addWalletFunds(client.id, amt);
            toast.success(`Cargados ${formatCurrency(amt)} a la billetera`);
            setWalletAmount('');
            loadBalance();
            onUpdated();
        } catch {
            toast.error('Error al cargar fondos');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">{client.name}</h2>
                        {client.phone && <p className="text-sm text-slate-500">{client.phone}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Client Info */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-slate-500">Email</span>
                            <p className="font-medium text-slate-800">{client.email || '—'}</p>
                        </div>
                        <div>
                            <span className="text-slate-500">CUIT/DNI</span>
                            <p className="font-medium text-slate-800">{client.taxId || '—'}</p>
                        </div>
                        <div className="col-span-2">
                            <span className="text-slate-500">Dirección</span>
                            <p className="font-medium text-slate-800">{client.address || '—'}</p>
                        </div>
                    </div>

                    {/* Loyalty Balance */}
                    {loading ? (
                        <div className="flex justify-center py-4">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                        </div>
                    ) : balance && (
                        <div className="grid grid-cols-2 gap-4">
                            {/* Points Card */}
                            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                                <div className="flex items-center gap-2 mb-1">
                                    <Star className="w-4 h-4 text-amber-500" />
                                    <span className="text-sm font-medium text-amber-700">Puntos</span>
                                </div>
                                <p className="text-2xl font-bold text-amber-800">{balance.points.toLocaleString()}</p>
                            </div>

                            {/* Wallet Card */}
                            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                                <div className="flex items-center gap-2 mb-1">
                                    <Wallet className="w-4 h-4 text-emerald-500" />
                                    <span className="text-sm font-medium text-emerald-700">Billetera</span>
                                </div>
                                <p className="text-2xl font-bold text-emerald-800">{formatCurrency(balance.walletBalance)}</p>
                            </div>
                        </div>
                    )}

                    {/* Redeem Points */}
                    <div className="bg-slate-50 rounded-lg p-4">
                        <h3 className="font-semibold text-slate-700 mb-3 text-sm flex items-center gap-2">
                            <Minus className="w-4 h-4" /> Canjear Puntos
                        </h3>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                value={redeemAmount}
                                onChange={(e) => setRedeemAmount(e.target.value)}
                                placeholder="Cantidad de puntos"
                                min="1"
                                max={balance?.points || 0}
                                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <button
                                onClick={handleRedeemPoints}
                                disabled={submitting || !redeemAmount || parseInt(redeemAmount) <= 0}
                                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Canjear
                            </button>
                        </div>
                    </div>

                    {/* Add Wallet Funds */}
                    <div className="bg-slate-50 rounded-lg p-4">
                        <h3 className="font-semibold text-slate-700 mb-3 text-sm flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Cargar Billetera
                        </h3>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                value={walletAmount}
                                onChange={(e) => setWalletAmount(e.target.value)}
                                placeholder="Monto ($)"
                                min="0.01"
                                step="0.01"
                                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <button
                                onClick={handleAddWallet}
                                disabled={submitting || !walletAmount || parseFloat(walletAmount) <= 0}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cargar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
