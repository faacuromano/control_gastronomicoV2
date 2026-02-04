
import React, { useState, useEffect } from 'react';
import { usePOSStore } from '../../../../store/pos.store';
import { orderService, type OrderResponse } from '../../../../services/orderService';
import { invoiceService } from '../../../../services/invoiceService';
import { paymentMethodService, type PaymentMethodConfig } from '../../../../services/paymentMethodService';
import { printerService, type Printer as PrinterConfig } from '../../../../services/printerService';
import { loyaltyService, type LoyaltyBalance, type LoyaltyConfig } from '../../../../services/loyaltyService';
import { calculateDiscountPreview, type DiscountType } from '../../../../services/discountService';
import { X, CreditCard, Banknote, QrCode, Loader2, AlertCircle, Smartphone, Printer, CheckCircle, Trash2, Plus, FileText, ArrowLeftRight, Wallet, Star, Gift, Percent } from 'lucide-react';
import { Receipt } from './Receipt';
import { toast } from 'sonner';
import { getErrorMessage } from '../../../../lib/errorUtils';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (method: string, payments?: { method: string; amount: number }[], discount?: number) => Promise<OrderResponse | void>;
  tableMode?: boolean; // When true, don't create order, just pass payments to parent
  tableId?: number; // Table ID for fetching fresh order total
  totalAmount?: number; // Override store total (used for tables with existing items)
}

// Icon mapping for dynamic payment methods
const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
    Banknote,
    CreditCard,
    QrCode,
    Smartphone,
    ArrowLeftRight,
    Wallet,
};

// Fallback for unmapped icons
const DEFAULT_ICON = CreditCard;

interface PaymentEntry {
    method: string;
    amount: number;
    label: string;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, onConfirm, tableMode = false, tableId, totalAmount }) => {
  const storeTotal = usePOSStore((state) => state.total());
  
  // State for backend-fetched total (used in tableMode)
  const [backendTotal, setBackendTotal] = useState<number | null>(null);
  
  // Use backend total if available (tableMode), otherwise fallback to prop/store
  const total = backendTotal !== null ? backendTotal : (totalAmount !== undefined ? totalAmount : storeTotal);
  
  const clearCart = usePOSStore((state) => state.clearCart);
  
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [currentMethod, setCurrentMethod] = useState<string>('CASH');
  const [currentAmount, setCurrentAmount] = useState<number>(0);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<OrderResponse | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>([]);
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(null);
  const [cachedOrder, setCachedOrder] = useState<OrderResponse | null>(null); // Cache order for print after table close
  
  // Loyalty state
  const selectedClientId = usePOSStore((state) => state.selectedClientId);
  const [loyaltyBalance, setLoyaltyBalance] = useState<LoyaltyBalance | null>(null);
  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfig | null>(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [redeemedDiscount, setRedeemedDiscount] = useState(0);

  // Manual discount state
  const [manualDiscountType, setManualDiscountType] = useState<DiscountType>('PERCENTAGE');
  const [manualDiscountValue, setManualDiscountValue] = useState(0);
  const [manualDiscountApplied, setManualDiscountApplied] = useState(0);
  const [showDiscountSection, setShowDiscountSection] = useState(false);

  // Calculate remaining balance (accounting for loyalty and manual discounts)
  const totalDiscounts = redeemedDiscount + manualDiscountApplied;
  const effectiveTotal = Math.max(0, total - totalDiscounts);
  const totalPaid = payments.reduce((acc, curr) => acc + curr.amount, 0);
  const remaining = Math.max(0, effectiveTotal - totalPaid);

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
          setInvoiceNumber(null);
          setGeneratingInvoice(false);
          setBackendTotal(null);
          setPointsToRedeem(0);
          setRedeemedDiscount(0);
          setLoyaltyBalance(null);
          // Reset manual discount
          setManualDiscountType('PERCENTAGE');
          setManualDiscountValue(0);
          setManualDiscountApplied(0);
          setShowDiscountSection(false);
          setCachedOrder(null); // Reset cached order
          
          // FIX WF-001: Parallel async loads instead of sequential
          const initializeModal = async () => {
              try {
                  // Primary parallel loads
                  const [methods, allPrinters, config] = await Promise.all([
                      paymentMethodService.getActive().catch(() => [{ id: 0, code: 'CASH', name: 'Efectivo', icon: 'Banknote', isActive: true, sortOrder: 1 }]),
                      printerService.getAll().catch(() => []),
                      loyaltyService.getConfig().catch(() => null),
                  ]);
                  
                  setPaymentMethods(methods.sort((a, b) => a.sortOrder - b.sortOrder));
                  if (methods.length > 0) {
                      setCurrentMethod(methods[0].code);
                  }
                  setPrinters(allPrinters);
                  if (config) setLoyaltyConfig(config);
                  
                  // Secondary parallel loads (based on props)
                  const secondaryLoads: Promise<void>[] = [];
                  
                  if (selectedClientId) {
                      secondaryLoads.push(
                          loyaltyService.getBalance(selectedClientId)
                              .then(balance => setLoyaltyBalance(balance))
                              .catch(err => console.error('Failed to load loyalty balance:', err))
                      );
                  }
                  
                  if (tableMode && tableId) {
                      secondaryLoads.push(
                          orderService.getOrderByTable(tableId)
                              .then(order => {
                                  if (order) {
                                      setBackendTotal(Number(order.total));
                                      setCurrentOrderId(order.id);
                                      setCachedOrder(order);
                                  }
                              })
                              .catch(err => console.error('Failed to load order total:', err))
                      );
                  }
                  
                  if (secondaryLoads.length > 0) {
                      await Promise.all(secondaryLoads);
                  }
              } catch (err) {
                  console.error('CheckoutModal initialization failed:', err);
              }
          };
          
          initializeModal();
      }
      prevIsOpenRef.current = isOpen;
  }, [isOpen, tableMode, tableId, selectedClientId]);

  // Helper functions removed - now using Promise.all in useEffect for parallel loading

  const handleRedeemPoints = () => {
      if (!loyaltyBalance || !loyaltyConfig || pointsToRedeem <= 0) return;
      if (pointsToRedeem > loyaltyBalance.points) {
          setError('No tienes suficientes puntos');
          return;
      }
      // Calculate discount
      const discount = pointsToRedeem / loyaltyConfig.pointsToRedeemValue;
      // Don't exceed the total
      const cappedDiscount = Math.min(discount, total);
      setRedeemedDiscount(cappedDiscount);
      // Add as payment entry
      setPayments(prev => [
          ...prev.filter(p => p.method !== 'POINTS'),
          { method: 'POINTS', amount: cappedDiscount, label: `Puntos (${pointsToRedeem} pts)` }
      ]);
  };

  const handleRemovePointsRedemption = () => {
      setRedeemedDiscount(0);
      setPointsToRedeem(0);
      setPayments(prev => prev.filter(p => p.method !== 'POINTS'));
  };

  // Handle manual discount application
  const handleApplyManualDiscount = () => {
      if (manualDiscountValue <= 0) return;
      const discountAmount = calculateDiscountPreview(total, manualDiscountType, manualDiscountValue);
      setManualDiscountApplied(discountAmount);
      setShowDiscountSection(false);
  };

  const handleRemoveManualDiscount = () => {
      setManualDiscountApplied(0);
      setManualDiscountValue(0);
      setManualDiscountType('PERCENTAGE');
  };

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
      setInvoiceNumber(null);
      onClose();
  };

  const handleGenerateInvoice = async () => {
      if (!completedOrder) return;
      setGeneratingInvoice(true);
      try {
          const invoice = await invoiceService.generate({ 
              orderId: completedOrder.id,
              type: 'RECEIPT'
          });
          setInvoiceNumber(invoice.invoiceNumber);
      } catch (err: unknown) {
          console.error('Failed to generate invoice', err);
          toast.error(getErrorMessage(err, 'Error al generar comprobante'));
      } finally {
          setGeneratingInvoice(false);
      }
  };

  const addPayment = () => {
      if (currentAmount <= 0) return;
      
      const methodData = paymentMethods.find(m => m.code === currentMethod);
      const existingIndex = payments.findIndex(p => p.method === currentMethod);

      if (existingIndex >= 0) {
          const newPayments = [...payments];
          newPayments[existingIndex].amount += currentAmount;
          setPayments(newPayments);
      } else {
          setPayments([...payments, {
              method: currentMethod,
              amount: currentAmount,
              label: methodData?.name || currentMethod
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
        // IMPORTANT: Use effectiveTotal (after discounts) not raw total
        if (totalPaidCheck < effectiveTotal - 0.01) {
             setError('El total no ha sido cubierto completamente.');
             setLoading(false);
             return;
        }
        
        // Handle Overpayment (Change)
        if (totalPaidCheck > effectiveTotal + 0.01) {
            // Find CASH payment to reduce
            const cashIndex = finalPayments.findIndex(p => p.method === 'CASH');
            if (cashIndex >= 0) {
                // Calculate how much we need to reduce to match total exactly
                const overpaidAmount = totalPaidCheck - effectiveTotal;
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
                 finalPayments[lastIdx].amount = effectiveTotal - othersSum;
            }
        }

        const paymentData = finalPayments.map(p => ({
            method: p.method,
            amount: p.amount
        }));

        // Table mode: pass payments to parent to handle table close
        // But now we show success screen with print option!
        if (tableMode) {
            try {
                await onConfirm('SPLIT', paymentData, totalDiscounts > 0 ? totalDiscounts : undefined);
                // Show success screen with cached order (since table is now free)
                if (cachedOrder) {
                    setCompletedOrder(cachedOrder);
                } else {
                    handleClose();
                }
            } catch (err: unknown) {
                setError(getErrorMessage(err, 'Error al cerrar mesa'));
                setLoading(false);
            }
            return;
        }

        // Delegate order creation to parent (POSPage)
        const order = await onConfirm(
            paymentData.length === 1 ? paymentData[0].method : 'SPLIT',
            paymentData,
            totalDiscounts > 0 ? totalDiscounts : undefined
        );

        if (order) {
            // Success - show success screen (modal stays open until user clicks "Nueva Orden")
            clearCart();
            setCompletedOrder(order);
        } else {
            // If parent didn't return an order (e.g. table close), just close modal
           handleClose();
        }
    } catch (err: unknown) {
        console.error("Order failed", err);
        setError(getErrorMessage(err, 'Failed to create order'));
    } finally {
        setLoading(false);
    }
  };

  const handlePrint = async () => {
      // Try thermal printer first
      if (completedOrder && printers.length > 0) {
          setIsPrinting(true);
          try {
              // Use first configured printer
              await printerService.printOrder(completedOrder.id, printers[0].id);
              console.log('[CheckoutModal] Thermal print sent successfully');
              setIsPrinting(false);
              return;
          } catch (error) {
              console.warn('[CheckoutModal] Thermal print failed, falling back to browser print:', error);
              setIsPrinting(false);
          }
      }
      
      // Fallback to browser print
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
  


  const handlePrintPreAccount = async () => {
      if (!currentOrderId || printers.length === 0) {
          console.warn('[CheckoutModal] Cannot print pre-account: missing orderId or printers');
          return;
      }
      setIsPrinting(true);
      try {
          await printerService.printPreAccount(currentOrderId, printers[0].id);
          console.log('[CheckoutModal] Pre-account printed successfully');
      } catch (error) {
          console.error('[CheckoutModal] Failed to print pre-account:', error);
      } finally {
          setIsPrinting(false);
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card w-full max-w-lg rounded-xl shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
            <h2 className="text-lg font-semibold text-foreground">
                {completedOrder ? 'Orden Finalizada' : 'Checkout'}
            </h2>
            <button onClick={handleClose} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                <X size={18} className="text-muted-foreground" />
            </button>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto">
            {completedOrder ? (
                <div className="flex flex-col items-center">
                    {/* Success Icon */}
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle size={32} className="text-emerald-600" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-1">¡Pago Exitoso!</h3>
                    <p className="text-muted-foreground mb-6">
                        Orden <span className="font-mono font-semibold">#{completedOrder.orderNumber}</span>
                    </p>

                     {/* Hidden Receipt */}
                     <div id="receipt-hidden-container" className="hidden">
                        <Receipt order={completedOrder} />
                    </div>

                    <div className="flex flex-col gap-3 w-full">
                        {/* Invoice status */}
                        {invoiceNumber && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                                <p className="text-emerald-700 font-medium text-sm">Comprobante: <span className="font-mono">{invoiceNumber}</span></p>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                onClick={handlePrint}
                                disabled={isPrinting}
                                className="flex-1 flex items-center justify-center gap-2 bg-muted font-medium py-2.5 rounded-lg hover:bg-muted/80 text-foreground transition-colors disabled:opacity-50 text-sm"
                            >
                                {isPrinting ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                                {isPrinting ? 'Imprimiendo...' : 'Imprimir'}
                            </button>
                            {!invoiceNumber && (
                                <button
                                    onClick={handleGenerateInvoice}
                                    disabled={generatingInvoice}
                                    className="flex-1 flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 font-medium py-2.5 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50 text-sm"
                                >
                                    {generatingInvoice ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                                    Comprobante
                                </button>
                            )}
                        </div>
                        <button
                            onClick={handleClose}
                            className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-lg hover:bg-primary/90 transition-colors"
                        >
                            Nueva Orden
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Totals Header */}
                    <div className="text-center mb-6">
                        <p className="text-muted-foreground text-sm mb-1">Total a Pagar</p>
                        {totalDiscounts > 0 ? (
                            <>
                                <div className="text-lg line-through text-muted-foreground font-mono">${total.toFixed(2)}</div>
                                <div className="font-mono text-3xl font-bold text-emerald-600">${effectiveTotal.toFixed(2)}</div>
                                <p className="text-emerald-600 text-xs mt-1">
                                    Descuento: -${totalDiscounts.toFixed(2)}
                                </p>
                            </>
                        ) : (
                            <div className="font-mono text-3xl font-bold text-foreground">${total.toFixed(2)}</div>
                        )}
                        {remaining > 0 && totalPaid > 0 && (
                            <p className="text-red-600 font-medium mt-2 text-sm">
                                Faltan: ${remaining.toFixed(2)}
                            </p>
                        )}
                        {remaining === 0 && totalPaid <= effectiveTotal + 0.01 && totalPaid > 0 && (
                            <p className="text-emerald-600 font-medium mt-2 text-sm flex items-center justify-center gap-1">
                                <CheckCircle size={14} /> Total cubierto
                            </p>
                        )}
                        {totalPaid > effectiveTotal + 0.01 && (
                             <p className="text-blue-600 font-medium mt-2 text-sm">
                                Vuelto: ${(totalPaid - effectiveTotal).toFixed(2)}
                             </p>
                        )}
                    </div>

                    {/* Print Pre-Account Button - Only for table orders */}
                    {tableMode && currentOrderId && printers.length > 0 && (
                        <div className="mb-4">
                            <button
                                onClick={handlePrintPreAccount}
                                disabled={isPrinting}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-secondary hover:bg-secondary/80 text-foreground font-medium rounded-xl border border-border transition-colors disabled:opacity-50"
                            >
                                {isPrinting ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Imprimiendo...
                                    </>
                                ) : (
                                    <>
                                        <FileText size={18} />
                                        Imprimir Cuenta (Pre-Cobro)
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Loyalty Points Section */}
                    {loyaltyBalance && loyaltyConfig && !redeemedDiscount && (
                        <div className="mb-4 bg-amber-50 p-4 rounded-lg border border-amber-200">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Star className="text-amber-600" size={18} />
                                    <span className="font-semibold text-amber-800">Puntos de Lealtad</span>
                                </div>
                                <span className="font-bold text-amber-700 font-mono">{loyaltyBalance.points} pts</span>
                            </div>
                            <p className="text-xs text-amber-600 mb-3">
                                {loyaltyConfig.pointsToRedeemValue} puntos = $1 descuento
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={pointsToRedeem || ''}
                                    onChange={(e) => setPointsToRedeem(Math.min(Number(e.target.value), loyaltyBalance.points))}
                                    placeholder="Puntos a canjear"
                                    max={loyaltyBalance.points}
                                    min={0}
                                    className="flex-1 border border-amber-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                                />
                                <button
                                    onClick={handleRedeemPoints}
                                    disabled={pointsToRedeem <= 0}
                                    className="bg-amber-600 text-white px-3 py-2 rounded-lg font-semibold hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1 transition-colors text-sm"
                                >
                                    <Gift size={14} /> Canjear
                                </button>
                            </div>
                            {pointsToRedeem > 0 && (
                                <p className="text-xs text-amber-600 mt-2">
                                    = ${(pointsToRedeem / loyaltyConfig.pointsToRedeemValue).toFixed(2)} de descuento
                                </p>
                            )}
                        </div>
                    )}

                    {/* Show redeemed points summary */}
                    {redeemedDiscount > 0 && (
                        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-emerald-700">
                                <Star size={16} />
                                <span className="font-medium text-sm">Puntos canjeados</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold font-mono text-emerald-700">-${redeemedDiscount.toFixed(2)}</span>
                                <button onClick={handleRemovePointsRedemption} className="text-muted-foreground hover:text-destructive p-1">
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Manual Discount Section */}
                    {!manualDiscountApplied && !showDiscountSection && (
                        <button
                            onClick={() => setShowDiscountSection(true)}
                            className="mb-4 w-full py-2.5 px-4 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-primary hover:text-primary flex items-center justify-center gap-2 transition-colors text-sm"
                        >
                            <Percent size={14} /> Aplicar Descuento
                        </button>
                    )}

                    {showDiscountSection && !manualDiscountApplied && (
                        <div className="mb-4 bg-muted/50 p-4 rounded-lg border border-border">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Percent className="text-foreground" size={16} />
                                    <span className="font-semibold text-foreground text-sm">Descuento Manual</span>
                                </div>
                                <button onClick={() => setShowDiscountSection(false)} className="text-muted-foreground hover:text-foreground p-1">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="flex gap-2 mb-2">
                                <select
                                    value={manualDiscountType}
                                    onChange={(e) => setManualDiscountType(e.target.value as DiscountType)}
                                    className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                >
                                    <option value="PERCENTAGE">%</option>
                                    <option value="FIXED">$</option>
                                </select>
                                <input
                                    type="number"
                                    value={manualDiscountValue || ''}
                                    onChange={(e) => setManualDiscountValue(Number(e.target.value))}
                                    placeholder={manualDiscountType === 'PERCENTAGE' ? '10' : '50'}
                                    min={0}
                                    max={manualDiscountType === 'PERCENTAGE' ? 100 : total}
                                    className="flex-1 border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                                <button
                                    onClick={handleApplyManualDiscount}
                                    disabled={manualDiscountValue <= 0}
                                    className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm"
                                >
                                    Aplicar
                                </button>
                            </div>
                            {manualDiscountValue > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    = ${calculateDiscountPreview(total, manualDiscountType, manualDiscountValue).toFixed(2)} de descuento
                                </p>
                            )}
                        </div>
                    )}

                    {/* Show applied manual discount summary */}
                    {manualDiscountApplied > 0 && (
                        <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-purple-700">
                                <Percent size={16} />
                                <span className="font-medium text-sm">Descuento aplicado</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold font-mono text-purple-700">-${manualDiscountApplied.toFixed(2)}</span>
                                <button onClick={handleRemoveManualDiscount} className="text-muted-foreground hover:text-destructive p-1">
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Payment Input Section */}
                    {remaining > 0.01 && (
                        <div className="mb-6 bg-muted/50 p-4 rounded-lg border border-border">
                             <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Agregar Pago</p>
                             <div className="grid grid-cols-2 gap-2 mb-4">
                                {paymentMethods.map((m) => {
                                    const IconComponent = ICON_MAP[m.icon || ''] || DEFAULT_ICON;
                                    return (
                                        <button
                                            key={m.code}
                                            onClick={() => setCurrentMethod(m.code)}
                                            className={`
                                                p-2.5 rounded-lg text-sm font-medium border transition-colors
                                                flex items-center justify-center gap-2
                                                ${currentMethod === m.code
                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                    : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                                                }
                                            `}
                                        >
                                            <IconComponent size={16} /> {m.name}
                                        </button>
                                    );
                                })}
                             </div>

                             <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                                    <input
                                        type="number"
                                        value={currentAmount}
                                        onChange={(e) => setCurrentAmount(parseFloat(e.target.value) || 0)}
                                        className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-card border border-border text-foreground font-mono font-semibold text-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                        min="0"
                                    />
                                </div>
                                <button
                                    onClick={addPayment}
                                    className="bg-primary text-primary-foreground px-4 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    disabled={currentAmount <= 0}
                                >
                                    <Plus size={20} />
                                </button>
                             </div>
                        </div>
                    )}

                    {/* Payment List */}
                    {payments.length > 0 && (
                        <div className="mb-6 space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Pagos Registrados</p>
                            {payments.map((p, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-card border border-border rounded-lg">
                                    <span className="font-medium text-foreground">{p.label}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-semibold text-foreground">${p.amount.toFixed(2)}</span>
                                        <button onClick={() => removePayment(idx)} className="text-muted-foreground hover:text-destructive p-1 hover:bg-destructive/10 rounded transition-colors">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleConfirm}
                        disabled={loading || remaining > 0.01}
                        className="w-full py-3 rounded-lg font-semibold text-base flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : 'Confirmar Pago'}
                    </button>
                </>
            )}
        </div>
      </div>
    </div>
  );
};
