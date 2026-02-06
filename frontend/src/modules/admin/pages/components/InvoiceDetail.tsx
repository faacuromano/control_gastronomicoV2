import React from 'react';
import { X, Printer, FileText } from 'lucide-react';
import type { Invoice } from '../../../../services/invoiceService';

interface InvoiceDetailProps {
    invoice: Invoice;
    onClose: () => void;
}

export const InvoiceDetail: React.FC<InvoiceDetailProps> = ({ invoice, onClose }) => {

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
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

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-bold text-slate-800">
                            {invoice.type === 'RECEIPT' ? 'Ticket' : 'Factura B'} {invoice.invoiceNumber}
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors print:hidden"
                            title="Imprimir"
                        >
                            <Printer className="w-5 h-5" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors print:hidden"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Print-optimized content */}
                <div className="p-6 space-y-5" id="invoice-print-area">
                    {/* Invoice Info */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-slate-500">Comprobante:</span>
                            <p className="font-medium text-slate-800">{invoice.invoiceNumber}</p>
                        </div>
                        <div>
                            <span className="text-slate-500">Fecha:</span>
                            <p className="font-medium text-slate-800">{formatDate(invoice.createdAt)}</p>
                        </div>
                        <div>
                            <span className="text-slate-500">Tipo:</span>
                            <p className="font-medium text-slate-800">
                                {invoice.type === 'RECEIPT' ? 'Ticket' : 'Factura B'}
                            </p>
                        </div>
                        {invoice.order && (
                            <div>
                                <span className="text-slate-500">Orden N&deg;:</span>
                                <p className="font-medium text-slate-800">{invoice.order.orderNumber}</p>
                            </div>
                        )}
                    </div>

                    {/* Client Info */}
                    <div className="bg-slate-50 rounded-lg p-4 text-sm">
                        <h3 className="font-semibold text-slate-700 mb-2">Cliente</h3>
                        <p className="text-slate-800">{invoice.clientName || 'Consumidor Final'}</p>
                        {invoice.clientTaxId && (
                            <p className="text-slate-600">CUIT/DNI: {invoice.clientTaxId}</p>
                        )}
                    </div>

                    {/* Items */}
                    {invoice.order?.items && invoice.order.items.length > 0 && (
                        <div>
                            <h3 className="font-semibold text-slate-700 mb-2 text-sm">Items</h3>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="text-left py-2 text-slate-500 font-medium">Producto</th>
                                        <th className="text-center py-2 text-slate-500 font-medium">Cant.</th>
                                        <th className="text-right py-2 text-slate-500 font-medium">P. Unit.</th>
                                        <th className="text-right py-2 text-slate-500 font-medium">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {invoice.order.items.map((item) => (
                                        <tr key={item.id}>
                                            <td className="py-2 text-slate-800">{item.product.name}</td>
                                            <td className="py-2 text-center text-slate-600">{item.quantity}</td>
                                            <td className="py-2 text-right text-slate-600">{formatCurrency(item.unitPrice)}</td>
                                            <td className="py-2 text-right font-medium text-slate-800">
                                                {formatCurrency(item.quantity * item.unitPrice)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Totals */}
                    <div className="border-t border-slate-200 pt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Subtotal</span>
                            <span className="text-slate-800">{formatCurrency(invoice.subtotal)}</span>
                        </div>
                        {invoice.tax > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">IVA</span>
                                <span className="text-slate-800">{formatCurrency(invoice.tax)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
                            <span className="text-slate-800">Total</span>
                            <span className="text-slate-800">{formatCurrency(invoice.total)}</span>
                        </div>
                    </div>

                    {/* Payments */}
                    {invoice.order?.payments && invoice.order.payments.length > 0 && (
                        <div className="bg-green-50 rounded-lg p-4">
                            <h3 className="font-semibold text-green-700 mb-2 text-sm">Pagos</h3>
                            {invoice.order.payments.map((payment) => (
                                <div key={payment.id} className="flex justify-between text-sm">
                                    <span className="text-green-600">{payment.method}</span>
                                    <span className="font-medium text-green-800">{formatCurrency(payment.amount)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
