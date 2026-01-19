/**
 * @fileoverview Connectivity detection hook and helpers
 * Provides real-time online/offline status
 * 
 * @module lib/connectivity
 */

import { useState, useEffect } from 'react';

/**
 * Hook to detect online/offline status
 * Updates reactively when connectivity changes
 */
export function useOnlineStatus(): boolean {
    const [isOnline, setIsOnline] = useState<boolean>(
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            console.log('[Connectivity] Online');
        };

        const handleOffline = () => {
            setIsOnline(false);
            console.log('[Connectivity] Offline');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
}

/**
 * Check if currently online (one-time check)
 */
export function isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Wait for online status with timeout
 * @param timeoutMs Maximum time to wait
 * @returns Promise that resolves when online or rejects on timeout
 */
export function waitForOnline(timeoutMs: number = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
        if (navigator.onLine) {
            resolve();
            return;
        }

        const timeout = setTimeout(() => {
            window.removeEventListener('online', handleOnline);
            reject(new Error('Timeout waiting for online status'));
        }, timeoutMs);

        const handleOnline = () => {
            clearTimeout(timeout);
            window.removeEventListener('online', handleOnline);
            resolve();
        };

        window.addEventListener('online', handleOnline);
    });
}
