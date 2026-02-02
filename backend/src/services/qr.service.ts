/**
 * @fileoverview QR Menu Service
 * Handles QR code generation, validation, and menu configuration
 * 
 * @module services/qr.service
 */

import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { nanoid } from 'nanoid';
import { NotFoundError, ConflictError } from '../utils/errors';

export interface QrMenuConfig {
    enabled: boolean;
    mode: 'INTERACTIVE' | 'STATIC';
    selfOrderEnabled: boolean;
    pdfUrl: string | null;
    bannerUrl: string | null;
    theme: Prisma.JsonValue;
    businessName: string;
}

export interface QrCodeData {
    id: number;
    code: string;
    tableId: number | null;
    tableName: string | null;
    isActive: boolean;
    scansCount: number;
    lastScannedAt: Date | null;
    createdAt: Date;
}

export class QrService {
    /**
     * Get QR menu configuration for public display
     * Includes check for global enableDigital flag
     */
    async getConfig(tenantId: number): Promise<QrMenuConfig> {
        const config = await prisma.tenantConfig.findFirst({
            where: { tenantId }
        });
        
        if (!config) {
            throw new NotFoundError('Configuration not found');
        }

        // If the global Digital/QR module is disabled, override qrMenuEnabled to false
        const effectiveEnabled = config.enableDigital && config.qrMenuEnabled;

        return {
            enabled: effectiveEnabled,
            mode: config.qrMenuMode,
            selfOrderEnabled: config.qrSelfOrderEnabled,
            pdfUrl: config.qrMenuPdfUrl,
            bannerUrl: config.qrMenuBannerUrl,
            theme: config.qrMenuTheme,
            businessName: config.businessName
        };
    }

    /**
     * Update QR menu configuration
     */
    async updateConfig(tenantId: number, updates: Prisma.TenantConfigUpdateManyMutationInput): Promise<QrMenuConfig> {
        // SEC-035: Use updateMany with tenantId for defense-in-depth
        const existingConfig = await prisma.tenantConfig.findFirst({ where: { tenantId } });
        if (!existingConfig) throw new NotFoundError('Config not found');

        await prisma.tenantConfig.updateMany({
            where: { id: existingConfig.id, tenantId },
            data: updates
        });

        // Re-fetch to get updated config
        const config = await prisma.tenantConfig.findFirst({ where: { tenantId } });
        if (!config) throw new NotFoundError('Config not found');

        return {
            enabled: config.qrMenuEnabled,
            mode: config.qrMenuMode,
            selfOrderEnabled: config.qrSelfOrderEnabled,
            pdfUrl: config.qrMenuPdfUrl,
            bannerUrl: config.qrMenuBannerUrl,
            theme: config.qrMenuTheme,
            businessName: config.businessName
        };
    }

    /**
     * Generate a new QR code
     * @param tableId - Optional table ID (null for generic QR)
     */
    async generateQrCode(tenantId: number, tableId?: number): Promise<QrCodeData> {
        // Validate table ownership if provided
        if (tableId) {
            const table = await prisma.table.findFirst({ where: { id: tableId, tenantId } });
            if (!table) throw new NotFoundError('Table not found or access denied');
        }

        // ERR-009: Retry on unique constraint collision (birthday paradox with short codes)
        const MAX_RETRIES = 3;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                const code = nanoid(8);

                const qrCode = await prisma.qrCode.create({
                    data: {
                        tenantId,
                        code,
                        tableId: tableId || null
                    },
                    include: {
                        table: { select: { name: true } }
                    }
                });

                return {
                    id: qrCode.id,
                    code: qrCode.code,
                    tableId: qrCode.tableId,
                    tableName: qrCode.table?.name || null,
                    isActive: qrCode.isActive,
                    scansCount: qrCode.scansCount,
                    lastScannedAt: qrCode.lastScannedAt,
                    createdAt: qrCode.createdAt
                };
            } catch (error: unknown) {
                // P2002 = unique constraint violation - retry with new code
                if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && attempt < MAX_RETRIES - 1) {
                    continue;
                }
                throw error;
            }
        }
        throw new ConflictError('Failed to generate unique QR code after multiple attempts');
    }

    /**
     * Get all QR codes
     */
    async getAllQrCodes(tenantId: number): Promise<QrCodeData[]> {
        const qrCodes = await prisma.qrCode.findMany({
            where: { tenantId },
            include: {
                table: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        return qrCodes.map(qr => ({
            id: qr.id,
            code: qr.code,
            tableId: qr.tableId,
            tableName: qr.table?.name || null,
            isActive: qr.isActive,
            scansCount: qr.scansCount,
            lastScannedAt: qr.lastScannedAt,
            createdAt: qr.createdAt
        }));
    }

    /**
     * Validate QR code and get associated data (public endpoint)
     * Also increments scan count
     * Respects global enableDigital flag
     */
    async validateAndScan(code: string): Promise<{
        valid: boolean;
        tableId: number | null;
        tableName: string | null;
        config: QrMenuConfig;
        tenantId: number;
    }> {
        // Fetch QR Code first to identify tenant
        const qrCode = await prisma.qrCode.findUnique({
            where: { code },
            include: {
                table: { select: { id: true, name: true } }
            }
        });

        if (!qrCode || !qrCode.isActive) {
            throw new NotFoundError('QR code not found or inactive');
        }

        const qrTenantId = qrCode.tenantId;
        if (!qrTenantId) throw new NotFoundError('QR Code has no tenant associated');

        // Check if the global module is enabled FOR THIS TENANT
        const tenantConfig = await prisma.tenantConfig.findFirst({ where: { tenantId: qrTenantId } });
        if (!tenantConfig?.enableDigital) {
            throw new NotFoundError('Digital menu module is disabled');
        }

        // Increment scan count
        await prisma.qrCode.updateMany({
            where: { id: qrCode.id, tenantId: qrTenantId },
            data: {
                scansCount: { increment: 1 },
                lastScannedAt: new Date()
            }
        });

        const config = await this.getConfig(qrTenantId);

        return {
            valid: true,
            tableId: qrCode.tableId,
            tableName: qrCode.table?.name || null,
            config,
            tenantId: qrTenantId
        };
    }

    /**
     * Delete a QR code
     */
    async deleteQrCode(id: number, tenantId: number): Promise<void> {
        const exists = await prisma.qrCode.findFirst({ where: { id, tenantId } });
        if (!exists) throw new NotFoundError('QR code not found');

        await prisma.qrCode.deleteMany({
            where: { id, tenantId }
        });
    }

    /**
     * Toggle QR code active status
     */
    async toggleQrCode(id: number, tenantId: number): Promise<QrCodeData> {
        const current = await prisma.qrCode.findFirst({ where: { id, tenantId } });
        if (!current) {
            throw new NotFoundError('QR code not found');
        }

        // SEC-034: Use updateMany with tenantId for defense-in-depth
        await prisma.qrCode.updateMany({
            where: { id, tenantId },
            data: { isActive: !current.isActive }
        });

        // Re-fetch to get full data with relations
        const updated = await prisma.qrCode.findFirst({
            where: { id, tenantId },
            include: { table: { select: { name: true } } }
        });

        if (!updated) throw new NotFoundError('QR code not found');

        return {
            id: updated.id,
            code: updated.code,
            tableId: updated.tableId,
            tableName: updated.table?.name || null,
            isActive: updated.isActive,
            scansCount: updated.scansCount,
            lastScannedAt: updated.lastScannedAt,
            createdAt: updated.createdAt
        };
    }

    /**
     * Get public menu data (products, categories)
     * Used for INTERACTIVE mode
     */
    async getPublicMenu(tenantId: number) {
        const [categories, products] = await Promise.all([
            prisma.category.findMany({
                where: { tenantId },
                orderBy: { name: 'asc' }
            }),
            prisma.product.findMany({
                where: { isActive: true, tenantId },
                include: {
                    category: { select: { id: true, name: true } }
                },
                orderBy: { name: 'asc' }
            })
        ]);

        return { categories, products };
    }
}

export const qrService = new QrService();
