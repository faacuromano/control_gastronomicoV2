import api from '../lib/api';

export type PrinterConnectionType = 'NETWORK' | 'USB';

export interface Printer {
  id: number;
  name: string;
  connectionType: PrinterConnectionType;
  ipAddress: string | null;
  windowsName: string | null;
  categories: { id: number; name: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePrinterData {
  name: string;
  connectionType: PrinterConnectionType;
  ipAddress?: string;
  windowsName?: string;
}

export interface UpdatePrinterData {
  name?: string;
  connectionType?: PrinterConnectionType;
  ipAddress?: string;
  windowsName?: string;
}

class PrinterService {
  /**
   * Get all configured printers
   */
  async getAll(): Promise<Printer[]> {
    const response = await api.get('/print/printers');
    return response.data.data;
  }

  /**
   * Get available Windows system printers
   */
  async getSystemPrinters(): Promise<string[]> {
    const response = await api.get('/print/printers/system');
    return response.data.data;
  }

  /**
   * Create a new printer
   */
  async create(data: CreatePrinterData): Promise<Printer> {
    const response = await api.post('/print/printers', data);
    return response.data.data;
  }

  /**
   * Update an existing printer
   */
  async update(id: number, data: UpdatePrinterData): Promise<Printer> {
    const response = await api.put(`/print/printers/${id}`, data);
    return response.data.data;
  }

  /**
   * Delete a printer
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/print/printers/${id}`);
  }

  /**
   * Print test page to verify connection
   */
  async printTestPage(printerId: number): Promise<void> {
    await api.post(`/print/test/${printerId}`);
  }

  /**
   * Print order ticket to a specific printer
   */
  async printOrder(orderId: number, printerId: number): Promise<void> {
    await api.post(`/print/${orderId}/device/${printerId}`);
  }

  /**
   * Print pre-account (cuenta) - ticket for customer before payment
   * Shows items and total without payment info
   */
  async printPreAccount(orderId: number, printerId: number): Promise<void> {
    await api.post(`/print/${orderId}/preaccount/${printerId}`);
  }

  /**
   * Generate ticket buffer for preview/local printing
   */
  async generateTicket(orderId: number): Promise<string> {
    const response = await api.get(`/print/${orderId}`);
    return response.data.data.base64;
  }
}

export const printerService = new PrinterService();
