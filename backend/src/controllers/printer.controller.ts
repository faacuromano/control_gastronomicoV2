/**
 * @fileoverview Controlador de Impresoras Térmicas
 *
 * Gestiona las impresoras térmicas del restaurante: configuración, prueba de conexión,
 * generación de tickets e impresión directa. Soporta impresoras de red (TCP/IP)
 * e impresoras USB conectadas al servidor Windows.
 *
 * Funcionalidades:
 * - Generación de tickets en formato base64 (para impresión desde el navegador)
 * - Impresión directa a dispositivo térmico (red o USB)
 * - Pre-cuenta (ticket sin pagos para que el cliente revise antes de pagar)
 * - Página de prueba para verificar conectividad
 * - CRUD de configuración de impresoras
 *
 * @module controllers/printer.controller
 */

import { Request, Response } from 'express';
import { isIP } from 'net';
import { AuditAction } from '@prisma/client';
import { PrinterService } from '../services/printer.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../lib/prisma';
import { ValidationError } from '../utils/errors';
import { auditService } from '../services/audit.service';

const printerService = new PrinterService();

// Pattern for safe printer names to prevent command injection
const SAFE_NAME_PATTERN = /^[a-zA-Z0-9\s\-_().#]+$/;

/**
 * Valida los datos de entrada de impresora para prevenir inyección de comandos.
 * Verifica formato de IP con net.isIP(), caracteres seguros en nombres y límites de longitud.
 */
function validatePrinterInputs(ipAddress?: string, windowsName?: string, name?: string): void {
    if (ipAddress) {
        const colonIdx = ipAddress.indexOf(':');
        const ipPart = colonIdx === -1 ? ipAddress : ipAddress.substring(0, colonIdx);
        const portPart = colonIdx === -1 ? undefined : ipAddress.substring(colonIdx + 1);
        if (!isIP(ipPart)) {
            throw new ValidationError('Invalid IP address format');
        }
        if (portPart !== undefined) {
            const port = parseInt(portPart, 10);
            if (isNaN(port) || port < 1 || port > 65535) {
                throw new ValidationError('Invalid port number (1-65535)');
            }
        }
    }
    if (windowsName && !SAFE_NAME_PATTERN.test(windowsName)) {
        throw new ValidationError('Printer name contains invalid characters');
    }
    if (windowsName && windowsName.length > 200) {
        throw new ValidationError('Printer name too long (max 200 characters)');
    }
    if (name && !SAFE_NAME_PATTERN.test(name)) {
        throw new ValidationError('Printer display name contains invalid characters');
    }
}

/**
 * Genera un ticket de orden en formato base64 para impresión desde el navegador.
 * GET /print/:id
 * El frontend decodifica el base64 y lo envía a la impresora local del usuario.
 */
export const printTicket = asyncHandler(async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.id as string);
    const buffer = await printerService.generateOrderTicket(orderId, req.user!.tenantId!);

    sendSuccess(res, {
        message: 'Ticket generado',
        base64: buffer.toString('base64')
    });
});

/**
 * Imprime una orden directamente en una impresora térmica específica.
 * POST /print/:orderId/device/:printerId
 * El servidor se conecta a la impresora por red (TCP/IP) o USB y envía los datos ESC/POS.
 */
export const printToDevice = asyncHandler(async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.orderId as string);
    const printerId = parseInt(req.params.printerId as string);

    await printerService.printOrderToDevice(orderId, printerId, req.user!.tenantId!);

    sendSuccess(res, {
        message: 'Ticket enviado a la impresora exitosamente'
    });
});

/**
 * Imprime la pre-cuenta (ticket sin información de pagos) para que el cliente
 * revise los ítems y precios antes de proceder al pago.
 * POST /print/:orderId/preaccount/:printerId
 */
export const printPreAccount = asyncHandler(async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.orderId as string);
    const printerId = parseInt(req.params.printerId as string);

    // Reutiliza el mismo método de impresión — solo muestra pagos si existen
    // La pre-cuenta es simplemente imprimir la orden antes de que se registren pagos
    await printerService.printOrderToDevice(orderId, printerId, req.user!.tenantId!);

    sendSuccess(res, {
        message: 'Pre-cuenta enviada a la impresora exitosamente'
    });
});

/**
 * Imprime una página de prueba para verificar la conexión con la impresora.
 * POST /print/test/:printerId
 */
export const printTestPage = asyncHandler(async (req: Request, res: Response) => {
    const printerId = parseInt(req.params.printerId as string);

    await printerService.printTestPage(printerId, req.user!.tenantId!);

    sendSuccess(res, {
        message: 'Página de prueba impresa exitosamente'
    });
});

/**
 * Obtiene todas las impresoras configuradas del tenant con sus categorías asignadas.
 * GET /print/printers
 */
export const getPrinters = asyncHandler(async (req: Request, res: Response) => {
    const printers = await prisma.printer.findMany({
        where: { tenantId: req.user!.tenantId! },
        include: { categories: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' }
    });

    sendSuccess(res, printers);
});

/**
 * Obtiene las impresoras disponibles en el sistema operativo Windows del servidor.
 * GET /print/printers/system
 * Usado para descubrir impresoras USB conectadas al servidor.
 */
export const getSystemPrinters = asyncHandler(async (_req: Request, res: Response) => {
    const printers = await printerService.listSystemPrinters();

    sendSuccess(res, printers);
});

/**
 * Crea una nueva impresora en la configuración del tenant.
 * POST /print/printers
 * Valida los datos de entrada y determina los campos según el tipo de conexión (red vs USB).
 */
export const createPrinter = asyncHandler(async (req: Request, res: Response) => {
    const { name, connectionType, ipAddress, windowsName } = req.body;

    // Sanitizar inputs para prevenir inyección de comandos
    validatePrinterInputs(ipAddress, windowsName, name);

    // Validar campos requeridos según tipo de conexión
    if (connectionType === 'USB') {
        if (!windowsName) {
            throw new ValidationError('Windows printer name is required for USB printers');
        }
    } else if (connectionType === 'NETWORK' || !connectionType) {
        if (!ipAddress) {
            throw new ValidationError('IP address is required for network printers');
        }
    }

    const printer = await prisma.printer.create({
        data: {
            tenantId: req.user!.tenantId!,
            name,
            connectionType: connectionType || 'NETWORK',
            ipAddress: connectionType === 'USB' ? null : ipAddress,
            windowsName: connectionType === 'USB' ? windowsName : null
        }
    });

    // Auditoría: registrar creación de impresora
    auditService.log(
        AuditAction.PRINTER_CREATED,
        'Printer',
        printer.id,
        {
            userId: req.user!.id!,
            tenantId: req.user!.tenantId!,
            ipAddress: String(req.ip),
            userAgent: req.headers['user-agent'] ?? 'unknown'
        },
        { name: printer.name, connectionType: printer.connectionType, ipAddress: printer.ipAddress }
    );

    sendSuccess(res, printer, undefined, 201);
});

/**
 * Actualiza la configuración de una impresora.
 * PUT /print/printers/:id
 * Usa updateMany con tenantId como defensa en profundidad (P1-009).
 */
export const updatePrinter = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    const { name, connectionType, ipAddress, windowsName } = req.body;

    // Sanitizar inputs para prevenir inyección de comandos
    validatePrinterInputs(ipAddress, windowsName, name);

    // Construir datos de actualización según tipo de conexión
    const updateData: Record<string, string | null | undefined> = {};
    if (name !== undefined) updateData.name = name;
    if (connectionType !== undefined) updateData.connectionType = connectionType;

    if (connectionType === 'USB') {
        updateData.ipAddress = null;
        updateData.windowsName = windowsName;
    } else if (connectionType === 'NETWORK') {
        updateData.ipAddress = ipAddress;
        updateData.windowsName = null;
    } else {
        // Actualización parcial: solo actualizar campos proporcionados
        if (ipAddress !== undefined) updateData.ipAddress = ipAddress;
        if (windowsName !== undefined) updateData.windowsName = windowsName;
    }

    // Defensa en profundidad: updateMany con tenantId (fix P1-009)
    const result = await prisma.printer.updateMany({
        where: { id, tenantId: req.user!.tenantId! },
        data: updateData
    });
    if (result.count === 0) throw new ValidationError('Printer not found');

    const printer = await prisma.printer.findFirst({
        where: { id, tenantId: req.user!.tenantId! }
    });

    // Auditoría: registrar modificación de impresora
    auditService.log(
        AuditAction.PRINTER_UPDATED,
        'Printer',
        id,
        {
            userId: req.user!.id!,
            tenantId: req.user!.tenantId!,
            ipAddress: String(req.ip),
            userAgent: req.headers['user-agent'] ?? 'unknown'
        },
        { updates: updateData }
    );

    sendSuccess(res, printer);
});

/**
 * Elimina una impresora de la configuración del tenant.
 * DELETE /print/printers/:id
 * Usa deleteMany con tenantId como defensa en profundidad (fix P1-009).
 */
export const deletePrinter = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);

    // Obtener datos de la impresora antes de eliminar para el registro de auditoría
    const printer = await prisma.printer.findFirst({
        where: { id, tenantId: req.user!.tenantId! }
    });

    // Defensa en profundidad: deleteMany con tenantId (fix P1-009)
    const result = await prisma.printer.deleteMany({
        where: { id, tenantId: req.user!.tenantId! }
    });
    if (result.count === 0) throw new ValidationError('Printer not found');

    // Auditoría: registrar eliminación con los datos previos
    if (printer) {
        auditService.log(
            AuditAction.PRINTER_DELETED,
            'Printer',
            id,
            {
                userId: req.user!.id!,
                tenantId: req.user!.tenantId!,
                ipAddress: String(req.ip),
                userAgent: req.headers['user-agent'] ?? 'unknown'
            },
            { printerName: printer.name, connectionType: printer.connectionType }
        );
    }

    sendSuccess(res, { message: 'Impresora eliminada' });
});
