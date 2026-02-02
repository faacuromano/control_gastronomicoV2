/**
 * @fileoverview Servicio de impresion termica para tickets de ordenes.
 * Soporta impresoras conectadas por red (ESC/POS TCP) y por USB (via API nativa de Windows).
 * Genera tickets con formato de restaurante: encabezado, items, modificadores, totales y pagos.
 *
 * @module services/printer.service
 */

import { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } from 'node-thermal-printer';
import { prisma } from '../lib/prisma';
import { NotFoundError, ValidationError } from '../utils/errors';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

const execFileAsync = promisify(execFile);
import { logger } from '../utils/logger';

/**
 * Configuracion interna de una impresora.
 * Soporta dos tipos de conexion: red (TCP) y USB (via nombre de impresora Windows).
 */
interface PrinterConfig {
    type: 'EPSON' | 'STAR';
    connectionType: 'NETWORK' | 'USB';
    interface: string; // 'tcp://192.168.1.100:9100' para impresoras de red
    windowsName?: string; // Nombre de impresora en Windows para USB
}

export class PrinterService {
    /**
     * Crea una instancia de impresora termica configurada para un destino especifico.
     * Para impresoras USB se usa una interfaz dummy ya que la impresion se maneja por separado
     * a traves de la API nativa de Windows (winspool.drv).
     */
    private createPrinter(config: PrinterConfig): ThermalPrinter {
        // Para impresoras USB usamos una interfaz dummy; la impresion real se hace via PowerShell
        const printerInterface = config.connectionType === 'USB'
            ? 'tcp://0.0.0.0'
            : config.interface;

        return new ThermalPrinter({
            type: config.type === 'STAR' ? PrinterTypes.STAR : PrinterTypes.EPSON,
            interface: printerInterface,
            characterSet: CharacterSet.PC852_LATIN2,
            removeSpecialCharacters: false,
            lineCharacter: "-",
            breakLine: BreakLine.WORD,
            options: {
                timeout: 5000
            }
        });
    }

    /**
     * Obtiene la configuracion de una impresora desde la base de datos por su ID.
     * Valida que la impresora exista, pertenezca al tenant y tenga la configuracion
     * necesaria segun su tipo de conexion (IP para red, nombre para USB).
     */
    private async getPrinterConfig(printerId: number, tenantId: number): Promise<PrinterConfig> {
        const printer = await prisma.printer.findFirst({
            where: { id: printerId, tenantId }
        });

        if (!printer) {
            throw new NotFoundError('Printer');
        }

        if (printer.connectionType === 'USB') {
            if (!printer.windowsName) {
                throw new ValidationError('USB printer does not have a Windows name configured');
            }
            return {
                type: 'EPSON',
                connectionType: 'USB',
                interface: 'tcp://0.0.0.0', // Dummy, no se usa para USB
                windowsName: printer.windowsName
            };
        } else {
            if (!printer.ipAddress) {
                throw new ValidationError('Network printer does not have an IP address configured');
            }
            // Puerto por defecto 9100 (estandar ESC/POS)
            const ip = printer.ipAddress.includes(':')
                ? printer.ipAddress
                : `${printer.ipAddress}:9100`;

            return {
                type: 'EPSON',
                connectionType: 'NETWORK',
                interface: `tcp://${ip}`
            };
        }
    }

    /**
     * Lista las impresoras instaladas en el sistema operativo Windows.
     * Usa PowerShell para obtener la lista de impresoras disponibles.
     */
    async listSystemPrinters(): Promise<string[]> {
        try {
            // SEC-039: Usar execFile con array de argumentos para prevenir inyeccion de comandos
            const { stdout } = await execFileAsync(
                'powershell',
                ['-NoProfile', '-Command', 'Get-Printer | Select-Object -ExpandProperty Name'],
                { encoding: 'utf8', timeout: 5000 }
            );

            return stdout
                .split('\n')
                .map(name => name.trim())
                .filter(name => name.length > 0);
        } catch (error) {
            logger.error('Failed to list system printers:', { error });
            return [];
        }
    }

    /**
     * Envia datos raw ESC/POS a una impresora USB de Windows.
     * Usa un script PowerShell que invoca la API winspool.drv de Windows
     * para impresion raw (sin procesamiento del driver de impresora).
     *
     * Flujo:
     * 1. Escribe el buffer ESC/POS en un archivo temporal con nombre aleatorio
     * 2. Ejecuta el script PowerShell que envia el archivo a la impresora
     * 3. Limpia el archivo temporal al finalizar
     */
    private async printToWindowsPrinter(buffer: Buffer, printerName: string): Promise<void> {
        const tempDir = os.tmpdir();
        // SEC-036: Usar nombre de archivo aleatorio (crypto) para evitar rutas predecibles
        const tempFile = path.join(tempDir, `escpos_${crypto.randomBytes(16).toString('hex')}.bin`);

        // Ruta al script PowerShell de impresion raw
        const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'RawPrinter.ps1');

        try {
            // Escribir el buffer ESC/POS en archivo temporal
            fs.writeFileSync(tempFile, buffer);

            // SEC-039: Usar execFile con array de argumentos para prevenir inyeccion de comandos.
            // printerName viene de la DB pero podria contener metacaracteres; execFile
            // pasa los argumentos directamente al proceso sin interpolacion de shell.
            logger.info('Sending raw data to printer', { printerName });
            const { stdout, stderr } = await execFileAsync(
                'powershell',
                ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-PrinterName', printerName, '-FilePath', tempFile],
                { timeout: 30000 }
            );

            if (stderr && stderr.includes('ERROR')) {
                throw new ValidationError(stderr);
            }

            logger.info('Print result', { result: stdout.trim() });
        } catch (error: unknown) {
            logger.error('[PrinterService] Raw print error:', { error });
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new ValidationError(`Failed to print to USB printer '${printerName}': ${message}`);
        } finally {
            // Limpiar archivo temporal sin importar si la impresion tuvo exito o no
            try {
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
            } catch (_error) {
                // Ignorar errores de limpieza; no son criticos
            }
        }
    }

    /**
     * Genera un ticket como buffer (para preview o impresion local).
     * No envia a ninguna impresora, solo construye los datos ESC/POS en memoria.
     */
    async generateOrderTicket(orderId: number, tenantId: number): Promise<Buffer> {
        // Usar interfaz dummy ya que solo se genera el buffer
        const printer = this.createPrinter({
            type: 'EPSON',
            connectionType: 'NETWORK',
            interface: 'tcp://0.0.0.0'
        });

        const order = await this.getOrderForPrint(orderId, tenantId);
        await this.buildTicketContent(printer, order, tenantId);

        return printer.getBuffer();
    }

    /**
     * Imprime el ticket de una orden en una impresora especifica por su ID.
     * Detecta automaticamente si es USB o red y usa el metodo de envio apropiado.
     */
    async printOrderToDevice(orderId: number, printerId: number, tenantId: number): Promise<boolean> {
        const config = await this.getPrinterConfig(printerId, tenantId);
        const printer = this.createPrinter(config);

        const order = await this.getOrderForPrint(orderId, tenantId);
        await this.buildTicketContent(printer, order, tenantId);

        if (config.connectionType === 'USB' && config.windowsName) {
            // Impresion raw via Windows para impresoras USB
            const buffer = printer.getBuffer();
            await this.printToWindowsPrinter(buffer, config.windowsName);
            return true;
        } else {
            // Impresion por red TCP directa
            try {
                const isConnected = await printer.isPrinterConnected();
                if (!isConnected) {
                    throw new ValidationError('Cannot connect to network printer');
                }

                await printer.execute();
                return true;
            } catch (error: unknown) {
                logger.error('Print error:', { error });
                const message = error instanceof Error ? error.message : 'Unknown error';
                throw new ValidationError(`Print failed: ${message}`);
            }
        }
    }

    /**
     * Imprime una pagina de prueba para verificar la conexion con la impresora.
     * Util durante la configuracion inicial para confirmar que todo funciona.
     */
    async printTestPage(printerId: number, tenantId: number): Promise<boolean> {
        const config = await this.getPrinterConfig(printerId, tenantId);
        const printer = this.createPrinter(config);

        printer.clear();
        printer.alignCenter();
        printer.bold(true);
        printer.setTextSize(1, 1);
        printer.println("=== TEST DE IMPRESION ===");
        printer.bold(false);
        printer.setTextSize(0, 0);
        printer.println("");
        printer.println(`Fecha: ${new Date().toLocaleString()}`);
        printer.println(`Printer ID: ${printerId}`);
        printer.println(`Tipo: ${config.connectionType}`);
        if (config.connectionType === 'USB') {
            printer.println(`Nombre: ${config.windowsName}`);
        } else {
            printer.println(`Interface: ${config.interface}`);
        }
        printer.println("");
        printer.println("--------------------------------");
        printer.println("Si puede leer esto,");
        printer.println("la impresora funciona correctamente!");
        printer.println("--------------------------------");
        printer.cut();

        if (config.connectionType === 'USB' && config.windowsName) {
            // Impresion raw via Windows para impresoras USB
            const buffer = printer.getBuffer();
            await this.printToWindowsPrinter(buffer, config.windowsName);
            return true;
        } else {
            try {
                const isConnected = await printer.isPrinterConnected();
                if (!isConnected) {
                    throw new ValidationError('Cannot connect to network printer');
                }

                await printer.execute();
                return true;
            } catch (error: unknown) {
                logger.error('Test print error:', { error });
                const message = error instanceof Error ? error.message : 'Unknown error';
                throw new ValidationError(`Test print failed: ${message}`);
            }
        }
    }

    /**
     * Obtiene una orden con todas las relaciones necesarias para imprimir el ticket:
     * items con productos, modificadores, mesa con area, mesero, pagos y cliente.
     */
    private async getOrderForPrint(orderId: number, tenantId: number) {
        const order = await prisma.order.findFirst({
            where: { id: orderId, tenantId },
            include: {
                items: {
                    include: {
                        product: true,
                        modifiers: { include: { modifierOption: true } }
                    }
                },
                table: { include: { area: true } },
                server: true,
                payments: true,
                client: true
            }
        });

        if (!order) throw new NotFoundError('Order');
        return order;
    }

    /**
     * Construye el contenido del ticket en la instancia de impresora.
     *
     * Estructura del ticket:
     * 1. Encabezado: nombre del negocio (de TenantConfig)
     * 2. Info de orden: fecha, numero, mesa, mesero, cliente
     * 3. Items: cantidad x nombre, precio, modificadores y notas
     * 4. Totales: subtotal, descuento (si aplica) y TOTAL
     * 5. Pagos: desglose por metodo de pago
     * 6. Pie: mensaje de agradecimiento
     */
    private async buildTicketContent(printer: ThermalPrinter, order: Awaited<ReturnType<PrinterService['getOrderForPrint']>>, tenantId: number): Promise<void> {
        // Obtener nombre del negocio desde la configuracion del tenant
        const config = await prisma.tenantConfig.findFirst({ where: { tenantId } });
        const businessName = config?.businessName || 'RESTAURANTE';

        printer.clear();

        // Encabezado del ticket
        printer.alignCenter();
        printer.bold(true);
        printer.setTextSize(1, 1);
        printer.println(businessName.toUpperCase());
        printer.bold(false);
        printer.setTextSize(0, 0);
        printer.println("--------------------------------");

        // Informacion de la orden
        printer.alignLeft();
        printer.println(`Fecha: ${order.createdAt.toLocaleString('es-AR')}`);
        printer.println(`Orden #: ${order.orderNumber}`);

        if (order.table) {
            printer.println(`Mesa: ${order.table.name} (${order.table.area.name})`);
        }
        if (order.server) {
            printer.println(`Atendio: ${order.server.name}`);
        }
        if (order.client) {
            printer.println(`Cliente: ${order.client.name}`);
        }

        printer.println("--------------------------------");

        // Listado de items con sus modificadores y notas
        printer.alignLeft();
        for (const item of order.items) {
            // Formato: Cantidad x Nombre                    $Precio
            const itemTotal = Number(item.unitPrice) * item.quantity;
            const itemLine = `${item.quantity} x ${item.product.name}`;
            printer.println(itemLine);
            printer.alignRight();
            printer.println(`$${itemTotal.toFixed(2)}`);
            printer.alignLeft();

            // Modificadores del item (ej: "sin cebolla", "extra queso")
            if (item.modifiers && item.modifiers.length > 0) {
                for (const mod of item.modifiers) {
                    const modPrice = Number(mod.priceCharged);
                    if (modPrice > 0) {
                        printer.println(`   + ${mod.modifierOption.name} (+$${modPrice.toFixed(2)})`);
                    } else {
                        printer.println(`   + ${mod.modifierOption.name}`);
                    }
                }
            }

            // Notas especiales del item
            if (item.notes) {
                printer.println(`   Nota: ${item.notes}`);
            }
        }

        printer.println("--------------------------------");

        // Seccion de totales
        if (Number(order.discount) > 0) {
            printer.alignRight();
            printer.println(`Subtotal: $${Number(order.subtotal).toFixed(2)}`);
            printer.println(`Descuento: -$${Number(order.discount).toFixed(2)}`);
        }

        printer.alignRight();
        printer.bold(true);
        printer.setTextSize(1, 0);
        printer.println(`TOTAL: $${Number(order.total).toFixed(2)}`);
        printer.setTextSize(0, 0);
        printer.bold(false);

        // Desglose de pagos por metodo
        if (order.payments && order.payments.length > 0) {
            printer.println("");
            printer.println("Pagos:");
            for (const payment of order.payments) {
                printer.println(`  ${payment.method}: $${Number(payment.amount).toFixed(2)}`);
            }
        }

        // Pie del ticket
        printer.alignCenter();
        printer.println("--------------------------------");
        printer.println("Gracias por su visita!");
        printer.println("");

        printer.cut();
    }
}
