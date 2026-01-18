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
        notes: item.notes,
        modifiers: item.modifiers?.map(m => ({ id: m.modifierOptionId, price: m.priceOverlay })),
        removedIngredientIds: item.removedIngredientIds
      }));

      if (existingOrderId) {
        await orderService.addItemsToOrder(existingOrderId, items);
        clearCart();
        navigate('/tables');
      }
    } catch (error: any) {
      console.error("Save failed", error);
      const errorMessage = error?.response?.data?.error?.message 
          || error?.message 
          || "Error al guardar el pedido";
      alert(errorMessage);
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


  /* New State for Delivery Flow */
  const [pendingDeliveryData, setPendingDeliveryData] = useState<any>(null);

  // Use Refs to ensure handleCheckout always accesses the latest state, avoiding stale closures
  const isDeliveryModeRef = React.useRef(isDeliveryMode);
  const pendingDeliveryDataRef = React.useRef(pendingDeliveryData);

  useEffect(() => {
      isDeliveryModeRef.current = isDeliveryMode;
  }, [isDeliveryMode]);

  useEffect(() => {
      pendingDeliveryDataRef.current = pendingDeliveryData;
  }, [pendingDeliveryData]);

  const handleDeliveryConfirm = (deliveryDetails: { address: string; notes?: string; driverId?: number }) => {
      if (!selectedClient) return;

      const deliveryData = {
          address: deliveryDetails.address,
          notes: deliveryDetails.notes,
          phone: selectedClient.phone || '',
          name: selectedClient.name,
          driverId: deliveryDetails.driverId
      };

      setPendingDeliveryData(deliveryData);
      setIsDeliveryModalOpen(false);
      setIsCheckoutOpen(true); // Proceed to Checkout Modal
  };

  const handleCheckout = async (method: string, payments?: { method: string; amount: number }[]) => {
    // If modal sends COMPLETED, just close (legacy/unused?)
    if (method === 'COMPLETED') {
         setIsCheckoutOpen(false);
         return;
    }

    const paymentData = payments || [{ method: method === 'cash' ? 'CASH' : 'CARD', amount: 0 }]; // Fallback if simple method string passed

    // If table checkout but cart has items, SAVE THEM first (Auto-save)
    if (existingOrderId && tableId && action === 'checkout' && cart.length > 0) {
        try {
             const newItems = cart.map(item => ({
                productId: item.product.id,
                quantity: item.quantity,
                notes: item.notes,
                modifiers: item.modifiers?.map(m => ({ id: m.modifierOptionId, price: m.priceOverlay })),
                removedIngredientIds: item.removedIngredientIds
            }));
            await orderService.addItemsToOrder(existingOrderId, newItems);
            clearCart();
        } catch (error) {
             console.error("Auto-save failed during checkout", error);
             alert("Error al guardar items nuevos antes de cerrar mesa");
             return;
        }
    }

    // CASE 1: Table checkout - Process payment (items already in order or just autosaved)
    if (existingOrderId && tableId && action === 'checkout') {
        try {
            console.log('[POSPage] Closing table:', tableId, 'with payments:', paymentData);
            const result = await tableService.closeTable(tableId, paymentData);
            console.log('[POSPage] Table close result:', result);
            clearCart();
            setIsCheckoutOpen(false);
            navigate('/tables');
            return;
        } catch (error) {
            console.error("Table close failed", error);
            alert("Error al cerrar la mesa");
            return;
        }
    }

    // For non-table orders: Require items in cart
    if (cart.length === 0) {
         setIsCheckoutOpen(false);
         return; 
    }

    try {
        const items = cart.map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
            notes: item.notes,
            modifiers: item.modifiers?.map(m => ({ id: m.modifierOptionId, price: m.priceOverlay })),
            removedIngredientIds: item.removedIngredientIds
        }));

        // CASE 2: Direct sale OR Delivery (no table) - create and pay
        // Read from REFS to guarantee latest state
        const currentIsDeliveryMode = isDeliveryModeRef.current;
        const currentPendingData = pendingDeliveryDataRef.current;

        // Robust Channel Detection: If we have delivery data, it IS a delivery app order, regardless of the toggle state at this specific moment
        const isDelivery = currentIsDeliveryMode || !!currentPendingData;
        const channel = (isDelivery ? 'DELIVERY_APP' : 'POS') as 'POS' | 'DELIVERY_APP';

        const createPayload = {
              items,
              paymentMethod: paymentData.length === 1 ? paymentData[0].method : 'SPLIT',
              payments: paymentData, // Pass full payment details (CASH/CARD/etc)
              channel,
              tableId: tableId ? Number(tableId) : undefined,
              clientId: selectedClient?.id,
              deliveryData: currentPendingData || undefined
        };

        const order = await orderService.create(createPayload);

        // For delivery: clear and navigate
        if (currentIsDeliveryMode) {
            clearCart();
            setIsCheckoutOpen(false);
            setPendingDeliveryData(null);
            setIsDeliveryMode(false);
            setSelectedClient(null);
            navigate('/delivery-dashboard');
        } else {
            // For direct POS sale: DON'T close modal - let CheckoutModal show success screen
            // The modal will handle cleanup when user clicks "Nueva Orden"
            setPendingDeliveryData(null);
        }
        
        return order;

    } catch (error: any) {
        console.error("Checkout failed", error);
        // Extract actual error message from API response
        const errorMessage = error?.response?.data?.error?.message 
            || error?.message 
            || "Error al procesar la orden";
        alert(errorMessage);
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
        tableId={tableId}
        totalAmount={
            // Grand Total = Existing Items + Current Cart (fallback if backend fetch fails)
            existingItems.reduce((acc, item) => {
                const itemBase = Number(item.unitPrice) * item.quantity;
                const modifiersPrice = (item.modifiers || []).reduce(
                    (sum: number, mod: any) => sum + Number(mod.priceCharged || 0),
                    0
                ) * item.quantity;
                return acc + itemBase + modifiersPrice;
            }, 0) + 
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

