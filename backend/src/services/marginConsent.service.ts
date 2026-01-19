/**
 * @fileoverview Margin Consent Service (Safety Lock Protocol)
 * 
 * Implementa el protocolo de consentimiento de margen para plataformas de delivery.
 * El usuario DEBE aceptar explícitamente el riesgo de usar precios base antes de activar
 * fallback pricing en cualquier plataforma.
 * 
 * RATIONALE:
 * - Rappi/Glovo cobran 20-30% de comisión
 * - Si el restaurante sube precios sin ajustar, pierde dinero en cada venta
 * - Este servicio actúa como "Safety Lock" legal para proteger al negocio
 * 
 * @module services/marginConsent.service
 */

import { prisma } from '../lib/prisma';
import { BadRequestError, NotFoundError } from '../utils/errors';
import type { DeliveryPlatform } from '@prisma/client';

// ============================================================================
// CONSTANTES Y TIPOS
// ============================================================================

/**
 * Mensaje de error cuando se intenta activar sin consentimiento.
 * Este mensaje será mostrado en el frontend como modal de advertencia.
 */
const MARGIN_CONSENT_REQUIRED_MESSAGE = 
  'Para activar el pricing automático debe aceptar el riesgo de margen. ' +
  'Usar precios base sin ajuste puede resultar en pérdida de dinero por comisiones de la plataforma.';

/**
 * Input para aceptar consentimiento de margen.
 */
export interface MarginConsentInput {
  platformId: number;
  userId: number;
  explicitConsent: boolean;  // DEBE ser true
  defaultMarkup?: number;    // Markup sugerido (ej: 25 = +25%)
}

/**
 * Input para activar/desactivar una plataforma.
 */
export interface TogglePlatformInput {
  platformId: number;
  enable: boolean;
  useFallbackPricing?: boolean;  // Si quiere usar fallback
  consentToken?: string;         // Token de consentimiento previo
  userId: number;
}

/**
 * Resultado de la verificación del Safety Lock.
 */
export interface SafetyLockStatus {
  isLocked: boolean;
  requiresConsent: boolean;
  hasConsentRecord: boolean;
  consentDate?: Date | undefined;
  consentBy?: number | undefined;
  defaultMarkup?: number | undefined;
  message?: string | undefined;
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

class MarginConsentService {
  
  /**
   * Verifica el estado del Safety Lock para una plataforma.
   * 
   * El Safety Lock está BLOQUEADO si:
   * 1. useFallbackPricing = true (quiere usar precios base)
   * 2. marginConsentAcceptedAt = null (no hay consentimiento)
   * 
   * @returns Estado detallado del lock
   */
  async getSafetyLockStatus(platformId: number): Promise<SafetyLockStatus> {
    const platform = await prisma.deliveryPlatform.findUnique({
      where: { id: platformId },
      select: {
        id: true,
        useFallbackPricing: true,
        marginConsentAcceptedAt: true,
        marginConsentAcceptedBy: true,
        defaultMarkup: true,
      }
    });

    if (!platform) {
      throw new NotFoundError(`Plataforma ${platformId} no encontrada`);
    }

    const hasConsentRecord = platform.marginConsentAcceptedAt !== null;
    
    // El lock está activo si quiere usar fallback PERO no tiene consentimiento
    const isLocked = platform.useFallbackPricing && !hasConsentRecord;
    
    return {
      isLocked,
      requiresConsent: platform.useFallbackPricing,
      hasConsentRecord,
      consentDate: platform.marginConsentAcceptedAt ?? undefined,
      consentBy: platform.marginConsentAcceptedBy ?? undefined,
      defaultMarkup: platform.defaultMarkup ? Number(platform.defaultMarkup) : undefined,
      message: isLocked ? MARGIN_CONSENT_REQUIRED_MESSAGE : undefined,
    };
  }

  /**
   * Registra el consentimiento explícito del usuario.
   * 
   * REQUISITOS LEGALES:
   * - explicitConsent DEBE ser true (el usuario marcó el checkbox)
   * - Se registra timestamp y userId para auditoría
   * 
   * @throws BadRequestError si explicitConsent !== true
   */
  async acceptMarginConsent(input: MarginConsentInput): Promise<DeliveryPlatform> {
    const { platformId, userId, explicitConsent, defaultMarkup } = input;

    // VALIDACIÓN ESTRICTA: El consentimiento debe ser explícito
    if (explicitConsent !== true) {
      throw new BadRequestError(
        'El consentimiento debe ser explícito. ' +
        'El usuario debe marcar la casilla de aceptación.'
      );
    }

    const platform = await prisma.deliveryPlatform.findUnique({
      where: { id: platformId }
    });

    if (!platform) {
      throw new NotFoundError(`Plataforma ${platformId} no encontrada`);
    }

    // Registrar consentimiento con timestamp y usuario
    return prisma.deliveryPlatform.update({
      where: { id: platformId },
      data: {
        marginConsentAcceptedAt: new Date(),
        marginConsentAcceptedBy: userId,
        defaultMarkup: defaultMarkup ?? null,
        useFallbackPricing: true,  // Activar fallback al aceptar
      }
    });
  }

  /**
   * Revoca el consentimiento de margen.
   * Esto desactiva el fallback pricing automáticamente.
   */
  async revokeMarginConsent(platformId: number): Promise<DeliveryPlatform> {
    const platform = await prisma.deliveryPlatform.findUnique({
      where: { id: platformId }
    });

    if (!platform) {
      throw new NotFoundError(`Plataforma ${platformId} no encontrada`);
    }

    return prisma.deliveryPlatform.update({
      where: { id: platformId },
      data: {
        marginConsentAcceptedAt: null,
        marginConsentAcceptedBy: null,
        useFallbackPricing: false,  // Desactivar fallback automáticamente
      }
    });
  }

  /**
   * Activa o desactiva una plataforma con validación del Safety Lock.
   * 
   * PROTOCOLO:
   * 1. Si enable=true Y useFallbackPricing=true → Requiere consentimiento previo
   * 2. Si no hay consentimiento → Lanzar 400 Bad Request
   * 3. El frontend debe mostrar "Modal de Muerte" antes de llamar
   * 
   * @throws BadRequestError si el Safety Lock está bloqueado
   */
  async togglePlatformWithSafetyCheck(input: TogglePlatformInput): Promise<DeliveryPlatform> {
    const { platformId, enable, useFallbackPricing, userId } = input;

    const platform = await prisma.deliveryPlatform.findUnique({
      where: { id: platformId }
    });

    if (!platform) {
      throw new NotFoundError(`Plataforma ${platformId} no encontrada`);
    }

    // Si está deshabilitando, no hay restricciones
    if (!enable) {
      return prisma.deliveryPlatform.update({
        where: { id: platformId },
        data: { isEnabled: false }
      });
    }

    // Si está habilitando CON fallback pricing, verificar Safety Lock
    const willUseFallback = useFallbackPricing ?? platform.useFallbackPricing;
    
    if (willUseFallback && !platform.marginConsentAcceptedAt) {
      throw new BadRequestError(
        MARGIN_CONSENT_REQUIRED_MESSAGE +
        ' Llame primero a POST /delivery/platforms/:id/accept-margin-consent'
      );
    }

    return prisma.deliveryPlatform.update({
      where: { id: platformId },
      data: {
        isEnabled: true,
        useFallbackPricing: willUseFallback,
      }
    });
  }

  /**
   * Calcula el precio efectivo para un producto en una plataforma.
   * 
   * ESTRATEGIA DE PRECIO (Smart Fallback):
   * 1. Si existe ProductChannelPrice → Usar ese precio específico
   * 2. Si NO existe Y useFallbackPricing = true → Precio base × (1 + defaultMarkup%)
   * 3. Si NO existe Y useFallbackPricing = false → Precio base (con advertencia)
   * 
   * @returns Precio calculado con metadata de origen
   */
  async getEffectivePrice(
    productId: number, 
    platformId: number | null
  ): Promise<{ price: number; source: 'channel' | 'fallback' | 'base'; markup?: number }> {
    // Pedido LOCAL → precio base del producto
    if (platformId === null) {
      const product = await prisma.product.findUnique({ 
        where: { id: productId },
        select: { price: true }
      });
      if (!product) throw new NotFoundError(`Producto ${productId} no encontrado`);
      return { price: Number(product.price), source: 'base' };
    }

    // Buscar precio específico del canal
    const channelPrice = await prisma.productChannelPrice.findUnique({
      where: { 
        productId_deliveryPlatformId: { productId, deliveryPlatformId: platformId }
      }
    });

    if (channelPrice) {
      return { price: Number(channelPrice.price), source: 'channel' };
    }

    // No hay precio específico → Evaluar fallback
    const [product, platform] = await Promise.all([
      prisma.product.findUnique({ 
        where: { id: productId },
        select: { price: true }
      }),
      prisma.deliveryPlatform.findUnique({
        where: { id: platformId },
        select: { useFallbackPricing: true, defaultMarkup: true }
      })
    ]);

    if (!product) throw new NotFoundError(`Producto ${productId} no encontrado`);
    if (!platform) throw new NotFoundError(`Plataforma ${platformId} no encontrada`);

    const basePrice = Number(product.price);

    // Si tiene fallback pricing activado, aplicar markup
    if (platform.useFallbackPricing && platform.defaultMarkup) {
      const markup = Number(platform.defaultMarkup) / 100;  // 25 → 0.25
      const adjustedPrice = basePrice * (1 + markup);
      // Redondear a 2 decimales para precisión financiera
      const finalPrice = Math.round(adjustedPrice * 100) / 100;
      return { 
        price: finalPrice, 
        source: 'fallback',
        markup: Number(platform.defaultMarkup)
      };
    }

    // Sin fallback → usar precio base (potencialmente con pérdida)
    return { price: basePrice, source: 'base' };
  }
}

export const marginConsentService = new MarginConsentService();
