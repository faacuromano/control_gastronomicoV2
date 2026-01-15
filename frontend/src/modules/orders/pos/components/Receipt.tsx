import React from 'react';

export interface ReceiptProps {
    order: any; // Type accurately if possible
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
                {order.items?.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between">
                        <span>{item.quantity} x {item.product?.name || 'Item'}</span>
                        <span>${Number(item.unitPrice * item.quantity).toFixed(2)}</span>
                    </div>
                ))}
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
