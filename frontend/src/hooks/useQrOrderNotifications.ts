/**
 * @fileoverview Hook para notificaciones de pedidos QR
 * Escucha eventos de pedidos realizados desde el menú QR y muestra
 * notificaciones toast a los meseros.
 *
 * Uso:
 * ```tsx
 * // En el layout del mesero o página de mesas
 * useQrOrderNotifications();
 * ```
 */

import { useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { toast } from 'sonner';

/**
 * Payload del evento waiter:qr_order_placed
 */
export interface QrOrderPlacedEvent {
    orderId: number;
    orderNumber: number;
    tableId: number;
    tableName: string;
    itemCount: number;
    total: number;
    timestamp: Date;
}

/**
 * Opciones para el hook
 */
export interface UseQrOrderNotificationsOptions {
    /** Reproducir sonido al recibir notificación (default: true) */
    playSound?: boolean;
    /** Callback opcional cuando se recibe un pedido */
    onOrderReceived?: (event: QrOrderPlacedEvent) => void;
}

/**
 * Hook que escucha notificaciones de pedidos QR y muestra toasts a los meseros.
 * Automáticamente se une al room de meseros y escucha el evento waiter:qr_order_placed.
 *
 * @param options - Opciones de configuración
 */
export function useQrOrderNotifications(options: UseQrOrderNotificationsOptions = {}) {
    const { socket, isConnected } = useSocket();
    const { playSound = true, onOrderReceived } = options;

    const playNotificationSound = useCallback(() => {
        if (!playSound) return;
        try {
            const audio = new Audio('/sounds/notification.mp3');
            audio.play().catch(() => {
                // Fallback: intentar con bell.mp3 si notification.mp3 no existe
                const fallbackAudio = new Audio('/sounds/bell.mp3');
                fallbackAudio.play().catch(e => console.log('Audio autoplay blocked', e));
            });
        } catch {
            // Audio no disponible
        }
    }, [playSound]);

    useEffect(() => {
        if (!socket || !isConnected) return;

        // Unirse al room de meseros
        socket.emit('join:waiters');

        // Handler para pedidos QR
        const handleQrOrder = (event: QrOrderPlacedEvent) => {
            // Reproducir sonido
            playNotificationSound();

            // Mostrar toast con información del pedido
            toast.info(`Nuevo pedido QR - Mesa ${event.tableName}`, {
                description: `${event.itemCount} items • $${event.total.toFixed(0)} • Pedido #${event.orderNumber}`,
                duration: 10000, // 10 segundos para dar tiempo a leer
                action: {
                    label: 'Ver',
                    onClick: () => {
                        // Opcional: navegar a detalle de mesa
                        // navigate(`/tables/${event.tableId}`);
                    }
                }
            });

            // Callback opcional
            if (onOrderReceived) {
                onOrderReceived(event);
            }
        };

        socket.on('waiter:qr_order_placed', handleQrOrder);

        return () => {
            socket.off('waiter:qr_order_placed', handleQrOrder);
        };
    }, [socket, isConnected, playNotificationSound, onOrderReceived]);

    return { isConnected };
}

export default useQrOrderNotifications;
