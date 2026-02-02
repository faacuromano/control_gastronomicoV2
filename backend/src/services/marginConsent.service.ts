/**
 * @fileoverview Margin Consent Service (Safety Lock Protocol)
 *
 * Implements the margin consent protocol for delivery platforms.
 * The user MUST explicitly accept the risk of using base prices before activating
 * fallback pricing on any platform.
 *
 * RATIONALE:
 * - Rappi/Glovo charge 20-30% commission
 * - If the restaurant uploads prices without adjusting, it loses money on each sale
 * - This service acts as a legal "Safety Lock" to protect the business
 *
 * @module services/marginConsent.service
 */

import { prisma } from '../lib/prisma';
import { BadRequestError, NotFoundError } from '../utils/errors';
import type { DeliveryPlatform, TenantPlatformConfig } from '@prisma/client';

// ============================================================================
// CONSTANTS AND TYPES
// ============================================================================

/**
 * Error message when attempting to activate without consent.
 * Displayed in the frontend as a warning modal.
 */
const MARGIN_CONSENT_REQUIRED_MESSAGE =
  'To activate automatic pricing you must accept the margin risk. ' +
  'Using base prices without adjustment may result in loss of money due to platform commissions.';

/**
 * Input for accepting margin consent.
 */
export interface MarginConsentInput {
  platformId: number;
  userId: number;
  explicitConsent: boolean;  // MUST be true
  defaultMarkup?: number;    // Suggested markup (e.g., 25 = +25%)
}

/**
 * Input for enabling/disabling a platform.
 */
export interface TogglePlatformInput {
  platformId: number;
  enable: boolean;
  useFallbackPricing?: boolean;  // Whether to use fallback
  consentToken?: string;         // Prior consent token
  userId: number;
}

/**
 * Result of the Safety Lock verification.
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
// MAIN SERVICE
// ============================================================================

class MarginConsentService {

  /**
   * Check the Safety Lock status for a platform.
   *
   * The Safety Lock is BLOCKED if:
   * 1. useFallbackPricing = true (wants to use base prices)
   * 2. marginConsentAcceptedAt = null (no consent given)
   *
   * @returns Detailed lock status
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
    
    // Lock is active if wants fallback BUT has no consent
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
   * Record the user's explicit consent.
   *
   * LEGAL REQUIREMENTS:
   * - explicitConsent MUST be true (user checked the checkbox)
   * - Timestamp and userId recorded for auditing
   *
   * @throws BadRequestError if explicitConsent !== true
   */
  async acceptMarginConsent(tenantId: number, input: MarginConsentInput): Promise<TenantPlatformConfig> {
    const { platformId, userId, explicitConsent, defaultMarkup } = input;

    // STRICT VALIDATION: Consent must be explicit
    if (explicitConsent !== true) {
      throw new BadRequestError(
        'Consent must be explicit. ' +
        'User must check the acceptance checkbox.'
      );
    }

    // BIZ-013: Validate markup range (0-200% is reasonable for delivery platforms)
    if (defaultMarkup !== undefined && defaultMarkup !== null) {
      if (defaultMarkup < 0 || defaultMarkup > 200) {
        throw new BadRequestError(
          `Invalid markup: ${defaultMarkup}%. Must be between 0% and 200%.`
        );
      }
    }

    // Record consent with timestamp and user
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
        useFallbackPricing: true,  // Activate fallback on acceptance
      }
    });
  }

  /**
   * Revoke margin consent.
   * This automatically deactivates fallback pricing.
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
        useFallbackPricing: false,  // Automatically deactivate fallback
      }
    });
  }

  /**
   * Enable or disable a platform with Safety Lock validation.
   *
   * PROTOCOL:
   * 1. If enable=true AND useFallbackPricing=true → Requires prior consent
   * 2. If no consent → Throw 400 Bad Request
   * 3. Frontend must show warning modal before calling
   *
   * @throws BadRequestError if the Safety Lock is blocked
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

    // If disabling, no restrictions
    if (!enable) {
      return prisma.tenantPlatformConfig.update({
        where: { id: config.id },
        data: { isActive: false }
      });
    }

    // If enabling WITH fallback pricing, verify Safety Lock
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
   * Calculate the effective price for a product on a platform.
   *
   * PRICING STRATEGY (Smart Fallback):
   * 1. If ProductChannelPrice exists → Use that specific price
   * 2. If NOT exists AND useFallbackPricing = true → Base price × (1 + defaultMarkup%)
   * 3. If NOT exists AND useFallbackPricing = false → Base price (with warning)
   *
   * @returns Calculated price with source metadata
   */
  async getEffectivePrice(
    productId: number, 
    platformId: number | null,
    tenantId: number | null = null
  ): Promise<{ price: number; source: 'channel' | 'fallback' | 'base'; markup?: number }> {
    // LOCAL order → product base price
    if (platformId === null) {
      const product = await prisma.product.findFirst({
        where: { id: productId, ...(tenantId ? { tenantId } : {}) },
        select: { price: true }
      });
      if (!product) throw new NotFoundError(`Product ${productId} not found`);
      return { price: Number(product.price), source: 'base' };
    }

    // Search for channel-specific price
    const channelPrice = await prisma.productChannelPrice.findUnique({
      where: { 
        productId_deliveryPlatformId: { productId, deliveryPlatformId: platformId }
      }
    });

    if (channelPrice) {
      return { price: Number(channelPrice.price), source: 'channel' };
    }

    // No specific price → Evaluate fallback
    // We need to know if the platform (for this tenant) has fallback enabled

    // If no tenantId (legacy case or error), assume no fallback
    if (!tenantId) {
        // Fallback to safe behavior: base price
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
    // If no config, act as if no fallback
    
    const basePrice = Number(product.price);

    // If fallback pricing is active, apply markup
    if (config?.useFallbackPricing && config.defaultMarkup) {
      const markup = Number(config.defaultMarkup) / 100;  // 25 → 0.25
      const adjustedPrice = basePrice * (1 + markup);
      // Round to 2 decimals for financial precision
      const finalPrice = Math.round(adjustedPrice * 100) / 100;
      return { 
        price: finalPrice, 
        source: 'fallback',
        markup: Number(config.defaultMarkup)
      };
    }

    // No fallback → use base price (potentially at a loss)
    return { price: basePrice, source: 'base' };
  }
}

export const marginConsentService = new MarginConsentService();
