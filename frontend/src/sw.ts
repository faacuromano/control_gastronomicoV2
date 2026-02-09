/**
 * @fileoverview Custom Service Worker for PentiumPOS
 * Handles precaching, runtime caching, Background Sync for offline orders,
 * and SPA navigation fallback.
 *
 * Built with Workbox via vite-plugin-pwa injectManifest strategy.
 *
 * @module sw
 */

/// <reference lib="webworker" />

import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

declare const self: ServiceWorkerGlobalScope;

// ============================================================================
// PRECACHING
// ============================================================================

// Precache all assets from the Vite build manifest
precacheAndRoute(self.__WB_MANIFEST);

// ============================================================================
// SPA NAVIGATION FALLBACK
// ============================================================================

// Serve index.html for all navigation requests (SPA routing)
const navigationHandler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(navigationHandler, {
    // Don't intercept API calls or static assets
    denylist: [/\/api\//, /\.\w+$/],
});
registerRoute(navigationRoute);

// ============================================================================
// RUNTIME CACHING
// ============================================================================

// Cache sync/pull responses with NetworkFirst (24h fallback)
registerRoute(
    ({ url }) => url.pathname.includes('/api/v1/sync/pull'),
    new NetworkFirst({
        cacheName: 'sync-cache',
        plugins: [
            new ExpirationPlugin({
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
            }),
        ],
    })
);

// Cache product/category/modifier data with StaleWhileRevalidate (1h)
registerRoute(
    ({ url }) => /\/api\/v1\/(products|categories|modifiers)/.test(url.pathname),
    new StaleWhileRevalidate({
        cacheName: 'api-cache',
        plugins: [
            new ExpirationPlugin({
                maxAgeSeconds: 60 * 60, // 1 hour
            }),
        ],
    })
);

// ============================================================================
// BACKGROUND SYNC
// ============================================================================

// Background Sync queue for sync/push requests
const bgSyncPlugin = new BackgroundSyncPlugin('pentiumpos-sync-queue', {
    maxRetentionTime: 24 * 60, // 24 hours in minutes
    onSync: async ({ queue }) => {
        let entry;
        while ((entry = await queue.shiftRequest())) {
            try {
                await fetch(entry.request.clone());
                // Notify clients of successful sync
                const clients = await self.clients.matchAll({ type: 'window' });
                for (const client of clients) {
                    client.postMessage({
                        type: 'BACKGROUND_SYNC_COMPLETED',
                        tag: 'pentiumpos-sync-queue',
                    });
                }
            } catch (error) {
                // Put the entry back if it fails
                await queue.unshiftRequest(entry);
                throw error;
            }
        }
    },
});

// Register Background Sync for sync/push endpoint
registerRoute(
    ({ url }) => url.pathname.includes('/api/v1/sync/push'),
    new NetworkFirst({
        cacheName: 'sync-push-cache',
        plugins: [bgSyncPlugin],
    }),
    'POST'
);

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data?.type === 'TRIGGER_SYNC') {
        // Manual sync trigger from main thread
        self.registration.sync?.register('pentiumpos-sync-queue').catch(() => {
            // Background Sync not supported - main thread handles fallback
        });
    }

    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ============================================================================
// ACTIVATION
// ============================================================================

// Claim clients immediately on activation
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});
