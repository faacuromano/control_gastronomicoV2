"use strict";
/**
 * @fileoverview QR Menu Service
 * Handles QR code generation, validation, and menu configuration
 *
 * @module services/qr.service
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.qrService = exports.QrService = void 0;
const prisma_1 = require("../lib/prisma");
const nanoid_1 = require("nanoid");
const errors_1 = require("../utils/errors");
class QrService {
    /**
     * Get QR menu configuration for public display
     * Includes check for global enableDigital flag
     */
    async getConfig() {
        const config = await prisma_1.prisma.tenantConfig.findFirst();
        if (!config) {
            throw new errors_1.NotFoundError('Configuration not found');
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
    async updateConfig(updates) {
        const config = await prisma_1.prisma.tenantConfig.update({
            where: { id: 1 },
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
    async generateQrCode(tableId) {
        // Generate unique short code
        const code = (0, nanoid_1.nanoid)(8);
        const qrCode = await prisma_1.prisma.qrCode.create({
            data: {
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
    async getAllQrCodes() {
        const qrCodes = await prisma_1.prisma.qrCode.findMany({
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
    async validateAndScan(code) {
        // First check if the global module is enabled
        const tenantConfig = await prisma_1.prisma.tenantConfig.findFirst();
        if (!tenantConfig?.enableDigital) {
            throw new errors_1.NotFoundError('Digital menu module is disabled');
        }
        const qrCode = await prisma_1.prisma.qrCode.findUnique({
            where: { code },
            include: {
                table: { select: { id: true, name: true } }
            }
        });
        if (!qrCode || !qrCode.isActive) {
            throw new errors_1.NotFoundError('QR code not found or inactive');
        }
        // Increment scan count
        await prisma_1.prisma.qrCode.update({
            where: { id: qrCode.id },
            data: {
                scansCount: { increment: 1 },
                lastScannedAt: new Date()
            }
        });
        const config = await this.getConfig();
        return {
            valid: true,
            tableId: qrCode.tableId,
            tableName: qrCode.table?.name || null,
            config
        };
    }
    /**
     * Delete a QR code
     */
    async deleteQrCode(id) {
        await prisma_1.prisma.qrCode.delete({
            where: { id }
        });
    }
    /**
     * Toggle QR code active status
     */
    async toggleQrCode(id) {
        const current = await prisma_1.prisma.qrCode.findUnique({ where: { id } });
        if (!current) {
            throw new errors_1.NotFoundError('QR code not found');
        }
        const updated = await prisma_1.prisma.qrCode.update({
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
    async getPublicMenu() {
        const [categories, products] = await Promise.all([
            prisma_1.prisma.category.findMany({
                orderBy: { name: 'asc' }
            }),
            prisma_1.prisma.product.findMany({
                where: { isActive: true },
                include: {
                    category: { select: { id: true, name: true } }
                },
                orderBy: { name: 'asc' }
            })
        ]);
        return { categories, products };
    }
}
exports.QrService = QrService;
exports.qrService = new QrService();
//# sourceMappingURL=qr.service.js.map