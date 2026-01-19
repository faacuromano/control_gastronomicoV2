/**
 * @fileoverview QR Menu Service
 * Handles QR code generation, validation, and menu configuration
 *
 * @module services/qr.service
 */
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
export declare class QrService {
    /**
     * Get QR menu configuration for public display
     */
    getConfig(): Promise<QrMenuConfig>;
    /**
     * Update QR menu configuration
     */
    updateConfig(updates: Partial<{
        qrMenuEnabled: boolean;
        qrMenuMode: 'INTERACTIVE' | 'STATIC';
        qrSelfOrderEnabled: boolean;
        qrMenuPdfUrl: string | null;
        qrMenuBannerUrl: string | null;
        qrMenuTheme: any;
    }>): Promise<QrMenuConfig>;
    /**
     * Generate a new QR code
     * @param tableId - Optional table ID (null for generic QR)
     */
    generateQrCode(tableId?: number): Promise<QrCodeData>;
    /**
     * Get all QR codes
     */
    getAllQrCodes(): Promise<QrCodeData[]>;
    /**
     * Validate QR code and get associated data (public endpoint)
     * Also increments scan count
     */
    validateAndScan(code: string): Promise<{
        valid: boolean;
        tableId: number | null;
        tableName: string | null;
        config: QrMenuConfig;
    }>;
    /**
     * Delete a QR code
     */
    deleteQrCode(id: number): Promise<void>;
    /**
     * Toggle QR code active status
     */
    toggleQrCode(id: number): Promise<QrCodeData>;
    /**
     * Get public menu data (products, categories)
     * Used for INTERACTIVE mode
     */
    getPublicMenu(): Promise<{
        categories: {
            name: string;
            id: number;
            createdAt: Date;
            updatedAt: Date;
            printerId: number | null;
        }[];
        products: ({
            category: {
                name: string;
                id: number;
            };
        } & {
            name: string;
            id: number;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            categoryId: number;
            description: string | null;
            price: import("@prisma/client/runtime/library").Decimal;
            image: string | null;
            productType: import(".prisma/client").$Enums.ProductType;
            isStockable: boolean;
        })[];
    }>;
}
export declare const qrService: QrService;
//# sourceMappingURL=qr.service.d.ts.map