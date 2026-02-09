/**
 * @fileoverview Sync Conflict Dialog
 * Shows sync warnings to the user with explanations and actions.
 *
 * @module components/SyncConflictDialog
 */

import React from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { syncManager } from '../lib/syncManager';

interface SyncWarning {
    tempId: string;
    code: string;
    message: string;
}

interface SyncConflictDialogProps {
    warnings: SyncWarning[];
    onClose: () => void;
}

const WARNING_MESSAGES: Record<string, { title: string; description: string }> = {
    CATALOG_CHANGED: {
        title: 'Catálogo actualizado',
        description: 'Los productos o precios cambiaron desde la última sincronización. Los precios de las órdenes offline pueden diferir de los actuales.',
    },
    SHIFT_REASSIGNED: {
        title: 'Turno de caja reasignado',
        description: 'Algunas órdenes se crearon durante un turno de caja que ya cerró. Se asignaron automáticamente al turno actual.',
    },
    CONCURRENT_CHANGES: {
        title: 'Cambios concurrentes',
        description: 'Se detectaron otras órdenes creadas mientras estabas offline. Revisa las órdenes recientes para verificar que no haya duplicados.',
    },
    MISSING_SYNC_TOKEN: {
        title: 'Token de sincronización ausente',
        description: 'No se pudo verificar si los datos estaban actualizados. Se recomienda resincronizar el catálogo.',
    },
    DUPLICATE_TEMP_ID: {
        title: 'Orden duplicada detectada',
        description: 'Se detectó un reintento de sincronización. Las órdenes duplicadas fueron omitidas automáticamente.',
    },
};

export const SyncConflictDialog: React.FC<SyncConflictDialogProps> = ({ warnings, onClose }) => {
    if (warnings.length === 0) return null;

    // Deduplicate by code (same warning code may appear for multiple orders)
    const uniqueWarnings = warnings.reduce<SyncWarning[]>((acc, w) => {
        if (!acc.some(existing => existing.code === w.code)) {
            acc.push(w);
        }
        return acc;
    }, []);

    const handleResync = async () => {
        try {
            await syncManager.pull();
            onClose();
        } catch (error) {
            console.error('Resync failed:', error);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 bg-amber-50 border-b border-amber-200">
                    <AlertTriangle className="text-amber-600 shrink-0" size={22} />
                    <h2 className="text-lg font-semibold text-amber-900">
                        Advertencias de sincronización
                    </h2>
                    <button
                        onClick={onClose}
                        className="ml-auto p-1 rounded hover:bg-amber-100 text-amber-600"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Warning list */}
                <div className="px-5 py-4 space-y-3 max-h-80 overflow-y-auto">
                    {uniqueWarnings.map((warning, idx) => {
                        const info = WARNING_MESSAGES[warning.code];
                        return (
                            <div
                                key={`${warning.code}-${idx}`}
                                className="p-3 bg-slate-50 rounded-lg border border-slate-200"
                            >
                                <p className="font-medium text-sm text-slate-800">
                                    {info?.title || warning.code}
                                </p>
                                <p className="text-xs text-slate-600 mt-1">
                                    {info?.description || warning.message}
                                </p>
                            </div>
                        );
                    })}
                </div>

                {/* Actions */}
                <div className="flex gap-3 px-5 py-4 border-t border-slate-200 bg-slate-50">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                        Entendido
                    </button>
                    {uniqueWarnings.some(w => w.code === 'CATALOG_CHANGED' || w.code === 'MISSING_SYNC_TOKEN') && (
                        <button
                            onClick={handleResync}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                        >
                            <RefreshCw size={14} />
                            Resincronizar catálogo
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SyncConflictDialog;
