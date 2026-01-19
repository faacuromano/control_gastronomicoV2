/**
 * @fileoverview Offline Indicator Component
 * Shows connection status and pending sync operations
 * 
 * @module components/OfflineIndicator
 */

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { useOnlineStatus } from '../lib/connectivity';
import { syncManager, type SyncStatus } from '../lib/syncManager';
import { offlineDb } from '../lib/offlineDb';

export const OfflineIndicator: React.FC = () => {
    const isOnline = useOnlineStatus();
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
    const [pendingCount, setPendingCount] = useState(0);
    const [showDetails, setShowDetails] = useState(false);

    // Subscribe to sync status changes
    useEffect(() => {
        const unsubscribe = syncManager.subscribe(setSyncStatus);
        return () => unsubscribe();
    }, []);

    // Update pending count periodically
    useEffect(() => {
        const updatePendingCount = async () => {
            const count = await offlineDb.getPendingCount();
            setPendingCount(count);
        };

        updatePendingCount();
        const interval = setInterval(updatePendingCount, 5000);
        return () => clearInterval(interval);
    }, []);

    // Handle manual sync
    const handleSync = async () => {
        try {
            await syncManager.fullSync();
        } catch (error) {
            console.error('Manual sync failed:', error);
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

    // Don't show if online and nothing pending
    if (isOnline && pendingCount === 0 && syncStatus !== 'error') {
        return null;
    }

    return (
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
                ) : (
                    'Sincronizando...'
                )}
            </button>

            {/* Details dropdown */}
            {showDetails && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 p-3 z-50">
                    <div className="space-y-3">
                        {/* Status */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600">Estado:</span>
                            <span className={`text-sm font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                                {isOnline ? 'Conectado' : 'Sin conexión'}
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

                        {/* Sync button */}
                        {isOnline && (pendingCount > 0 || syncStatus === 'error') && (
                            <button
                                onClick={handleSync}
                                disabled={syncStatus === 'pushing' || syncStatus === 'pulling'}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                            >
                                <RefreshCw size={14} className={isSpinning ? 'animate-spin' : ''} />
                                {isSpinning ? 'Sincronizando...' : 'Sincronizar ahora'}
                            </button>
                        )}

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
    );
};

export default OfflineIndicator;
