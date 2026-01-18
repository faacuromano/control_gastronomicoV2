export declare class PrinterService {
    /**
     * Create a printer instance configured for a specific target
     */
    private createPrinter;
    /**
     * Get printer config from database by ID
     */
    private getPrinterConfig;
    /**
     * List available Windows printers
     */
    listSystemPrinters(): Promise<string[]>;
    /**
     * Print raw ESC/POS data to a Windows USB printer
     * Uses PowerShell script with Windows winspool.drv API for true raw printing
     */
    private printToWindowsPrinter;
    /**
     * Generate a buffer-only ticket (for preview or local printing)
     */
    generateOrderTicket(orderId: number): Promise<Buffer>;
    /**
     * Print order ticket to a specific printer by printer ID
     */
    printOrderToDevice(orderId: number, printerId: number): Promise<boolean>;
    /**
     * Print test page to verify printer connection
     */
    printTestPage(printerId: number): Promise<boolean>;
    /**
     * Get order with all relations needed for printing
     */
    private getOrderForPrint;
    /**
     * Build the ticket content on a printer instance
     */
    private buildTicketContent;
}
//# sourceMappingURL=printer.service.d.ts.map