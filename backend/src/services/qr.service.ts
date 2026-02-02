/**
 * @fileoverview Servicio de Menu QR.
 * Gestiona la generacion de codigos QR, validacion de escaneos y configuracion
 * del menu digital. Soporta dos modos: INTERACTIVE (menu navegable) y STATIC (PDF).
 * Cada codigo QR puede asociarse a una mesa especifica o ser generico.
 *
 * @module services/qr.service
 */

import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { nanoid } from 'nanoid';
import { NotFoundError, ConflictError } from '../utils/errors';

/**
 * Configuracion del menu QR para un tenant.
 * Controla el modo de operacion, apariencia y funcionalidades disponibles.
 */
export interface QrMenuConfig {
    enabled: boolean;
    mode: 'INTERACTIVE' | 'STATIC';
    selfOrderEnabled: boolean;
    pdfUrl: string | null;
    bannerUrl: string | null;
    theme: Prisma.JsonValue;
    businessName: string;
}

/**
 * Datos de un codigo QR incluyendo estadisticas de escaneo.
 */
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
     * Obtiene la configuracion del menu QR para visualizacion publica.
     * Verifica tanto el flag global enableDigital como el flag especifico qrMenuEnabled.
     * Ambos deben estar activos para que el menu QR funcione.
     */
    async getConfig(tenantId: number): Promise<QrMenuConfig> {
        const config = await prisma.tenantConfig.findFirst({
            where: { tenantId }
        });

        if (!config) {
            throw new NotFoundError('Configuration not found');
        }

        // Si el modulo global Digital/QR esta deshabilitado, sobreescribir qrMenuEnabled a false
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
     * Actualiza la configuracion del menu QR.
     * SEC-035: Usa updateMany con tenantId para defensa en profundidad.
     */
    async updateConfig(tenantId: number, updates: Prisma.TenantConfigUpdateManyMutationInput): Promise<QrMenuConfig> {
        // Verificar que exista la configuracion antes de actualizar
        const existingConfig = await prisma.tenantConfig.findFirst({ where: { tenantId } });
        if (!existingConfig) throw new NotFoundError('Config not found');

        await prisma.tenantConfig.updateMany({
            where: { id: existingConfig.id, tenantId },
            data: updates
        });

        // Re-obtener la configuracion actualizada para retornarla
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
     * Genera un nuevo codigo QR unico.
     * ERR-009: Implementa reintento en caso de colision de codigos unicos
     * (paradoja del cumpleanos con codigos cortos de 8 caracteres).
     *
     * @param tenantId - ID del tenant
     * @param tableId - ID de mesa opcional (null para QR generico)
     */
    async generateQrCode(tenantId: number, tableId?: number): Promise<QrCodeData> {
        // Validar que la mesa pertenezca al tenant si se proporciona
        if (tableId) {
            const table = await prisma.table.findFirst({ where: { id: tableId, tenantId } });
            if (!table) throw new NotFoundError('Table not found or access denied');
        }

        // ERR-009: Reintentar en caso de colision de constraint unico (paradoja del cumpleanos)
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
                // P2002 = violacion de constraint unico - reintentar con nuevo codigo
                if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && attempt < MAX_RETRIES - 1) {
                    continue;
                }
                throw error;
            }
        }
        throw new ConflictError('Failed to generate unique QR code after multiple attempts');
    }

    /**
     * Obtiene todos los codigos QR del tenant, ordenados por fecha de creacion descendente.
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
     * Valida un codigo QR y obtiene los datos asociados (endpoint publico).
     * Tambien incrementa el contador de escaneos para analitica.
     * Respeta el flag global enableDigital del tenant.
     *
     * Flujo:
     * 1. Busca el QR por codigo (unico global)
     * 2. Verifica que el tenant tenga el modulo digital habilitado
     * 3. Incrementa contador de escaneos
     * 4. Retorna la configuracion del menu y datos de mesa
     */
    async validateAndScan(code: string): Promise<{
        valid: boolean;
        tableId: number | null;
        tableName: string | null;
        config: QrMenuConfig;
        tenantId: number;
    }> {
        // Buscar el codigo QR para identificar el tenant (es un endpoint publico sin auth)
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

        // Verificar que el modulo digital este habilitado PARA ESTE TENANT
        const tenantConfig = await prisma.tenantConfig.findFirst({ where: { tenantId: qrTenantId } });
        if (!tenantConfig?.enableDigital) {
            throw new NotFoundError('Digital menu module is disabled');
        }

        // Incrementar contador de escaneos y registrar fecha del ultimo escaneo
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
     * Elimina un codigo QR del tenant.
     */
    async deleteQrCode(id: number, tenantId: number): Promise<void> {
        const exists = await prisma.qrCode.findFirst({ where: { id, tenantId } });
        if (!exists) throw new NotFoundError('QR code not found');

        await prisma.qrCode.deleteMany({
            where: { id, tenantId }
        });
    }

    /**
     * Alterna el estado activo/inactivo de un codigo QR.
     * Un QR inactivo no puede ser escaneado por clientes.
     * SEC-034: Usa updateMany con tenantId para defensa en profundidad.
     */
    async toggleQrCode(id: number, tenantId: number): Promise<QrCodeData> {
        const current = await prisma.qrCode.findFirst({ where: { id, tenantId } });
        if (!current) {
            throw new NotFoundError('QR code not found');
        }

        // SEC-034: Usar updateMany con tenantId para defensa en profundidad
        await prisma.qrCode.updateMany({
            where: { id, tenantId },
            data: { isActive: !current.isActive }
        });

        // Re-obtener con relaciones para retornar datos completos
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
     * Obtiene los datos del menu publico (productos activos y categorias).
     * Se usa en modo INTERACTIVE para mostrar el menu navegable al cliente.
     * No requiere autenticacion ya que es un endpoint publico.
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
