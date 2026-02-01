/**
 * @fileoverview QR Menu Service
 * Handles QR code generation, validation, and menu configuration
 * 
 * @module services/qr.service
 */

import { prisma } from '../lib/prisma';
import { nanoid } from 'nanoid';
import { NotFoundError } from '../utils/errors';

export interface QrMenuConfig {
    enabled: boolean;
    mode: 'INTERACTIVE' | 'STATIC';
    selfOrderEnabled: boolean;
    pdfUrl: string | null;
    bannerUrl: string | null;
    theme: any;
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
    async updateConfig(tenantId: number, updates: Partial<{
        qrMenuEnabled: boolean;
        qrMenuMode: 'INTERACTIVE' | 'STATIC';
        qrSelfOrderEnabled: boolean;
        qrMenuPdfUrl: string | null;
        qrMenuBannerUrl: string | null;
        qrMenuTheme: any;
    }>): Promise<QrMenuConfig> {
        const existingconfig = await prisma.tenantConfig.findFirst({ where: { tenantId } });
        if (!existingconfig) throw new NotFoundError('Config not found');

        // SAFE: findFirst at L72 verifies tenant ownership before update
        const config = await prisma.tenantConfig.update({
            where: { id: existingconfig.id },
            data: updates
        });

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

        // Generate unique short code
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

        const qrTenantId = (qrCode as any).tenantId; // Cast as any if types not updated yet
        if (!qrTenantId) throw new Error('QR Code has no tenant associated');

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

        // SAFE: findFirst L221 verifies tenant ownership
        const updated = await prisma.qrCode.update({
            where: { id },
            data: { isActive: !current.isActive },
            include: { table: { select: { name: true } } }
        });

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
