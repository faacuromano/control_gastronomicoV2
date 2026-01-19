/**
 * @fileoverview Status Update Service
 *
 * Servicio para enviar actualizaciones de estado de pedidos a plataformas de delivery.
 *
 * Cuando el restaurante actualiza el estado de un pedido (ej: listo para recoger),
 * este servicio notifica a la plataforma correspondiente.
 *
 * @module integrations/delivery/sync/statusUpdate.service
 */
import { type StatusUpdateResult } from '../types/normalized.types';
declare class StatusUpdateService {
    /**
     * Notifica a la plataforma externa sobre un cambio de estado.
     *
     * @param orderId - ID del pedido interno
     * @param newStatus - Nuevo estado interno
     * @returns Resultado de la actualización
     */
    notifyStatusChange(orderId: number, newStatus: string): Promise<StatusUpdateResult | null>;
    /**
     * Marca un pedido como listo para recoger y notifica a la plataforma.
     */
    markAsReady(orderId: number): Promise<StatusUpdateResult | null>;
    /**
     * Marca un pedido como en preparación y notifica a la plataforma.
     */
    markAsInPreparation(orderId: number): Promise<StatusUpdateResult | null>;
    /**
     * Cancela un pedido y notifica a la plataforma.
     */
    cancelOrder(orderId: number, reason?: string): Promise<StatusUpdateResult | null>;
}
export declare const statusUpdateService: StatusUpdateService;
export {};
//# sourceMappingURL=statusUpdate.service.d.ts.map