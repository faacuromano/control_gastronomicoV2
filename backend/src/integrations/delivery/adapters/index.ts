/**
 * @fileoverview Exportaciones del Modulo de Adaptadores de Delivery
 *
 * Punto de entrada centralizado para el sistema de adaptadores.
 * Exporta la clase base abstracta, la factory y los tipos necesarios
 * para que el resto del sistema interactue con las plataformas de delivery.
 *
 * @module integrations/delivery/adapters
 */

// Clase base abstracta que define el contrato de todos los adaptadores
export { AbstractDeliveryAdapter } from './AbstractDeliveryAdapter';
export type { AdapterConfig, RequestContext } from './AbstractDeliveryAdapter';

// Factory para obtener el adaptador correcto segun la plataforma
export { AdapterFactory, RappiAdapter } from './AdapterFactory';

// Re-exportar todos los tipos normalizados compartidos
export * from '../types/normalized.types';
