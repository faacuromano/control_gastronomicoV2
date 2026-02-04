import React from 'react';

interface ReceiptModifier {
    id?: number;
    modifierOptionId?: number;
    modifierOption?: { id: number; name: string; priceOverlay: string };
    name?: string;
    priceCharged?: string;
    priceOverlay?: number;
}

interface ReceiptItem {
    id?: number;
    productId: number;
    quantity: number;
    unitPrice?: string;
    notes?: string | null;
    product?: { id: number; name: string; price: string | number };
    modifiers?: ReceiptModifier[];
}

interface ReceiptPayment {
    id?: number;
    method: string;
    amount: string | number;
}

interface ReceiptOrder {
    id?: number;
    orderNumber: number;
    createdAt: string;
    total: string | number;
    items: ReceiptItem[];
    payments?: ReceiptPayment[];
}

export interface ReceiptProps {
    order: ReceiptOrder;
    businessName?: string;
}

export const Receipt: React.FC<ReceiptProps> = ({ order, businessName = "Restaurante Demo" }) => {
    return (
        <div id="receipt-content" className="w-[300px] bg-white p-4 text-xs font-mono text-black">
            <div className="text-center mb-4">
                <h2 className="text-lg font-bold uppercase">{businessName}</h2>
                <p>Fecha: {new Date(order.createdAt).toLocaleString()}</p>
                <p>Orden #{order.orderNumber}</p>
            </div>
            
            <div className="border-b border-black my-2"></div>
            
            <div className="flex flex-col gap-1">
                {order.items?.map((item, i) => {
                    // Handle both Backend (unitPrice/product snapshot) and Frontend Cart (product.price) structures
                    const unitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : Number(item.product?.price || 0);
                    const itemTotal = unitPrice * item.quantity;

                    return (
                        <div key={i} className="flex flex-col">
                            <div className="flex justify-between font-semibold">
                                <span>{item.quantity} x {item.product?.name || 'Item'}</span>
                                <span>${itemTotal.toFixed(2)}</span>
                            </div>
                            {/* Modifiers */}
                            {item.modifiers?.map((mod, j) => {
                                // Handle Backend (modifierOption.name, priceCharged) vs Frontend (name, priceOverlay)
                                const modName = mod.modifierOption?.name || mod.name || 'Extra';
                                const modPrice = mod.priceCharged !== undefined ? Number(mod.priceCharged) : Number(mod.priceOverlay || 0);

                                return (
                                    <div key={j} className="flex justify-between pl-4 text-[10px] text-gray-600">
                                        <span>+ {modName}</span>
                                        <span>${modPrice.toFixed(2)}</span>
                                    </div>
                                );
                            })}
                            {/* Notes */}
                            {item.notes && (
                                <div className="pl-4 text-[10px] italic">
                                    Nota: {item.notes}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="border-b border-black my-2"></div>

            <div className="flex justify-between font-bold text-sm">
                <span>TOTAL</span>
                <span>${Number(order.total).toFixed(2)}</span>
            </div>
            
            <div className="mt-4 text-center">
                <p>Método: {order.payments?.[0]?.method || 'N/A'}</p>
                <p className="mt-2 text-[10px]">¡Gracias por su visita!</p>
            </div>
        </div>
    );
};
