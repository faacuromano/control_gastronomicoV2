/**
 * @fileoverview Sync Manager for offline data synchronization
 * Handles pull (download data) and push (upload pending operations)
 * with concurrency guard, exponential backoff retries, and notifications.
 *
 * @module lib/syncManager
 */

import { offlineDb, type OfflineProduct, type OfflineCategory, type OfflinePrinterRouting } from './offlineDb';
import { isOnline } from './connectivity';
import api from './api';
import { getErrorMessage } from './errorUtils';
import { notifySyncCompleted, notifySyncFailed, notifyConflictWarnings, notifyRetrying } from './syncNotifications';
import { registerBackgroundSync, listenForSyncMessages } from './swBridge';

interface SyncPullResponse {
    products: OfflineProduct[];
    categories: OfflineCategory[];
    printerRouting: OfflinePrinterRouting[];
    serverTime: string;
    syncToken: string;
}

interface OrderMapping {
    tempId: string;
    realId: number | null;
    orderNumber: number | null;
    status: 'SYNCED' | 'CONFLICT' | 'ERROR';
}

interface SyncPushResponse {
    success: boolean;
    orderMappings: OrderMapping[];
    errors: { tempId: string; code: string; message: string }[];
    warnings: { tempId: string; code: string; message: string }[];
    syncedAt: string;
}

export type SyncStatus = 'idle' | 'pulling' | 'pushing' | 'synced' | 'error';

type WarningListener = (warnings: SyncPushResponse['warnings']) => void;

class SyncManager {
    private _status: SyncStatus = 'idle';
    private _lastError: string | null = null;
    private _syncInProgress = false;
    private _listeners: Set<(status: SyncStatus) => void> = new Set();
    private _warningListeners: Set<WarningListener> = new Set();
    private _lastWarnings: SyncPushResponse['warnings'] = [];

    get status(): SyncStatus {
        return this._status;
    }

    get lastError(): string | null {
        return this._lastError;
    }

    get lastWarnings(): SyncPushResponse['warnings'] {
        return this._lastWarnings;
    }

    /**
     * Subscribe to status changes
     */
    subscribe(listener: (status: SyncStatus) => void): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    /**
     * Subscribe to sync warnings
     */
    subscribeWarnings(listener: WarningListener): () => void {
        this._warningListeners.add(listener);
        return () => this._warningListeners.delete(listener);
    }

    private setStatus(status: SyncStatus, error?: string) {
        this._status = status;
        this._lastError = error || null;
        this._listeners.forEach(listener => listener(status));
    }

    private setWarnings(warnings: SyncPushResponse['warnings']) {
        this._lastWarnings = warnings;
        this._warningListeners.forEach(listener => listener(warnings));
    }

    /**
     * Pull data from server and store in IndexedDB
     * Call on startup and when coming online
     */
    async pull(): Promise<void> {
        if (!isOnline()) {
            console.log('[SyncManager] Offline, skipping pull');
            return;
        }

        this.setStatus('pulling');

        try {
            const response = await api.get<{ data: SyncPullResponse }>('/sync/pull');
            const data = response.data.data;

            await offlineDb.storeSyncData({
                products: data.products,
                categories: data.categories,
                printerRouting: data.printerRouting,
                serverTime: data.serverTime,
                syncToken: data.syncToken
            });

            console.log('[SyncManager] Pull completed', {
                products: data.products.length,
                categories: data.categories.length
            });

            this.setStatus('synced');
        } catch (error: unknown) {
            console.error('[SyncManager] Pull failed', error);
            this.setStatus('error', getErrorMessage(error, 'Pull failed'));
            throw error;
        }
    }

    /**
     * Push pending operations to server.
     * Includes syncToken for conflict detection and handles both orders and payments.
     */
    async push(): Promise<SyncPushResponse | null> {
        if (!isOnline()) {
            console.log('[SyncManager] Offline, skipping push');
            return null;
        }

        const pendingOrders = await offlineDb.getPendingOrders();
        const pendingPayments = await offlineDb.getPendingPayments();

        if (pendingOrders.length === 0 && pendingPayments.length === 0) {
            console.log('[SyncManager] Nothing to push');
            return null;
        }

        this.setStatus('pushing');

        try {
            // Read syncToken from IndexedDB for conflict detection
            const syncToken = await offlineDb.getSyncToken();

            // Format data for API
            const requestData = {
                clientId: this.getClientId(),
                syncToken: syncToken || undefined,
                pendingOrders: pendingOrders.map(o => ({
                    tempId: o.tempId,
                    items: o.items,
                    channel: o.channel,
                    tableId: o.tableId,
                    clientId: o.clientId,
                    createdAt: o.createdAt.toISOString(),
                    shiftId: o.shiftId
                })),
                pendingPayments: pendingPayments.map(p => ({
                    tempOrderId: p.tempOrderId,
                    method: p.method,
                    amount: p.amount,
                    createdAt: p.createdAt.toISOString()
                }))
            };

            const response = await api.post<{ data: SyncPushResponse }>(
                '/sync/push',
                requestData
            );
            const result = response.data.data;

            // Update local order status based on response
            const syncedIds = result.orderMappings
                .filter(m => m.status === 'SYNCED')
                .map(m => m.tempId);

            if (syncedIds.length > 0) {
                await offlineDb.markOrdersSynced(syncedIds);
            }

            // Mark order errors
            for (const error of result.errors) {
                await offlineDb.markOrderError(error.tempId, error.message);
            }

            // Mark payments synced/error based on order mapping results
            // Payments whose orders synced successfully are considered synced
            if (syncedIds.length > 0) {
                await offlineDb.markPaymentsSynced(syncedIds);
            }
            // Payments whose orders errored should also be marked as error
            const errorTempIds = result.errors.map(e => e.tempId);
            for (const tempId of errorTempIds) {
                await offlineDb.markPaymentError(tempId, 'Associated order sync failed');
            }

            // Also mark real_ prefixed payments as synced (payments for existing server orders)
            const realPrefixedPaymentIds = pendingPayments
                .filter(p => p.tempOrderId.startsWith('real_'))
                .map(p => p.tempOrderId);
            if (realPrefixedPaymentIds.length > 0) {
                await offlineDb.markPaymentsSynced(realPrefixedPaymentIds);
            }

            // Garbage collection: cleanup old synced records
            await offlineDb.cleanupSyncedRecords();

            // Emit warnings to subscribers
            if (result.warnings.length > 0) {
                this.setWarnings(result.warnings);
                notifyConflictWarnings(result.warnings);
            }

            console.log('[SyncManager] Push completed', {
                synced: syncedIds.length,
                errors: result.errors.length,
                warnings: result.warnings.length
            });

            // Notify user of sync results
            if (syncedIds.length > 0 || realPrefixedPaymentIds.length > 0) {
                notifySyncCompleted(syncedIds.length, realPrefixedPaymentIds.length);
            }

            this.setStatus(result.success ? 'synced' : 'error');
            return result;
        } catch (error: unknown) {
            console.error('[SyncManager] Push failed', error);
            const msg = getErrorMessage(error, 'Push failed');
            this.setStatus('error', msg);
            notifySyncFailed(msg);

            // Belt-and-suspenders: register Background Sync as fallback
            registerBackgroundSync().catch(() => {});

            throw error;
        }
    }

    /**
     * Retry push with exponential backoff.
     * Used when coming online to give the network a moment to stabilize.
     */
    async retryPush(maxRetries = 3): Promise<SyncPushResponse | null> {
        let lastError: unknown;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (!isOnline()) return null;
                return await this.push();
            } catch (error) {
                lastError = error;
                if (attempt < maxRetries) {
                    const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
                    console.log(`[SyncManager] Retry ${attempt}/${maxRetries} in ${delayMs}ms`);
                    notifyRetrying(attempt, maxRetries);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
        }
        console.error('[SyncManager] All retries exhausted', lastError);
        return null;
    }

    /**
     * Full sync: push pending data then pull fresh catalog.
     * Guarded against concurrent execution.
     */
    async fullSync(): Promise<void> {
        if (this._syncInProgress) {
            console.log('[SyncManager] Sync already in progress, skipping');
            return;
        }
        this._syncInProgress = true;
        try {
            await this.retryPush();
            await this.pull();
        } finally {
            this._syncInProgress = false;
        }
    }

    /**
     * Check if there are pending operations
     */
    async hasPending(): Promise<boolean> {
        const count = await offlineDb.getPendingCount();
        return count > 0;
    }

    /**
     * Get count of pending operations
     */
    async getPendingCount(): Promise<number> {
        return offlineDb.getPendingCount();
    }

    /**
     * Clear warnings (after user dismisses them)
     */
    clearWarnings() {
        this._lastWarnings = [];
        this._warningListeners.forEach(listener => listener([]));
    }

    /**
     * Get unique client identifier for this terminal
     */
    private getClientId(): string {
        let clientId = localStorage.getItem('pos-client-id');
        if (!clientId) {
            clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('pos-client-id', clientId);
        }
        return clientId;
    }
}

// Singleton instance
export const syncManager = new SyncManager();

// Auto-sync when coming online (with retry + backoff)
if (typeof window !== 'undefined') {
    window.addEventListener('online', async () => {
        console.log('[SyncManager] Online detected, starting sync...');
        try {
            await syncManager.fullSync();
        } catch (error) {
            console.error('[SyncManager] Auto-sync failed', error);
        }
    });

    // Listen for Background Sync completion from Service Worker
    listenForSyncMessages((data) => {
        if (data.type === 'BACKGROUND_SYNC_COMPLETED') {
            console.log('[SyncManager] Background Sync completed, refreshing catalog...');
            syncManager.pull().catch(err =>
                console.error('[SyncManager] Post-background-sync pull failed', err)
            );
        }
    });
}
