
import React from 'react';
import { usePOSStore } from '../../../../store/pos.store';
import { Trash2, Plus, Minus, CreditCard, Lock } from 'lucide-react';

interface ShoppingCartProps {
    onCheckout: () => void;
    checkoutLabel?: string;
    existingItems?: any[];
}

export const ShoppingCart: React.FC<ShoppingCartProps> = ({ onCheckout, checkoutLabel = "PAY", existingItems = [] }) => {
  const { cart, removeFromCart, updateQuantity, total } = usePOSStore();
  const cartTotal = total();
  
  // Calculate existing items total
  const existingTotal = existingItems.reduce((sum, item) => {
      const price = item.product?.price ? Number(item.product.price) : (item.unitPrice ? Number(item.unitPrice) : 0);
      return sum + (price * item.quantity);
  }, 0);

  const grandTotal = cartTotal + existingTotal;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <h2 className="text-xl font-bold text-slate-800 flex items-center justify-between">
            Orden Actual
            <span className="text-sm font-normal text-slate-500 bg-slate-200 px-2 py-1 rounded-full">
                {cart.length + existingItems.length} items
            </span>
        </h2>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Existing Items Section */}
        {existingItems.length > 0 && (
            <div className="mb-4 pb-4 border-b border-dashed border-slate-200">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ya Comandado</h3>
                {existingItems.map((item, index) => (
                    <div key={`existing-${item.id || index}`} className="flex justify-between items-start p-2 rounded-lg bg-slate-50 opacity-75">
                        <div className="flex-1">
                            <h4 className="font-medium text-slate-700 flex items-center gap-2">
                                <Lock size={12} className="text-slate-400" />
                                {item.product?.name || item.name || 'Producto'}
                            </h4>
                            <p className="text-sm text-slate-500">
                                ${Number(item.unitPrice || item.product?.price || 0).toFixed(2)} x {item.quantity}
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <span className="font-bold text-slate-600">
                                ${(Number(item.unitPrice || item.product?.price || 0) * item.quantity).toFixed(2)}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* New Items Section */}
        {cart.length > 0 && existingItems.length > 0 && (
             <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">Nuevos Items</h3>
        )}

        {cart.map((item) => (
          <div key={item.id} className="flex justify-between items-start group p-2 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-indigo-100">
            <div className="flex-1">
              <h4 className="font-medium text-slate-900">{item.product.name}</h4>
              <p className="text-sm text-slate-500">${Number(item.product.price).toFixed(2)}</p>
            </div>
            
            <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-1 py-0.5 shadow-sm">
                    <button 
                        onClick={() => updateQuantity(item.id, -1)}
                        className="p-1 hover:bg-slate-100 rounded-md text-slate-600 transition-colors"
                        disabled={item.quantity <= 1}
                    >
                        <Minus size={14} />
                    </button>
                    <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                    <button 
                         onClick={() => updateQuantity(item.id, 1)}
                         className="p-1 hover:bg-slate-100 rounded-md text-slate-600 transition-colors"
                    >
                        <Plus size={14} />
                    </button>
                </div>
                <div className="flex items-center gap-4">
                     <span className="font-bold text-slate-800">${(Number(item.product.price) * item.quantity).toFixed(2)}</span>
                     <button 
                        onClick={() => removeFromCart(item.id)}
                        className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                     >
                        <Trash2 size={16} />
                     </button>
                </div>
            </div>
          </div>
        ))}
        
        {cart.length === 0 && existingItems.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                <div className="mb-4">Carrito Vacío</div>
            </div>
        )}
      </div>

      {/* Footer / Totals */}
      <div className="p-6 bg-slate-50 border-t border-slate-200">
        <div className="flex justify-between items-center mb-2">
            <span className="text-slate-500">Subtotal</span>
            <span className="text-slate-800 font-medium">${grandTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center mb-6">
            <span className="text-slate-500">Impuestos</span>
            <span className="text-slate-800 font-medium">$0.00</span>
        </div>
        
        <div className="flex justify-between items-center mb-6 pt-4 border-t border-slate-200">
            <span className="text-xl font-bold text-slate-900">Total</span>
            <span className="text-2xl font-bold text-indigo-600">${grandTotal.toFixed(2)}</span>
        </div>

        <button 
            onClick={onCheckout}
            disabled={cart.length === 0 && existingItems.length === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
            <CreditCard size={20} />
            {checkoutLabel === "PAY" ? "Cobrar" : checkoutLabel}
        </button>
      </div>
    </div>
  );
};
