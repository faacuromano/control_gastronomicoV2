/**
 * @fileoverview Toast notifications for sync lifecycle events
 * Uses sonner for consistent toast UI across the app
 *
 * @module lib/syncNotifications
 */

import { toast } from 'sonner';

/**
 * Notify that sync push completed successfully
 */
export function notifySyncCompleted(orderCount: number, paymentCount: number) {
    const parts: string[] = [];
    if (orderCount > 0) parts.push(`${orderCount} orden${orderCount > 1 ? 'es' : ''}`);
    if (paymentCount > 0) parts.push(`${paymentCount} pago${paymentCount > 1 ? 's' : ''}`);

    if (parts.length > 0) {
        toast.success(`Sincronizado: ${parts.join(' y ')}`, {
            duration: 4000,
        });
    }
}

/**
 * Notify that sync failed
 */
export function notifySyncFailed(error: string) {
    toast.error(`Error de sincronización: ${error}`, {
        duration: 6000,
    });
}

/**
 * Notify conflict warnings from sync push response
 */
export function notifyConflictWarnings(warnings: { code: string; message: string }[]) {
    // Filter to meaningful warnings (skip internal ones)
    const userWarnings = warnings.filter(w =>
        w.code === 'CATALOG_CHANGED' ||
        w.code === 'SHIFT_REASSIGNED' ||
        w.code === 'CONCURRENT_CHANGES'
    );

    if (userWarnings.length === 0) return;

    const messages: Record<string, string> = {
        CATALOG_CHANGED: 'El catálogo de productos cambió. Se recomienda resincronizar.',
        SHIFT_REASSIGNED: 'Algunas órdenes se reasignaron a un turno diferente.',
        CONCURRENT_CHANGES: 'Se detectaron cambios concurrentes. Revisa las órdenes recientes.',
    };

    for (const warning of userWarnings) {
        toast.warning(messages[warning.code] || warning.message, {
            duration: 8000,
        });
    }
}

/**
 * Notify that offline orders are being retried
 */
export function notifyRetrying(attempt: number, maxRetries: number) {
    toast.info(`Reintentando sincronización (${attempt}/${maxRetries})...`, {
        duration: 3000,
    });
}
