import type { OrderResponse } from './orderService';

/**
 * Extended OrderResponse with delivery-specific fields.
 * Used in DeliveryDashboard to provide type safety for nullable relations.
 * 
 * FIX NL-002: Replaces 'as any' cast with proper typing.
 */
export interface OrderWithDeliveryDetails extends OrderResponse {
  deliveryAddress?: string | null;
  deliveryNotes?: string | null;
  driverId?: number | null;
  driver?: {
    id: number;
    name: string;
    phone?: string | null;
  } | null;
  client?: {
    id: number;
    name: string;
    phone?: string | null;
    address?: string | null;
  } | null;
}
