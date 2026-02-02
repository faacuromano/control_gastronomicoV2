/**
 * @fileoverview Indice del Modulo de Sincronizacion de Delivery
 *
 * Exporta los tres servicios de sincronizacion que mantienen alineado
 * el estado del sistema interno con las plataformas de delivery externas:
 * - menuSyncService: Sincronizacion del menu y precios
 * - stockSyncService: Sincronizacion de disponibilidad de productos
 * - statusUpdateService: Envio de actualizaciones de estado de pedidos
 *
 * @module integrations/delivery/sync
 */

export { menuSyncService } from './menuSync.service';
export { stockSyncService } from './stockSync.service';
export { statusUpdateService } from './statusUpdate.service';
