/**
 * @fileoverview Offline Indicator Component
 * Shows connection status, pending sync operations, and sync warnings.
 * Always visible (compact when online and synced).
 *
 * @module components/OfflineIndicator
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { useOnlineStatus } from '../lib/connectivity';
import { syncManager, type SyncStatus } from '../lib/syncManager';
import { offlineDb } from '../lib/offlineDb';
import SyncConflictDialog from './SyncConflictDialog';

interface SyncWarning {
    tempId: string;
    code: string;
    message: string;
}

export const OfflineIndicator: React.FC = () => {
    const isOnline = useOnlineStatus();
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
    const [pendingCount, setPendingCount] = useState(0);
    const [showDetails, setShowDetails] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<SyncWarning[]>([]);
    const [showConflictDialog, setShowConflictDialog] = useState(false);

    // Subscribe to sync status changes
    useEffect(() => {
        const unsubscribe = syncManager.subscribe(setSyncStatus);
        return () => unsubscribe();
    }, []);

    // Subscribe to sync warnings
    useEffect(() => {
        const unsubscribe = syncManager.subscribeWarnings((newWarnings) => {
            if (newWarnings.length > 0) {
                setWarnings(newWarnings);
                setShowConflictDialog(true);
            }
        });
        return () => unsubscribe();
    }, []);

    // Update pending count and last sync time periodically
    useEffect(() => {
        const update = async () => {
            const count = await offlineDb.getPendingCount();
            setPendingCount(count);
            const time = await offlineDb.getLastSyncTime();
            setLastSyncTime(time);
        };

        update();
        const interval = setInterval(update, 5000);
        return () => clearInterval(interval);
    }, []);

    // Handle manual sync
    const handleSync = useCallback(async () => {
        try {
            await syncManager.fullSync();
        } catch (error) {
            console.error('Manual sync failed:', error);
        }
    }, []);

    // Handle retry errors
    const handleRetryErrors = useCallback(async () => {
        const count = await offlineDb.resetErrorOrders();
        if (count > 0) {
            await syncManager.fullSync();
        }
    }, []);

    // Dismiss conflict dialog
    const handleCloseConflict = useCallback(() => {
        setShowConflictDialog(false);
        syncManager.clearWarnings();
    }, []);

    // Format last sync time
    const formatSyncTime = (iso: string | null): string => {
        if (!iso) return 'Nunca';
        try {
            const date = new Date(iso);
            return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return 'Desconocido';
        }
    };

    // Determine badge color and icon
    const getBadgeStyle = () => {
        if (!isOnline) {
            return {
                bg: 'bg-red-100',
                text: 'text-red-700',
                border: 'border-red-200',
                icon: WifiOff
            };
        }
        if (syncStatus === 'pushing' || syncStatus === 'pulling') {
            return {
                bg: 'bg-blue-100',
                text: 'text-blue-700',
                border: 'border-blue-200',
                icon: RefreshCw
            };
        }
        if (syncStatus === 'error') {
            return {
                bg: 'bg-amber-100',
                text: 'text-amber-700',
                border: 'border-amber-200',
                icon: AlertCircle
            };
        }
        if (pendingCount > 0) {
            return {
                bg: 'bg-amber-100',
                text: 'text-amber-700',
                border: 'border-amber-200',
                icon: Wifi
            };
        }
        return {
            bg: 'bg-green-100',
            text: 'text-green-700',
            border: 'border-green-200',
            icon: CheckCircle
        };
    };

    const style = getBadgeStyle();
    const Icon = style.icon;
    const isSpinning = syncStatus === 'pushing' || syncStatus === 'pulling';
    const hasWarnings = warnings.length > 0;

    return (
        <>
            <div className="relative">
                <button
                    onClick={() => setShowDetails(!showDetails)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border ${style.bg} ${style.text} ${style.border} transition-colors`}
                >
                    <Icon size={14} className={isSpinning ? 'animate-spin' : ''} />
                    {!isOnline ? (
                        'Offline'
                    ) : pendingCount > 0 ? (
                        <span>{pendingCount} pendiente{pendingCount > 1 ? 's' : ''}</span>
                    ) : syncStatus === 'error' ? (
                        'Error sync'
                    ) : isSpinning ? (
                        'Sincronizando...'
                    ) : (
                        <span className="hidden sm:inline">Sincronizado</span>
                    )}
                    {hasWarnings && (
                        <AlertTriangle size={12} className="text-amber-500" />
                    )}
                </button>

                {/* Details dropdown */}
                {showDetails && (
                    <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-lg border border-slate-200 p-3 z-50">
                        <div className="space-y-3">
                            {/* Status */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">Estado:</span>
                                <span className={`text-sm font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                                    {isOnline ? 'Conectado' : 'Sin conexión'}
                                </span>
                            </div>

                            {/* Last sync time */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">Última sync:</span>
                                <span className="text-sm font-medium text-slate-700">
                                    {formatSyncTime(lastSyncTime)}
                                </span>
                            </div>

                            {/* Pending operations */}
                            {pendingCount > 0 && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600">Pendientes:</span>
                                    <span className="text-sm font-medium text-amber-600">
                                        {pendingCount} operación{pendingCount > 1 ? 'es' : ''}
                                    </span>
                                </div>
                            )}

                            {/* Error message */}
                            {syncStatus === 'error' && syncManager.lastError && (
                                <div className="p-2 bg-red-50 rounded text-xs text-red-700">
                                    {syncManager.lastError}
                                </div>
                            )}

                            {/* Warning indicator */}
                            {hasWarnings && (
                                <button
                                    onClick={() => {
                                        setShowConflictDialog(true);
                                        setShowDetails(false);
                                    }}
                                    className="w-full flex items-center gap-2 p-2 bg-amber-50 rounded text-xs text-amber-700 hover:bg-amber-100"
                                >
                                    <AlertTriangle size={14} />
                                    {warnings.length} advertencia{warnings.length > 1 ? 's' : ''} de sincronización
                                </button>
                            )}

                            {/* Action buttons */}
                            <div className="flex gap-2">
                                {isOnline && (pendingCount > 0 || syncStatus === 'error') && (
                                    <button
                                        onClick={handleSync}
                                        disabled={isSpinning}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        <RefreshCw size={14} className={isSpinning ? 'animate-spin' : ''} />
                                        {isSpinning ? 'Sincronizando...' : 'Sincronizar'}
                                    </button>
                                )}
                                {syncStatus === 'error' && (
                                    <button
                                        onClick={handleRetryErrors}
                                        disabled={isSpinning}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                                    >
                                        Reintentar errores
                                    </button>
                                )}
                            </div>

                            {/* Offline info */}
                            {!isOnline && (
                                <div className="p-2 bg-slate-50 rounded text-xs text-slate-600">
                                    Las operaciones se guardarán localmente y se sincronizarán al recuperar conexión.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Conflict resolution dialog */}
            {showConflictDialog && (
                <SyncConflictDialog
                    warnings={warnings}
                    onClose={handleCloseConflict}
                />
            )}
        </>
    );
};

export default OfflineIndicator;
