"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrinterService = void 0;
const node_thermal_printer_1 = require("node-thermal-printer");
const prisma_1 = require("../lib/prisma");
const errors_1 = require("../utils/errors");
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const logger_1 = require("../utils/logger");
class PrinterService {
    /**
     * Create a printer instance configured for a specific target
     */
    createPrinter(config) {
        // For USB printers, we'll use a dummy interface and handle printing separately
        const printerInterface = config.connectionType === 'USB'
            ? 'tcp://0.0.0.0'
            : config.interface;
        return new node_thermal_printer_1.ThermalPrinter({
            type: config.type === 'STAR' ? node_thermal_printer_1.PrinterTypes.STAR : node_thermal_printer_1.PrinterTypes.EPSON,
            interface: printerInterface,
            characterSet: node_thermal_printer_1.CharacterSet.PC852_LATIN2,
            removeSpecialCharacters: false,
            lineCharacter: "-",
            breakLine: node_thermal_printer_1.BreakLine.WORD,
            options: {
                timeout: 5000
            }
        });
    }
    /**
     * Get printer config from database by ID
     */
    async getPrinterConfig(printerId) {
        const printer = await prisma_1.prisma.printer.findUnique({
            where: { id: printerId }
        });
        if (!printer) {
            throw new errors_1.NotFoundError('Printer');
        }
        if (printer.connectionType === 'USB') {
            if (!printer.windowsName) {
                throw new errors_1.ValidationError('USB printer does not have a Windows name configured');
            }
            return {
                type: 'EPSON',
                connectionType: 'USB',
                interface: 'tcp://0.0.0.0', // Dummy, won't be used
                windowsName: printer.windowsName
            };
        }
        else {
            if (!printer.ipAddress) {
                throw new errors_1.ValidationError('Network printer does not have an IP address configured');
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
    async listSystemPrinters() {
        try {
            // Use PowerShell to get list of printers
            const { stdout } = await execAsync('powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"', { encoding: 'utf8' });
            return stdout
                .split('\n')
                .map(name => name.trim())
                .filter(name => name.length > 0);
        }
        catch (error) {
            console.error('Failed to list system printers:', error);
            return [];
        }
    }
    /**
     * Print raw ESC/POS data to a Windows USB printer
     * Uses PowerShell script with Windows winspool.drv API for true raw printing
     */
    async printToWindowsPrinter(buffer, printerName) {
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
            logger_1.logger.info('Sending raw data to printer', { printerName });
            const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
            if (stderr && stderr.includes('ERROR')) {
                throw new Error(stderr);
            }
            logger_1.logger.info('Print result', { result: stdout.trim() });
        }
        catch (error) {
            console.error('[PrinterService] Raw print error:', error);
            throw new errors_1.ValidationError(`Failed to print to USB printer '${printerName}': ${error.message || 'Unknown error'}`);
        }
        finally {
            // Clean up temp file
            try {
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
            }
            catch (e) {
                // Ignore cleanup errors
            }
        }
    }
    /**
     * Generate a buffer-only ticket (for preview or local printing)
     */
    async generateOrderTicket(orderId) {
        // Use dummy interface for buffer generation only
        const printer = this.createPrinter({
            type: 'EPSON',
            connectionType: 'NETWORK',
            interface: 'tcp://0.0.0.0'
        });
        const order = await this.getOrderForPrint(orderId);
        await this.buildTicketContent(printer, order);
        return printer.getBuffer();
    }
    /**
     * Print order ticket to a specific printer by printer ID
     */
    async printOrderToDevice(orderId, printerId) {
        const config = await this.getPrinterConfig(printerId);
        const printer = this.createPrinter(config);
        const order = await this.getOrderForPrint(orderId);
        await this.buildTicketContent(printer, order);
        if (config.connectionType === 'USB' && config.windowsName) {
            // Use Windows raw printing for USB printers
            const buffer = printer.getBuffer();
            await this.printToWindowsPrinter(buffer, config.windowsName);
            return true;
        }
        else {
            // Use network printing
            try {
                const isConnected = await printer.isPrinterConnected();
                if (!isConnected) {
                    throw new errors_1.ValidationError('Cannot connect to network printer');
                }
                await printer.execute();
                return true;
            }
            catch (error) {
                console.error('Print error:', error);
                throw new errors_1.ValidationError(`Print failed: ${error.message || 'Unknown error'}`);
            }
        }
    }
    /**
     * Print test page to verify printer connection
     */
    async printTestPage(printerId) {
        const config = await this.getPrinterConfig(printerId);
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
        }
        else {
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
        }
        else {
            try {
                const isConnected = await printer.isPrinterConnected();
                if (!isConnected) {
                    throw new errors_1.ValidationError('Cannot connect to network printer');
                }
                await printer.execute();
                return true;
            }
            catch (error) {
                console.error('Test print error:', error);
                throw new errors_1.ValidationError(`Test print failed: ${error.message || 'Unknown error'}`);
            }
        }
    }
    /**
     * Get order with all relations needed for printing
     */
    async getOrderForPrint(orderId) {
        const order = await prisma_1.prisma.order.findUnique({
            where: { id: orderId },
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
        if (!order)
            throw new errors_1.NotFoundError('Order');
        return order;
    }
    /**
     * Build the ticket content on a printer instance
     */
    async buildTicketContent(printer, order) {
        // Get business name from config
        const config = await prisma_1.prisma.tenantConfig.findFirst();
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
                    }
                    else {
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
exports.PrinterService = PrinterService;
//# sourceMappingURL=printer.service.js.map