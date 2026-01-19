/**
 * @fileoverview Delivery Adapters Module Exports
 * 
 * Punto de entrada para el sistema de adapters de delivery.
 * 
 * @module integrations/delivery/adapters
 */

// Abstract base
export { AbstractDeliveryAdapter } from './AbstractDeliveryAdapter';
export type { AdapterConfig, RequestContext } from './AbstractDeliveryAdapter';

// Factory
export { AdapterFactory, RappiAdapter } from './AdapterFactory';

// Re-export types
export * from '../types/normalized.types';
