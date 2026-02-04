
import React from 'react';
import { usePOSStore } from '../../../../store/pos.store';
import { Trash2, Plus, Minus, CreditCard, Lock, ShoppingCart as CartIcon } from 'lucide-react';
import type { OrderItemResponse } from '../../../../services/orderService';

interface ShoppingCartProps {
    onCheckout: () => void;
    checkoutLabel?: string;
    existingItems?: OrderItemResponse[];
}

export const ShoppingCart: React.FC<ShoppingCartProps> = ({ onCheckout, checkoutLabel = "PAY", existingItems = [] }) => {
  const { cart, removeFromCart, updateQuantity, total } = usePOSStore();
  const cartTotal = total();

  // Calculate existing items total (including modifiers)
  const existingTotal = existingItems.reduce((sum, item) => {
      const price = item.product?.price ? Number(item.product.price) : (item.unitPrice ? Number(item.unitPrice) : 0);
      const baseTotal = price * item.quantity;
      const modifiersTotal = (item.modifiers || []).reduce((acc: number, m: { priceCharged?: string | number }) =>
          acc + Number(m.priceCharged || 0), 0) * item.quantity;
      return sum + baseTotal + modifiersTotal;
  }, 0);

  const grandTotal = cartTotal + existingTotal;
  const itemCount = cart.length + existingItems.length;

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header - Clean & Informative */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground text-lg">Orden</h2>
          {itemCount > 0 && (
            <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>
      </div>

      {/* Items List - Optimized for scanning */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* Existing Items (Locked) */}
        {existingItems.length > 0 && (
            <div className="mb-3 pb-3 border-b border-dashed border-border">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Lock size={10} /> Enviado a cocina
                </p>
                {existingItems.map((item, index) => {
                    const itemBasePrice = Number(item.unitPrice || item.product?.price || 0);
                    const modifiersPrice = (item.modifiers || []).reduce((acc: number, m: { priceCharged?: string | number }) =>
                        acc + Number(m.priceCharged || 0), 0);
                    const itemTotalPrice = (itemBasePrice + modifiersPrice) * item.quantity;

                    return (
                    <div key={`existing-${item.id || index}`} className="flex items-center justify-between py-2 opacity-60">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-xs font-medium text-muted-foreground bg-muted w-6 h-6 rounded flex items-center justify-center">
                                {item.quantity}
                            </span>
                            <span className="text-sm text-foreground truncate">{item.product?.name || item.name || 'Producto'}</span>
                        </div>
                        <span className="font-mono text-sm text-muted-foreground">${itemTotalPrice.toFixed(2)}</span>
                    </div>
                )})}
            </div>
        )}

        {/* New Items - Easy to modify */}
        {cart.map((item) => {
            const itemBasePrice = Number(item.product.price);
            const modifiersPrice = item.modifiers?.reduce((acc, m) => acc + Number(m.priceOverlay), 0) || 0;
            const itemTotalPrice = (itemBasePrice + modifiersPrice) * item.quantity;

            return (
          <div
            key={item.id}
            className="group flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            {/* Quantity Controls - Always visible for quick edits */}
            <div className="flex items-center bg-muted rounded-md">
                <button
                    onClick={() => updateQuantity(item.id, -1)}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-l-md transition-colors"
                >
                    <Minus size={14} />
                </button>
                <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                <button
                     onClick={() => updateQuantity(item.id, 1)}
                     className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-r-md transition-colors"
                >
                    <Plus size={14} />
                </button>
            </div>

            {/* Item Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-medium text-foreground leading-tight">{item.product.name}</h4>
                <span className="font-mono text-sm font-semibold text-foreground whitespace-nowrap">
                    ${itemTotalPrice.toFixed(2)}
                </span>
              </div>

              {/* Modifiers - Compact */}
              {item.modifiers && item.modifiers.length > 0 && (
                  <div className="mt-0.5">
                      {item.modifiers.map((mod, idx) => (
                          <span key={idx} className="text-xs text-muted-foreground">
                              +{mod.name}{mod.priceOverlay > 0 && ` ($${Number(mod.priceOverlay).toFixed(0)})`}
                              {idx < item.modifiers!.length - 1 && ', '}
                          </span>
                      ))}
                  </div>
              )}

              {/* Notes */}
              {item.notes && (
                  <p className="text-xs text-amber-600 mt-1">📝 {item.notes}</p>
              )}
            </div>

            {/* Delete - Visible on hover */}
            <button
                onClick={() => removeFromCart(item.id)}
                className="p-1.5 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded opacity-0 group-hover:opacity-100 transition-all"
            >
                <Trash2 size={14} />
            </button>
          </div>
        )})}

        {/* Empty State */}
        {cart.length === 0 && existingItems.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-8">
                <CartIcon className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Carrito vacío</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Toca un producto para agregar</p>
            </div>
        )}
      </div>

      {/* Footer / Totals - Clean & Prominent */}
      <div className="p-4 border-t border-border bg-muted/30">
        {/* Total - Large & Clear */}
        <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-mono text-2xl font-bold text-foreground">
                ${grandTotal.toFixed(2)}
            </span>
        </div>

        {/* Checkout Button - Maximum size for easy touch */}
        <button
            onClick={onCheckout}
            disabled={cart.length === 0 && existingItems.length === 0}
            className="
              w-full
              bg-primary hover:bg-primary/90
              disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed
              text-primary-foreground
              py-4 rounded-lg
              font-semibold text-base
              flex items-center justify-center gap-2
              transition-colors
              active:scale-[0.99]
              focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2
            "
        >
            <CreditCard size={20} />
            {checkoutLabel === "PAY" ? "Cobrar" : checkoutLabel}
        </button>
      </div>
    </div>
  );
};
