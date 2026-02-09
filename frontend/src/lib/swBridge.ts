/**
 * @fileoverview Bridge between the main thread and the Service Worker.
 * Provides Background Sync registration with feature detection and fallback.
 *
 * @module lib/swBridge
 */

// Type augmentation for Background Sync API (not yet in standard TS lib)
declare global {
    interface ServiceWorkerRegistration {
        readonly sync: SyncManager;
    }
    interface SyncManager {
        register(tag: string): Promise<void>;
    }
}

/**
 * Check if Background Sync API is supported (Chromium-only as of 2026).
 */
export function isBackgroundSyncSupported(): boolean {
    return 'serviceWorker' in navigator && 'SyncManager' in window;
}

/**
 * Register a Background Sync event with the service worker.
 * Falls back gracefully if not supported (Safari, Firefox).
 */
export async function registerBackgroundSync(tag = 'pentiumpos-sync-queue'): Promise<boolean> {
    if (!isBackgroundSyncSupported()) {
        console.log('[swBridge] Background Sync not supported, skipping registration');
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register(tag);
        console.log(`[swBridge] Background Sync registered: ${tag}`);
        return true;
    } catch (error) {
        console.warn('[swBridge] Background Sync registration failed', error);
        return false;
    }
}

/**
 * Listen for messages from the Service Worker (e.g. Background Sync completion).
 * Returns an unsubscribe function.
 */
export function listenForSyncMessages(
    callback: (data: { type: string; tag?: string }) => void
): () => void {
    if (!('serviceWorker' in navigator)) return () => {};

    const handler = (event: MessageEvent) => {
        if (event.data?.type) {
            callback(event.data);
        }
    };

    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
}

/**
 * Send a message to the active Service Worker.
 */
export async function postMessageToSW(message: unknown): Promise<void> {
    if (!('serviceWorker' in navigator)) return;

    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage(message);
}

/**
 * Trigger a manual sync via the Service Worker.
 */
export async function triggerManualSync(): Promise<void> {
    // Try Background Sync first
    const registered = await registerBackgroundSync();
    if (!registered) {
        // Fallback: tell SW directly
        await postMessageToSW({ type: 'TRIGGER_SYNC' });
    }
}
