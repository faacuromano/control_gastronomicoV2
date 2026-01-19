/**
 * @fileoverview QR Menu Service (Frontend)
 * Client-side service for QR menu operations
 */

import api from '../lib/api';

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
    lastScannedAt: string | null;
    createdAt: string;
}

export interface QrValidation {
    valid: boolean;
    tableId: number | null;
    tableName: string | null;
    config: QrMenuConfig;
}

export interface PublicMenu {
    mode: 'INTERACTIVE' | 'STATIC';
    businessName: string;
    bannerUrl: string | null;
    selfOrderEnabled?: boolean;
    tableId?: number | null;
    tableName?: string | null;
    pdfUrl?: string;
    theme?: any;
    categories?: any[];
    products?: any[];
}

class QrService {
    // ========================================================================
    // PUBLIC ENDPOINTS (for customer-facing menu)
    // ========================================================================

    /**
     * Validate QR code and get config (public, no auth)
     */
    async validateQr(code: string): Promise<QrValidation> {
        const response = await api.get(`/qr/${code}`);
        return response.data.data;
    }

    /**
     * Get public menu for QR code (public, no auth)
     */
    async getPublicMenu(code: string): Promise<PublicMenu> {
        const response = await api.get(`/qr/${code}/menu`);
        return response.data.data;
    }

    // ========================================================================
    // ADMIN ENDPOINTS
    // ========================================================================

    /**
     * Get QR menu configuration
     */
    async getConfig(): Promise<QrMenuConfig> {
        const response = await api.get('/admin/qr/config');
        return response.data.data;
    }

    /**
     * Update QR menu configuration
     */
    async updateConfig(updates: Partial<{
        qrMenuEnabled: boolean;
        qrMenuMode: 'INTERACTIVE' | 'STATIC';
        qrSelfOrderEnabled: boolean;
        qrMenuPdfUrl: string | null;
        qrMenuBannerUrl: string | null;
        qrMenuTheme: any;
    }>): Promise<QrMenuConfig> {
        const response = await api.patch('/admin/qr/config', updates);
        return response.data.data;
    }

    /**
     * Get all QR codes
     */
    async getAllCodes(): Promise<QrCodeData[]> {
        const response = await api.get('/admin/qr/codes');
        return response.data.data;
    }

    /**
     * Generate new QR code
     */
    async generateCode(tableId?: number): Promise<QrCodeData> {
        const response = await api.post('/admin/qr/codes', { tableId });
        return response.data.data;
    }

    /**
     * Toggle QR code active status
     */
    async toggleCode(id: number): Promise<QrCodeData> {
        const response = await api.patch(`/admin/qr/codes/${id}/toggle`);
        return response.data.data;
    }

    /**
     * Delete QR code
     */
    async deleteCode(id: number): Promise<void> {
        await api.delete(`/admin/qr/codes/${id}`);
    }

    /**
     * Generate URL for QR code
     */
    getQrUrl(code: string): string {
        const baseUrl = window.location.origin;
        return `${baseUrl}/menu/${code}`;
    }
}

export const qrService = new QrService();
