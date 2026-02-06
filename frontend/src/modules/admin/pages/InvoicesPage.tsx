import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Search, Filter, Eye } from 'lucide-react';
import { invoiceService, type Invoice, type InvoiceFilters } from '../../../services/invoiceService';
import { InvoiceDetail } from './components/InvoiceDetail';
import { toast } from 'sonner';

export const InvoicesPage: React.FC = () => {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [filters, setFilters] = useState<InvoiceFilters>({});
    const [searchNumber, setSearchNumber] = useState('');

    const loadInvoices = useCallback(async () => {
        setLoading(true);
        try {
            const data = await invoiceService.getAll(filters);
            setInvoices(data);
        } catch {
            toast.error('Error al cargar comprobantes');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        loadInvoices();
    }, [loadInvoices]);

    const handleSearch = async () => {
        if (!searchNumber.trim()) return;
        setLoading(true);
        try {
            const invoice = await invoiceService.getByNumber(searchNumber.trim());
            setSelectedInvoice(invoice);
        } catch {
            toast.error('Comprobante no encontrado');
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetail = async (invoice: Invoice) => {
        try {
            const detailed = await invoiceService.getByNumber(invoice.invoiceNumber);
            setSelectedInvoice(detailed);
        } catch {
            toast.error('Error al cargar detalle');
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800">Comprobantes</h1>
            </div>

            {/* Filters Row */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex flex-wrap gap-4 items-end">
                    {/* Search by number */}
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-medium text-slate-600 mb-1">Buscar por N&deg;</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={searchNumber}
                                onChange={(e) => setSearchNumber(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="Ej: REC-00001"
                                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                onClick={handleSearch}
                                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Search className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Type filter */}
                    <div className="min-w-[160px]">
                        <label className="block text-sm font-medium text-slate-600 mb-1">Tipo</label>
                        <select
                            value={filters.type || ''}
                            onChange={(e) => setFilters(prev => ({
                                ...prev,
                                type: e.target.value as InvoiceFilters['type'] || undefined,
                            }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Todos</option>
                            <option value="RECEIPT">Ticket</option>
                            <option value="INVOICE_B">Factura B</option>
                        </select>
                    </div>

                    {/* Date range */}
                    <div className="min-w-[150px]">
                        <label className="block text-sm font-medium text-slate-600 mb-1">Desde</label>
                        <input
                            type="date"
                            value={filters.startDate || ''}
                            onChange={(e) => setFilters(prev => ({
                                ...prev,
                                startDate: e.target.value || undefined,
                            }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="min-w-[150px]">
                        <label className="block text-sm font-medium text-slate-600 mb-1">Hasta</label>
                        <input
                            type="date"
                            value={filters.endDate || ''}
                            onChange={(e) => setFilters(prev => ({
                                ...prev,
                                endDate: e.target.value || undefined,
                            }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Clear filters */}
                    <button
                        onClick={() => { setFilters({}); setSearchNumber(''); }}
                        className="px-3 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1"
                    >
                        <Filter className="w-4 h-4" />
                        Limpiar
                    </button>
                </div>
            </div>

            {/* Invoice Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Cargando...</div>
                ) : invoices.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p>No se encontraron comprobantes</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">N&deg;</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Fecha</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Tipo</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Cliente</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Total</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {invoices.map((invoice) => (
                                <tr key={invoice.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 text-sm font-medium text-slate-800">
                                        {invoice.invoiceNumber}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600">
                                        {formatDate(invoice.createdAt)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            invoice.type === 'RECEIPT'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-blue-100 text-blue-700'
                                        }`}>
                                            {invoice.type === 'RECEIPT' ? 'Ticket' : 'Factura B'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600">
                                        {invoice.clientName || 'Consumidor Final'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right font-medium text-slate-800">
                                        {formatCurrency(invoice.total)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            onClick={() => handleViewDetail(invoice)}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                                            title="Ver detalle"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Invoice Detail Modal */}
            {selectedInvoice && (
                <InvoiceDetail
                    invoice={selectedInvoice}
                    onClose={() => setSelectedInvoice(null)}
                />
            )}
        </div>
    );
};

export default InvoicesPage;
