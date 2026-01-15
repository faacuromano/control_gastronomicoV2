
import React, { useState, useEffect } from 'react';
import { usePOSStore } from '../../../../store/pos.store';
import { orderService, type OrderResponse } from '../../../../services/orderService';
import { X, CreditCard, Banknote, QrCode, Loader2, AlertCircle, Smartphone, Printer, CheckCircle, Trash2, Plus } from 'lucide-react';
import { Receipt } from './Receipt';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (method: string, payments?: { method: string; amount: number }[]) => void;
  tableMode?: boolean; // When true, don't create order, just pass payments to parent
  totalAmount?: number; // Override store total (used for tables with existing items)
}

const ENABLED_METHODS = [
    { id: 'CASH', label: 'Efectivo', icon: Banknote },
    { id: 'QR_INTEGRATED', label: 'Mercado Pago QR', icon: QrCode },
    { id: 'CARD', label: 'Tarjeta (D/C)', icon: CreditCard },
    { id: 'TRANSFER', label: 'Transferencia', icon: Smartphone },
];

interface PaymentEntry {
    method: string;
    amount: number;
    label: string;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, onConfirm, tableMode = false, totalAmount }) => {
  const storeTotal = usePOSStore((state) => state.total());
  const total = totalAmount !== undefined ? totalAmount : storeTotal;
  
  const cart = usePOSStore((state) => state.cart);
  const clearCart = usePOSStore((state) => state.clearCart);
  
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [currentMethod, setCurrentMethod] = useState<string>('CASH');
  const [currentAmount, setCurrentAmount] = useState<number>(0);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<OrderResponse | null>(null);

  // Calculate remaining balance
  const totalPaid = payments.reduce((acc, curr) => acc + curr.amount, 0);
  const remaining = Math.max(0, total - totalPaid);

  // Track previous isOpen to detect when modal opens
  const prevIsOpenRef = React.useRef(false);

  // Reset all state ONLY when modal opens (transitions from closed to open)
  useEffect(() => {
      if (isOpen && !prevIsOpenRef.current) {
          // Modal just opened - reset all state
          setCompletedOrder(null);
          setPayments([]);
          setError(null);
          setLoading(false);
          setCurrentMethod('CASH');
      }
      prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  // Update current amount when remaining balance changes
  useEffect(() => {
      if (isOpen && remaining > 0) {
          setCurrentAmount(remaining);
      }
  }, [isOpen, remaining]);

  if (!isOpen) return null;

  const handleClose = () => {
      setCompletedOrder(null);
      setPayments([]);
      setCurrentMethod('CASH');
      setError(null);
      onClose();
  };

  const addPayment = () => {
      if (currentAmount <= 0) return;
      
      const methodData = ENABLED_METHODS.find(m => m.id === currentMethod);
      const existingIndex = payments.findIndex(p => p.method === currentMethod);

      if (existingIndex >= 0) {
          const newPayments = [...payments];
          newPayments[existingIndex].amount += currentAmount;
          setPayments(newPayments);
      } else {
          setPayments([...payments, {
              method: currentMethod,
              amount: currentAmount,
              label: methodData?.label || currentMethod
          }]);
      }
      
      // Auto-focus back to input? 
  };

  const removePayment = (index: number) => {
      const newPayments = [...payments];
      newPayments.splice(index, 1);
      setPayments(newPayments);
  };

  const handleConfirm = async () => {
    try {
        setLoading(true);
        setError(null);
        
        let finalPayments = [...payments];
        const totalPaidCheck = finalPayments.reduce((sum, p) => sum + p.amount, 0);

        // Check for underpayment (tolerance 0.01)
        if (totalPaidCheck < total - 0.01) {
             setError('El total no ha sido cubierto completamente.');
             setLoading(false);
             return;
        }
        
        // Handle Overpayment (Change)
        if (totalPaidCheck > total + 0.01) {
            // Find CASH payment to reduce
            const cashIndex = finalPayments.findIndex(p => p.method === 'CASH');
            if (cashIndex >= 0) {
                // Calculate how much we need to reduce to match total exactly
                const overpaidAmount = totalPaidCheck - total;
                // Reduce the registered payment amount to match the exact cost
                // The 'change' is implicit physically, but system records exact revenue.
                finalPayments[cashIndex].amount -= overpaidAmount;
            } else {
                // Overpayment with Card? Warn user? 
                // For now, we'll clamp the last payment or similar, or just allow it but warn.
                // Or better, just record exact total for the last added payment.
                // Simple approach: Clamp the last payment to make sum == total
                 const lastIdx = finalPayments.length - 1;
                 const othersSum = finalPayments.reduce((acc, p, idx) => idx === lastIdx ? acc : acc + p.amount, 0);
                 finalPayments[lastIdx].amount = total - othersSum;
            }
        }

        // Table mode: pass payments to parent to handle table close
        if (tableMode) {
            const paymentData = finalPayments.map(p => ({
                method: p.method,
                amount: p.amount
            }));
            onConfirm('SPLIT', paymentData);
            handleClose();
            return;
        }

        // Normal mode: create order directly
        const order = await orderService.create({
            items: cart.map(item => ({
                productId: item.product.id,
                quantity: item.quantity,
                notes: item.notes
            })),
            payments: finalPayments.map(p => ({
                method: p.method,
                amount: p.amount
            })),
            channel: 'POS'
        });

        // Success - show success screen (modal stays open until user clicks "Nueva Orden")
        clearCart();
        setCompletedOrder(order); 
    } catch (err: any) {
        console.error("Order failed", err);
        setError(err.response?.data?.message || 'Failed to create order');
    } finally {
        setLoading(false);
    }
  };

  const handlePrint = () => {
      const content = document.getElementById('receipt-hidden-container')?.innerHTML;
      if (!content) return;
      const printWindow = window.open('', '', 'height=600,width=400');
      if (printWindow) {
          printWindow.document.write('<html><head><title>Receipt</title></head><body>');
          printWindow.document.write(content);
          printWindow.document.write('</body></html>');
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h2 className="text-lg font-bold text-slate-800">
                {completedOrder ? 'Orden Finalizada' : 'Checkout'}
            </h2>
            <button onClick={handleClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} className="text-slate-500" />
            </button>
        </div>
        
        <div className="p-6">
            {completedOrder ? (
                <div className="flex flex-col items-center animate-in fade-in fill-mode-forwards">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
                        <CheckCircle size={40} />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">¡Pago Exitoso!</h3>
                    <p className="text-slate-500 mb-8">Orden #{completedOrder.orderNumber}</p>
                    
                     {/* Hidden Receipt */}
                     <div id="receipt-hidden-container" className="hidden">
                        <Receipt order={completedOrder} />
                    </div>

                    <div className="flex gap-4 w-full">
                        <button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-2 bg-slate-100 font-bold py-3 rounded-xl">
                            <Printer size={20} /> Imprimir
                        </button>
                        <button onClick={handleClose} className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl">
                            Nueva Orden
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Totals Header */}
                    <div className="text-center mb-6">
                        <p className="text-slate-500">Total a Pagar</p>
                        <div className="text-4xl font-black text-indigo-600">${total.toFixed(2)}</div>
                        {remaining > 0 && totalPaid > 0 && (
                            <p className="text-red-500 font-bold mt-1">Faltan: ${remaining.toFixed(2)}</p>
                        )}
                        {remaining === 0 && totalPaid <= total + 0.01 && (
                            <p className="text-green-600 font-bold mt-1">¡Total Cubierto!</p>
                        )}
                        {totalPaid > total + 0.01 && (
                             <p className="text-blue-600 font-bold mt-1">Su Vuelto: ${(totalPaid - total).toFixed(2)}</p>
                        )}
                    </div>

                    {/* Payment Input Section */}
                    {remaining > 0.01 && (
                        <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                             <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Agregar Pago</p>
                             <div className="grid grid-cols-2 gap-2 mb-3">
                                {ENABLED_METHODS.map((m) => (
                                    <button 
                                        key={m.id}
                                        onClick={() => setCurrentMethod(m.id)}
                                        className={`p-2 rounded-lg text-sm font-bold border transition-all flex items-center justify-center gap-2 ${currentMethod === m.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                                    >
                                        <m.icon size={16} /> {m.label}
                                    </button>
                                ))}
                             </div>
                             
                             <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                    <input 
                                        type="number" 
                                        value={currentAmount}
                                        onChange={(e) => setCurrentAmount(parseFloat(e.target.value) || 0)}
                                        className="w-full pl-8 pr-3 py-3 rounded-lg border border-slate-300 font-bold text-lg"
                                        min="0"
                                    />
                                </div>
                                <button 
                                    onClick={addPayment}
                                    className="bg-indigo-600 text-white px-4 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50"
                                    disabled={currentAmount <= 0}
                                >
                                    <Plus size={24} />
                                </button>
                             </div>
                        </div>
                    )}

                    {/* Payment List */}
                    <div className="mb-6 space-y-2">
                        {payments.map((p, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-700">{p.label}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-lg">${p.amount.toFixed(2)}</span>
                                    <button onClick={() => removePayment(idx)} className="text-red-400 hover:text-red-600">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <button 
                        onClick={handleConfirm}
                        disabled={loading || remaining > 0.01}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:text-slate-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-green-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : 'Confirmar Pago'}
                    </button>
                </>
            )}
        </div>
      </div>
    </div>
  );
};
