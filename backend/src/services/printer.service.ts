import { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } from 'node-thermal-printer';
import { prisma } from '../lib/prisma';
import { NotFoundError, ValidationError } from '../utils/errors';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);
import { logger } from '../utils/logger';

interface PrinterConfig {
    type: 'EPSON' | 'STAR';
    connectionType: 'NETWORK' | 'USB';
    interface: string; // 'tcp://192.168.1.100:9100' for NETWORK
    windowsName?: string; // Windows printer name for USB
}

export class PrinterService {
    /**
     * Create a printer instance configured for a specific target
     */
    private createPrinter(config: PrinterConfig): ThermalPrinter {
        // For USB printers, we'll use a dummy interface and handle printing separately
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
     * Get printer config from database by ID
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
                interface: 'tcp://0.0.0.0', // Dummy, won't be used
                windowsName: printer.windowsName
            };
        } else {
            if (!printer.ipAddress) {
                throw new ValidationError('Network printer does not have an IP address configured');
            }
            // Default to port 9100 (standard ESC/POS port)
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
     * List available Windows printers
     */
    async listSystemPrinters(): Promise<string[]> {
        try {
            // Use PowerShell to get list of printers
            const { stdout } = await execAsync(
                'powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"',
                { encoding: 'utf8' }
            );
            
            return stdout
                .split('\n')
                .map(name => name.trim())
                .filter(name => name.length > 0);
        } catch (error) {
            console.error('Failed to list system printers:', error);
            return [];
        }
    }

    /**
     * Print raw ESC/POS data to a Windows USB printer
     * Uses PowerShell script with Windows winspool.drv API for true raw printing
     */
    private async printToWindowsPrinter(buffer: Buffer, printerName: string): Promise<void> {
        const tempDir = os.tmpdir();
        const tempFile = path.join(tempDir, `escpos_${Date.now()}.bin`);
        
        // Get the path to the RawPrinter.ps1 script
        const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'RawPrinter.ps1');
        
        try {
            // Write buffer to temp file
            fs.writeFileSync(tempFile, buffer);
            
            // Escape printer name for PowerShell (use double quotes and escape internal quotes)
            const escapedPrinterName = printerName.replace(/"/g, '`"');
            const escapedFilePath = tempFile.replace(/\\/g, '\\\\');
            
            // Execute the raw printer script - use double quotes for params with spaces
            const command = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -PrinterName "${escapedPrinterName}" -FilePath "${escapedFilePath}"`;
            
            logger.info('Sending raw data to printer', { printerName });
            const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
            
            if (stderr && stderr.includes('ERROR')) {
                throw new Error(stderr);
            }
            
            logger.info('Print result', { result: stdout.trim() });
        } catch (error: any) {
            console.error('[PrinterService] Raw print error:', error);
            throw new ValidationError(`Failed to print to USB printer '${printerName}': ${error.message || 'Unknown error'}`);
        } finally {
            // Clean up temp file
            try {
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    }

    /**
     * Generate a buffer-only ticket (for preview or local printing)
     */
    async generateOrderTicket(orderId: number, tenantId: number): Promise<Buffer> {
        // Use dummy interface for buffer generation only
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
     * Print order ticket to a specific printer by printer ID
     */
    async printOrderToDevice(orderId: number, printerId: number, tenantId: number): Promise<boolean> {
        const config = await this.getPrinterConfig(printerId, tenantId);
        const printer = this.createPrinter(config);

        const order = await this.getOrderForPrint(orderId, tenantId);
        await this.buildTicketContent(printer, order, tenantId);

        if (config.connectionType === 'USB' && config.windowsName) {
            // Use Windows raw printing for USB printers
            const buffer = printer.getBuffer();
            await this.printToWindowsPrinter(buffer, config.windowsName);
            return true;
        } else {
            // Use network printing
            try {
                const isConnected = await printer.isPrinterConnected();
                if (!isConnected) {
                    throw new ValidationError('Cannot connect to network printer');
                }

                await printer.execute();
                return true;
            } catch (error: any) {
                console.error('Print error:', error);
                throw new ValidationError(`Print failed: ${error.message || 'Unknown error'}`);
            }
        }
    }

    /**
     * Print test page to verify printer connection
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
            // Use Windows raw printing for USB printers
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
            } catch (error: any) {
                console.error('Test print error:', error);
                throw new ValidationError(`Test print failed: ${error.message || 'Unknown error'}`);
            }
        }
    }

    /**
     * Get order with all relations needed for printing
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
     * Build the ticket content on a printer instance
     */
    private async buildTicketContent(printer: ThermalPrinter, order: any, tenantId: number): Promise<void> {
        // Get business name from config
        const config = await prisma.tenantConfig.findFirst({ where: { tenantId } });
        const businessName = config?.businessName || 'RESTAURANTE';

        printer.clear();
        
        // Header
        printer.alignCenter();
        printer.bold(true);
        printer.setTextSize(1, 1);
        printer.println(businessName.toUpperCase());
        printer.bold(false);
        printer.setTextSize(0, 0);
        printer.println("--------------------------------");
        
        // Order Info
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

        // Items
        printer.alignLeft();
        for (const item of order.items) {
            // Format: Qty x Name                    $Price
            const itemTotal = Number(item.unitPrice) * item.quantity;
            const itemLine = `${item.quantity} x ${item.product.name}`;
            printer.println(itemLine);
            printer.alignRight();
            printer.println(`$${itemTotal.toFixed(2)}`);
            printer.alignLeft();
            
            // Modifiers
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
            
            // Notes
            if (item.notes) {
                printer.println(`   Nota: ${item.notes}`);
            }
        }

        printer.println("--------------------------------");

        // Totals
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

        // Payments
        if (order.payments && order.payments.length > 0) {
            printer.println("");
            printer.println("Pagos:");
            for (const payment of order.payments) {
                printer.println(`  ${payment.method}: $${Number(payment.amount).toFixed(2)}`);
            }
        }

        // Footer
        printer.alignCenter();
        printer.println("--------------------------------");
        printer.println("Gracias por su visita!");
        printer.println("");
        
        printer.cut();
    }
}
