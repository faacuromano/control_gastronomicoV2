import React, { useState, useEffect } from 'react';
import { Percent, DollarSign, Tag, Calculator, Send, Trash2, Loader2 } from 'lucide-react';
import {
    discountService,
    calculateDiscountPreview,
    type DiscountType,
    type DiscountReason,
    type DiscountReasonOption,
    type DiscountTypeOption,
    type DiscountResult,
} from '../../../services/discountService';
import { toast } from 'sonner';

export const DiscountsPage: React.FC = () => {
    const [reasons, setReasons] = useState<DiscountReasonOption[]>([]);
    const [types, setTypes] = useState<DiscountTypeOption[]>([]);
    const [loading, setLoading] = useState(true);

    // Apply discount form
    const [orderId, setOrderId] = useState('');
    const [discountType, setDiscountType] = useState<DiscountType>('PERCENTAGE');
    const [value, setValue] = useState('');
    const [reason, setReason] = useState<DiscountReason>('PROMOTION');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [lastResult, setLastResult] = useState<DiscountResult | null>(null);

    // Remove discount form
    const [removeOrderId, setRemoveOrderId] = useState('');
    const [removing, setRemoving] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        setLoading(true);
        try {
            const [r, t] = await Promise.all([
                discountService.getDiscountReasons(),
                discountService.getDiscountTypes(),
            ]);
            setReasons(r);
            setTypes(t);
        } catch {
            toast.error('Error al cargar configuración de descuentos');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);

    const previewAmount = value
        ? calculateDiscountPreview(1000, discountType, parseFloat(value))
        : 0;

    const handleApply = async (e: React.FormEvent) => {
        e.preventDefault();
        const oid = parseInt(orderId);
        const val = parseFloat(value);
        if (!oid || !val || val <= 0) return;

        setSubmitting(true);
        try {
            const result = await discountService.applyDiscount({
                orderId: oid,
                type: discountType,
                value: val,
                reason,
                notes: notes || undefined,
            });
            setLastResult(result);
            toast.success(
                `Descuento aplicado — Orden #${oid}: ${formatCurrency(result.previousTotal)} → ${formatCurrency(result.newTotal)}`
            );
            setOrderId('');
            setValue('');
            setNotes('');
        } catch {
            toast.error('Error al aplicar descuento. Verifique que la orden exista y no esté pagada.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemove = async (e: React.FormEvent) => {
        e.preventDefault();
        const oid = parseInt(removeOrderId);
        if (!oid) return;

        setRemoving(true);
        try {
            const result = await discountService.removeDiscount(oid);
            setLastResult(result);
            toast.success(
                `Descuento eliminado — Orden #${oid}: Total restaurado a ${formatCurrency(result.newTotal)}`
            );
            setRemoveOrderId('');
        } catch {
            toast.error('Error al eliminar descuento. Verifique que la orden exista y no esté pagada.');
        } finally {
            setRemoving(false);
        }
    };

    const reasonIcon = (code: string) => {
        switch (code) {
            case 'EMPLOYEE': return '👤';
            case 'VIP_CUSTOMER': return '⭐';
            case 'PROMOTION': return '🏷️';
            case 'COMPLAINT': return '📋';
            case 'MANAGER_COURTESY': return '🤝';
            case 'LOYALTY': return '💎';
            default: return '📌';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800">Descuentos</h1>
            </div>

            {/* Discount Types & Reasons Reference */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Types */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-indigo-500" /> Tipos de Descuento
                    </h2>
                    <div className="space-y-3">
                        {types.map((t) => (
                            <div
                                key={t.code}
                                className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100"
                            >
                                {t.code === 'PERCENTAGE' ? (
                                    <Percent className="w-5 h-5 text-blue-500" />
                                ) : (
                                    <DollarSign className="w-5 h-5 text-green-500" />
                                )}
                                <div>
                                    <p className="font-medium text-slate-700">{t.label}</p>
                                    <p className="text-xs text-slate-500">
                                        {t.code === 'PERCENTAGE'
                                            ? 'Se aplica como porcentaje del subtotal (0-100%)'
                                            : 'Se descuenta un monto fijo del subtotal'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Reasons */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <Tag className="w-5 h-5 text-amber-500" /> Razones de Descuento
                    </h2>
                    <div className="grid grid-cols-2 gap-2">
                        {reasons.map((r) => (
                            <div
                                key={r.code}
                                className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-sm"
                            >
                                <span className="text-base">{reasonIcon(r.code)}</span>
                                <span className="font-medium text-slate-700">{r.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Apply Discount */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Send className="w-5 h-5 text-indigo-500" /> Aplicar Descuento a Orden
                </h2>
                <form onSubmit={handleApply} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Nro. Orden *
                            </label>
                            <input
                                type="number"
                                required
                                value={orderId}
                                onChange={(e) => setOrderId(e.target.value)}
                                placeholder="Ej: 1234"
                                min="1"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Tipo *
                            </label>
                            <select
                                value={discountType}
                                onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {types.map((t) => (
                                    <option key={t.code} value={t.code}>
                                        {t.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Valor * {discountType === 'PERCENTAGE' ? '(%)' : '($)'}
                            </label>
                            <input
                                type="number"
                                required
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                placeholder={discountType === 'PERCENTAGE' ? '10' : '500'}
                                min="0.01"
                                max={discountType === 'PERCENTAGE' ? '100' : undefined}
                                step="0.01"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Razón *
                            </label>
                            <select
                                value={reason}
                                onChange={(e) => setReason(e.target.value as DiscountReason)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {reasons.map((r) => (
                                    <option key={r.code} value={r.code}>
                                        {r.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Notas (opcional)
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Descripción adicional del descuento..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    {/* Preview */}
                    {value && parseFloat(value) > 0 && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm">
                            <span className="text-indigo-700 font-medium">Vista previa: </span>
                            <span className="text-indigo-600">
                                {discountType === 'PERCENTAGE'
                                    ? `${value}% de descuento → sobre $1.000 sería ${formatCurrency(previewAmount)}`
                                    : `Descuento fijo de ${formatCurrency(parseFloat(value))}`}
                            </span>
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={submitting || !orderId || !value}
                            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {submitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                            Aplicar Descuento
                        </button>
                    </div>
                </form>
            </div>

            {/* Remove Discount */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Trash2 className="w-5 h-5 text-red-500" /> Eliminar Descuento de Orden
                </h2>
                <form onSubmit={handleRemove} className="flex items-end gap-4">
                    <div className="flex-1 max-w-xs">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Nro. Orden *
                        </label>
                        <input
                            type="number"
                            required
                            value={removeOrderId}
                            onChange={(e) => setRemoveOrderId(e.target.value)}
                            placeholder="Ej: 1234"
                            min="1"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={removing || !removeOrderId}
                        className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {removing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Trash2 className="w-4 h-4" />
                        )}
                        Eliminar Descuento
                    </button>
                </form>
            </div>

            {/* Last Result */}
            {lastResult && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
                    <h3 className="font-semibold text-emerald-800 mb-3">Resultado de la última operación</h3>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                            <span className="text-emerald-600">Orden</span>
                            <p className="font-bold text-emerald-900">#{lastResult.orderId}</p>
                        </div>
                        <div>
                            <span className="text-emerald-600">Total anterior</span>
                            <p className="font-bold text-emerald-900">{formatCurrency(lastResult.previousTotal)}</p>
                        </div>
                        <div>
                            <span className="text-emerald-600">Descuento</span>
                            <p className="font-bold text-emerald-900">
                                {lastResult.discountAmount >= 0 ? '-' : '+'}
                                {formatCurrency(Math.abs(lastResult.discountAmount))}
                            </p>
                        </div>
                        <div>
                            <span className="text-emerald-600">Nuevo total</span>
                            <p className="font-bold text-emerald-900">{formatCurrency(lastResult.newTotal)}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
