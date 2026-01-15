import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { POSLayout } from '../components/POSLayout';
import { CategoryTabs } from '../components/CategoryTabs';
import { ProductGrid } from '../components/ProductGrid';
import { ShoppingCart } from '../components/ShoppingCart';
import { CheckoutModal } from '../components/CheckoutModal';
import { usePOSStore } from '../../../../store/pos.store';
import { orderService } from '../../../../services/orderService';
import { tableService } from '../../../../services/tableService';

import { OpenShiftModal } from '../../../../components/cash/OpenShiftModal';
import { cashShiftService } from '../../../../services/cashShiftService';

import { ClientLookup } from '../components/ClientLookup';
import { DeliveryModal } from '../components/DeliveryModal';
import type { Client } from '../../../../services/clientService';
import { Truck } from 'lucide-react';

export const POSPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const orderId = searchParams.get('orderId') ? Number(searchParams.get('orderId')) : undefined;
  const action = searchParams.get('action'); // 'checkout' to skip to checkout
  const tableId = searchParams.get('tableId') ? Number(searchParams.get('tableId')) : undefined;
  
  const [activeCategoryId, setActiveCategoryId] = useState<number | undefined>(undefined);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isShiftOpen, setIsShiftOpen] = useState<boolean | null>(null);
  const [existingOrderId, setExistingOrderId] = useState<number | undefined>(orderId);
  const [orderLoaded, setOrderLoaded] = useState(false);
  
  // NEW: Store existing items separately from cart (new items)
  const [existingItems, setExistingItems] = useState<any[]>([]);

  // Delivery State
  const [isDeliveryMode, setIsDeliveryMode] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  
  const clearCart = usePOSStore((state) => state.clearCart);
  // addToCart removed as it is no longer used for existing items
  const cart = usePOSStore((state) => state.cart);

  useEffect(() => {
    checkShiftStatus();
    loadExistingOrder();
    // Clear cart on mount to avoid carrying over items from previous sessions
    clearCart(); 
  }, []);

  useEffect(() => {
    // If action=checkout, open checkout modal
    if (action === 'checkout' && orderLoaded) {
      setIsCheckoutOpen(true);
    }
  }, [action, orderLoaded]);

  const checkShiftStatus = async () => {
    try {
        const shift = await cashShiftService.getCurrentShift();
        setIsShiftOpen(!!shift);
    } catch (err) {
        setIsShiftOpen(false);
    }
  };

  const loadExistingOrder = async () => {
    if (!orderId) {
      setOrderLoaded(true);
      return;
    }

    try {
      // For now, we don't have a direct getOrderById endpoint
      // We'll load from table if tableId is present
      if (tableId) {
        const existingOrder = await orderService.getOrderByTable(tableId);
        if (existingOrder && existingOrder.id === orderId) {
          // Load existing items for DISPLAY only, DO NOT add to cart
          setExistingItems(existingOrder.items || []);
          setExistingOrderId(existingOrder.id);
        }
      }
    } catch (error) {
      console.error('Failed to load existing order:', error);
    } finally {
      setOrderLoaded(true);
    }
  };

  // Handler for saving items to table (no payment)
  const handleTableSave = async () => {
    if (cart.length === 0) return;

    try {
      const items = cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        notes: item.notes
      }));

      if (existingOrderId) {
        await orderService.addItemsToOrder(existingOrderId, items);
        clearCart();
        navigate('/tables');
      }
    } catch (error) {
      console.error("Save failed", error);
      alert("Error al guardar el pedido");
    }
  };

  // Handler for the cart button - route to save or checkout
  const handleCartAction = () => {
    // Delivery Mode Check
    if (isDeliveryMode) {
        if (!selectedClient) {
            alert("Por favor, seleccione un cliente para el delivery.");
            return;
        }
        setIsDeliveryModalOpen(true);
        return;
    }

    // Table mode without checkout action = just save items
    if (tableId && existingOrderId && action !== 'checkout') {
      handleTableSave();
    } else {
      // Direct sale or table checkout = open payment modal
      setIsCheckoutOpen(true);
    }
  };

  const handleDeliveryConfirm = async (deliveryDetails: { address: string; notes?: string }) => {
      try {
          if (!selectedClient) return;

          const items = cart.map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
            notes: item.notes
          }));

          const deliveryData = {
              address: deliveryDetails.address,
              notes: deliveryDetails.notes,
              phone: selectedClient.phone || '',
              name: selectedClient.name
          };

          await orderService.create({
              items,
              channel: 'DELIVERY_APP', // Type updated in service interface
              deliveryData,
              clientId: selectedClient.id,
              paymentMethod: 'CASH', // Default, will be updated on payment? Or assumed PENDING?
                                    // Delivery orders usually start unpaid or paid online. 
                                    // For simple POS delivery, let's assume 'CASH' (Pending Payment) or 'CARD'.
                                    // Delivery Dashboard will handle payment/status?
                                    // Let's pass 'CASH' but status 'OPEN' (Unpaid).
                                    // Actually backend sets paymentStatus based on coverage.
                                    // We need to clarify if "Confirm Delivery" means "Send to Kitchen" (Unpaid) or "Pay & Send".
                                    // Usually "Send to Kitchen". Payment happens on delivery or beforehand.
                                    // Let's assume UNPAID for now.
              payments: [] // No immediate payment
          });

          clearCart();
          setIsDeliveryModalOpen(false);
          setIsDeliveryMode(false);
          setSelectedClient(null);
          // navigate('/delivery-dashboard'); // TODO: Create this page
          alert("Pedido de Delivery creado con éxito");

      } catch (error) {
          console.error("Delivery Order Failed", error);
          alert("Error al crear pedido de delivery");
      }
  };

  const handleCheckout = async (method: string, payments?: { method: string; amount: number }[]) => {
    // 0. Handle completion signal from CheckoutModal (Order already created there)
    if (method === 'COMPLETED') {
        clearCart();
        setIsCheckoutOpen(false);
        return;
    }

    // If table checkout but cart has items, SAVE THEM first (Auto-save)
    if (existingOrderId && tableId && action === 'checkout' && cart.length > 0) {
        try {
             const newItems = cart.map(item => ({
                productId: item.product.id,
                quantity: item.quantity,
                notes: item.notes
            }));
            await orderService.addItemsToOrder(existingOrderId, newItems);
            clearCart();
            // Continue to close table...
        } catch (error) {
             console.error("Auto-save failed during checkout", error);
             alert("Error al guardar items nuevos antes de cerrar mesa");
             return;
        }
    }

    if (cart.length === 0 && action !== 'checkout' && (!existingOrderId || action !== 'checkout')) return;

    try {
        const items = cart.map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
            notes: item.notes
        }));

        // CASE 1: Table checkout - Process payment (items already in order)
        if (existingOrderId && tableId && action === 'checkout') {
          // NOTE: Items are already in the order (or just autosaved), don't send `items` again!
          // Just process payment using tableService.closeTable
          const paymentData = payments || [{ method: method === 'cash' ? 'CASH' : 'CARD', amount: 0 }];
          await tableService.closeTable(tableId, paymentData);
          
          clearCart();
          setIsCheckoutOpen(false);
          navigate('/tables');
          return;
        }

        // CASE 2: Direct sale (no table) - create and pay immediately
        const orderData = {
            items,
            channel: 'POS' as const,
            paymentMethod: method === 'cash' ? 'CASH' : 'CARD'
        };

        await orderService.create(orderData);
        clearCart();
        setIsCheckoutOpen(false);
    } catch (error) {
        console.error("Checkout failed", error);
        alert("Error al procesar la orden");
    }
  };

  return (
    <>
      <POSLayout 
        categories={
            <CategoryTabs 
                activeId={activeCategoryId} 
                onSelect={setActiveCategoryId} 
            />
        }
        products={
            <div className="h-full flex flex-col">
                 <div className="mb-4 flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        {existingOrderId ? `Orden #${existingOrderId}` : (isDeliveryMode ? 'Delivery' : 'Nueva Venta')}
                        {tableId && <span className="text-sm font-normal text-slate-500 ml-2">(Mesa {tableId})</span>}
                    </h1>
                    
                    {!existingOrderId && (
                        <button 
                            onClick={() => setIsDeliveryMode(!isDeliveryMode)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                isDeliveryMode 
                                    ? 'bg-primary text-primary-foreground' 
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                        >
                            <Truck className="w-4 h-4" />
                            {isDeliveryMode ? 'Modo Delivery' : 'Venta Mostrador'}
                        </button>
                    )}
                 </div>

                 {isDeliveryMode && (
                     <div className="mb-4">
                         <ClientLookup 
                            onSelect={setSelectedClient} 
                            selectedClient={selectedClient} 
                         />
                     </div>
                 )}

                 <div className="flex-1 overflow-y-auto">
                    <ProductGrid activeCategoryId={activeCategoryId} />
                 </div>
            </div>
        }
        cart={
            <ShoppingCart 
                onCheckout={handleCartAction}
                checkoutLabel={
                    isDeliveryMode 
                        ? (selectedClient ? "Confirmar Delivery" : "Seleccione Cliente") 
                        : (tableId ? "Guardar Pedido" : "Procesar Venta")
                }
                existingItems={existingItems}
            />
        }
      />
      
      <CheckoutModal 
        isOpen={isCheckoutOpen} 
        onClose={() => setIsCheckoutOpen(false)} 
        onConfirm={handleCheckout}
        tableMode={!!(tableId && action === 'checkout')}
        totalAmount={
            // Grand Total = Existing Items + Current Cart
            existingItems.reduce((acc, item) => acc + (Number(item.unitPrice) * item.quantity), 0) + 
            usePOSStore.getState().total()
        }
      />
      
      {selectedClient && (
          <DeliveryModal
            isOpen={isDeliveryModalOpen}
            onClose={() => setIsDeliveryModalOpen(false)}
            onConfirm={handleDeliveryConfirm}
            client={selectedClient}
          />
      )}

      {isShiftOpen === false && (
        <OpenShiftModal onShiftOpened={() => setIsShiftOpen(true)} />
      )}
    </>
  );
};

