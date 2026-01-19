/**
 * @fileoverview Sync Manager for offline data synchronization
 * Handles pull (download data) and push (upload pending operations)
 * 
 * @module lib/syncManager
 */

import { offlineDb } from './offlineDb';
import { isOnline } from './connectivity';
import api from './api';

interface SyncPullResponse {
    products: any[];
    categories: any[];
    printerRouting: any[];
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

class SyncManager {
    private _status: SyncStatus = 'idle';
    private _lastError: string | null = null;
    private _listeners: Set<(status: SyncStatus) => void> = new Set();

    get status(): SyncStatus {
        return this._status;
    }

    get lastError(): string | null {
        return this._lastError;
    }

    /**
     * Subscribe to status changes
     */
    subscribe(listener: (status: SyncStatus) => void): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    private setStatus(status: SyncStatus, error?: string) {
        this._status = status;
        this._lastError = error || null;
        this._listeners.forEach(listener => listener(status));
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
        } catch (error: any) {
            console.error('[SyncManager] Pull failed', error);
            this.setStatus('error', error.message);
            throw error;
        }
    }

    /**
     * Push pending operations to server
     * Call when coming online or manually triggered
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
            // Format data for API
            const requestData = {
                clientId: this.getClientId(),
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

            // Update local status based on response
            const syncedIds = result.orderMappings
                .filter(m => m.status === 'SYNCED')
                .map(m => m.tempId);

            if (syncedIds.length > 0) {
                await offlineDb.markOrdersSynced(syncedIds);
            }

            // Mark errors
            for (const error of result.errors) {
                await offlineDb.markOrderError(error.tempId, error.message);
            }

            console.log('[SyncManager] Push completed', {
                synced: syncedIds.length,
                errors: result.errors.length
            });

            this.setStatus(result.success ? 'synced' : 'error');
            return result;
        } catch (error: any) {
            console.error('[SyncManager] Push failed', error);
            this.setStatus('error', error.message);
            throw error;
        }
    }

    /**
     * Full sync: push then pull
     */
    async fullSync(): Promise<void> {
        await this.push();
        await this.pull();
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

// Auto-sync when coming online
if (typeof window !== 'undefined') {
    window.addEventListener('online', async () => {
        console.log('[SyncManager] Online detected, starting sync...');
        try {
            await syncManager.fullSync();
        } catch (error) {
            console.error('[SyncManager] Auto-sync failed', error);
        }
    });
}
