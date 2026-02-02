/**
 * @fileoverview Servicio de Consentimiento de Margen (Protocolo de Bloqueo de Seguridad)
 *
 * Implementa el protocolo de consentimiento de margen para plataformas de delivery.
 * El usuario DEBE aceptar explicitamente el riesgo de usar precios base antes de
 * activar la fijacion de precios fallback en cualquier plataforma.
 *
 * JUSTIFICACION:
 * - Rappi/Glovo cobran comisiones del 20-30%
 * - Si el restaurante sube precios sin ajustar, pierde dinero en cada venta
 * - Este servicio actua como un "Bloqueo de Seguridad" legal para proteger al negocio
 *
 * ESTRATEGIA DE PRECIOS (Smart Fallback):
 * 1. Si existe ProductChannelPrice -> Usar ese precio especifico por plataforma
 * 2. Si NO existe Y useFallbackPricing = true -> Precio base x (1 + markup%)
 * 3. Si NO existe Y useFallbackPricing = false -> Precio base (con advertencia de posible perdida)
 *
 * @module services/marginConsent.service
 */

import { prisma } from '../lib/prisma';
import { BadRequestError, NotFoundError } from '../utils/errors';
import type { DeliveryPlatform, TenantPlatformConfig } from '@prisma/client';

// ============================================================================
// CONSTANTES Y TIPOS
// ============================================================================

/**
 * Mensaje de error cuando se intenta activar sin consentimiento previo.
 * Se muestra en el frontend como un modal de advertencia.
 */
const MARGIN_CONSENT_REQUIRED_MESSAGE =
  'To activate automatic pricing you must accept the margin risk. ' +
  'Using base prices without adjustment may result in loss of money due to platform commissions.';

/**
 * Entrada para aceptar el consentimiento de margen.
 */
export interface MarginConsentInput {
  platformId: number;
  userId: number;
  explicitConsent: boolean;  // DEBE ser true para proceder
  defaultMarkup?: number;    // Markup sugerido (ej: 25 = +25%)
}

/**
 * Entrada para habilitar/deshabilitar una plataforma.
 */
export interface TogglePlatformInput {
  platformId: number;
  enable: boolean;
  useFallbackPricing?: boolean;  // Si se debe usar pricing fallback
  consentToken?: string;         // Token de consentimiento previo
  userId: number;
}

/**
 * Resultado de la verificacion del Bloqueo de Seguridad.
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
   * Verifica el estado del Bloqueo de Seguridad para una plataforma.
   *
   * El bloqueo esta ACTIVO si:
   * 1. useFallbackPricing = true (quiere usar precios base con markup)
   * 2. marginConsentAcceptedAt = null (no se ha dado consentimiento)
   *
   * @returns Estado detallado del bloqueo
   */
  async getSafetyLockStatus(tenantId: number, platformId: number): Promise<SafetyLockStatus> {
    const config = await prisma.tenantPlatformConfig.findUnique({
      where: {
        tenantId_deliveryPlatformId: {
          tenantId,
          deliveryPlatformId: platformId
        }
      },
      select: {
        useFallbackPricing: true,
        marginConsentAcceptedAt: true,
        marginConsentAcceptedBy: true,
        defaultMarkup: true,
      }
    });

    if (!config) {
      throw new NotFoundError(`Platform configuration ${platformId} not found for tenant ${tenantId}`);
    }

    const hasConsentRecord = config.marginConsentAcceptedAt !== null;

    // El bloqueo esta activo si quiere fallback PERO no tiene consentimiento registrado
    const isLocked = config.useFallbackPricing && !hasConsentRecord;

    return {
      isLocked,
      requiresConsent: config.useFallbackPricing,
      hasConsentRecord,
      consentDate: config.marginConsentAcceptedAt ?? undefined,
      consentBy: config.marginConsentAcceptedBy ?? undefined,
      defaultMarkup: config.defaultMarkup ? Number(config.defaultMarkup) : undefined,
      message: isLocked ? MARGIN_CONSENT_REQUIRED_MESSAGE : undefined,
    };
  }

  /**
   * Registra el consentimiento explicito del usuario.
   *
   * REQUISITOS LEGALES:
   * - explicitConsent DEBE ser true (el usuario marco el checkbox)
   * - Se registra timestamp y userId para auditoria
   *
   * @throws BadRequestError si explicitConsent !== true
   */
  async acceptMarginConsent(tenantId: number, input: MarginConsentInput): Promise<TenantPlatformConfig> {
    const { platformId, userId, explicitConsent, defaultMarkup } = input;

    // VALIDACION ESTRICTA: El consentimiento debe ser explicito (checkbox marcado)
    if (explicitConsent !== true) {
      throw new BadRequestError(
        'Consent must be explicit. ' +
        'User must check the acceptance checkbox.'
      );
    }

    // BIZ-013: Validar rango de markup (0-200% es razonable para plataformas de delivery)
    if (defaultMarkup !== undefined && defaultMarkup !== null) {
      if (defaultMarkup < 0 || defaultMarkup > 200) {
        throw new BadRequestError(
          `Invalid markup: ${defaultMarkup}%. Must be between 0% and 200%.`
        );
      }
    }

    // Registrar consentimiento con timestamp y usuario para trazabilidad legal
    return prisma.tenantPlatformConfig.update({
        where: {
            tenantId_deliveryPlatformId: {
                tenantId,
                deliveryPlatformId: platformId
            }
        },
      data: {
        marginConsentAcceptedAt: new Date(),
        marginConsentAcceptedBy: userId,
        defaultMarkup: defaultMarkup ?? null,
        useFallbackPricing: true,  // Activar fallback automaticamente al aceptar
      }
    });
  }

  /**
   * Revoca el consentimiento de margen.
   * Esto desactiva automaticamente el pricing fallback como medida de seguridad.
   */
  async revokeMarginConsent(tenantId: number, platformId: number): Promise<TenantPlatformConfig> {
    return prisma.tenantPlatformConfig.update({
        where: {
            tenantId_deliveryPlatformId: {
                tenantId,
                deliveryPlatformId: platformId
            }
        },
      data: {
        marginConsentAcceptedAt: null,
        marginConsentAcceptedBy: null,
        useFallbackPricing: false,  // Desactivar fallback automaticamente al revocar
      }
    });
  }

  /**
   * Habilita o deshabilita una plataforma con validacion del Bloqueo de Seguridad.
   *
   * PROTOCOLO:
   * 1. Si enable=true Y useFallbackPricing=true -> Requiere consentimiento previo
   * 2. Si no hay consentimiento -> Lanza 400 Bad Request
   * 3. El frontend debe mostrar modal de advertencia antes de llamar
   *
   * @throws BadRequestError si el Bloqueo de Seguridad esta activo
   */
  async togglePlatformWithSafetyCheck(tenantId: number, input: TogglePlatformInput): Promise<TenantPlatformConfig> {
    const { platformId, enable, useFallbackPricing, userId } = input;

    const config = await prisma.tenantPlatformConfig.findUnique({
      where: {
        tenantId_deliveryPlatformId: {
            tenantId,
            deliveryPlatformId: platformId
        }
      }
    });

    if (!config) {
      throw new NotFoundError(`Platform configuration ${platformId} not found`);
    }

    // Si se deshabilita, no hay restricciones — se permite siempre
    if (!enable) {
      return prisma.tenantPlatformConfig.update({
        where: { id: config.id },
        data: { isActive: false }
      });
    }

    // Si se habilita CON pricing fallback, verificar el Bloqueo de Seguridad
    const willUseFallback = useFallbackPricing ?? config.useFallbackPricing;

    if (willUseFallback && !config.marginConsentAcceptedAt) {
      throw new BadRequestError(
        MARGIN_CONSENT_REQUIRED_MESSAGE +
        ' Call POST /delivery/platforms/:id/accept-margin-consent first'
      );
    }

    return prisma.tenantPlatformConfig.update({
      where: { id: config.id },
      data: {
        isActive: true,
        useFallbackPricing: willUseFallback,
      }
    });
  }

  /**
   * Calcula el precio efectivo de un producto en una plataforma.
   *
   * ESTRATEGIA DE PRECIOS (Smart Fallback):
   * 1. Si existe ProductChannelPrice -> Usar ese precio especifico por canal
   * 2. Si NO existe Y useFallbackPricing = true -> Precio base x (1 + markup%)
   * 3. Si NO existe Y useFallbackPricing = false -> Precio base (con advertencia)
   *
   * @returns Precio calculado con metadatos de origen (channel, fallback o base)
   */
  async getEffectivePrice(
    productId: number,
    platformId: number | null,
    tenantId: number | null = null
  ): Promise<{ price: number; source: 'channel' | 'fallback' | 'base'; markup?: number }> {
    // Orden LOCAL (sin plataforma) -> usar precio base del producto
    if (platformId === null) {
      const product = await prisma.product.findFirst({
        where: { id: productId, ...(tenantId ? { tenantId } : {}) },
        select: { price: true }
      });
      if (!product) throw new NotFoundError(`Product ${productId} not found`);
      return { price: Number(product.price), source: 'base' };
    }

    // Buscar precio especifico configurado para este canal/plataforma
    const channelPrice = await prisma.productChannelPrice.findUnique({
      where: {
        productId_deliveryPlatformId: { productId, deliveryPlatformId: platformId }
      }
    });

    if (channelPrice) {
      return { price: Number(channelPrice.price), source: 'channel' };
    }

    // No hay precio especifico -> evaluar fallback con markup automatico
    // Necesitamos saber si la plataforma (para este tenant) tiene fallback habilitado

    // Si no hay tenantId (caso legacy o error), asumir comportamiento seguro: precio base
    if (!tenantId) {
        // Fallback a comportamiento seguro: precio base sin markup
        const product = await prisma.product.findFirst({
            where: { id: productId },
            select: { price: true }
          });
        return { price: Number(product?.price || 0), source: 'base' };
    }

    const [product, config] = await Promise.all([
      prisma.product.findFirst({
        where: { id: productId, tenantId },
        select: { price: true }
      }),
      prisma.tenantPlatformConfig.findUnique({
        where: {
            tenantId_deliveryPlatformId: {
                tenantId,
                deliveryPlatformId: platformId
            }
        },
        select: { useFallbackPricing: true, defaultMarkup: true }
      })
    ]);

    if (!product) throw new NotFoundError(`Product ${productId} not found`);
    // Si no existe configuracion de plataforma, actuar como si no hubiera fallback

    const basePrice = Number(product.price);

    // Si el pricing fallback esta activo, aplicar el markup configurado
    if (config?.useFallbackPricing && config.defaultMarkup) {
      const markup = Number(config.defaultMarkup) / 100;  // 25 -> 0.25
      const adjustedPrice = basePrice * (1 + markup);
      // Redondear a 2 decimales para precision financiera
      const finalPrice = Math.round(adjustedPrice * 100) / 100;
      return {
        price: finalPrice,
        source: 'fallback',
        markup: Number(config.defaultMarkup)
      };
    }

    // Sin fallback -> usar precio base (potencialmente con perdida por comision)
    return { price: basePrice, source: 'base' };
  }
}

export const marginConsentService = new MarginConsentService();
