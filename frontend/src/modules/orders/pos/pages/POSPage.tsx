import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { POSLayout } from '../components/POSLayout';
import { CategoryTabs } from '../components/CategoryTabs';
import { ProductGrid } from '../components/ProductGrid';
import { ShoppingCart } from '../components/ShoppingCart';
import { CheckoutModal } from '../components/CheckoutModal';
import { usePOSStore } from '../../../../store/pos.store';
import { orderService } from '../../../../services/orderService';
import type { OrderItemResponse } from '../../../../services/orderService';
import { tableService } from '../../../../services/tableService';

import { OpenShiftModal } from '../../../../components/cash/OpenShiftModal';
import { useCashStore } from '../../../../store/cash.store';
import { isOnline as checkOnline } from '../../../../lib/connectivity';

import { ClientLookup } from '../components/ClientLookup';
import { DeliveryModal } from '../components/DeliveryModal';
import type { Client } from '../../../../services/clientService';
import { Truck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '../../../../lib/errorUtils';

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
  const [existingItems, setExistingItems] = useState<OrderItemResponse[]>([]);

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
    // Use the persisted cash store (survives offline + page reload)
    const store = useCashStore.getState();

    if (checkOnline()) {
        // Online: refresh from server, store auto-persists
        await store.checkShiftStatus();
        setIsShiftOpen(!!useCashStore.getState().shift);
    } else {
        // Offline: use the persisted shift from last online check
        setIsShiftOpen(!!store.shift);
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
    } catch (error: unknown) {
      console.error("Save failed", error);
      toast.error(getErrorMessage(error, "Error al guardar el pedido"));
    }
  };

  // Handler for the cart button - route to save or checkout
  const handleCartAction = () => {
    // Delivery Mode Check
    if (isDeliveryMode) {
        if (!selectedClient) {
            toast.warning("Por favor, seleccione un cliente para el delivery.");
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
  interface DeliveryData { address: string; notes?: string; phone: string; name: string; driverId?: number; }
  const [pendingDeliveryData, setPendingDeliveryData] = useState<DeliveryData | null>(null);

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

  const handleCheckout = async (method: string, payments?: { method: string; amount: number }[], discount?: number) => {
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
             toast.error("Error al guardar items nuevos antes de cerrar mesa");
             return;
        }
    }

    // CASE 1: Table checkout - Close table with payment (atomic operation)
    if (existingOrderId && tableId && action === 'checkout') {
        try {
            console.log('[POSPage] Closing table with payment:', tableId);

            // Backend closeTableWithPayment handles payment + order close + table FREE atomically
            await tableService.closeTable(tableId, paymentData);
            console.log('[POSPage] Table closed successfully');
            clearCart();
            setIsCheckoutOpen(false);
            navigate('/tables');
            return;
        } catch (error: unknown) {
            console.error("Table checkout failed", error);
            toast.error(getErrorMessage(error, "Error al procesar el pago de la mesa"));
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
              // FIX: Only send deliveryData if it actually has an address
              ...(currentPendingData?.address ? { deliveryData: currentPendingData } : {}),
              ...(discount ? { discount } : {})
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

    } catch (error: unknown) {
        console.error("Checkout failed", error);
        toast.error(getErrorMessage(error, "Error al procesar la orden"));
    }
  };

  // FE-005: Indicador de carga mientras se verifican turno y orden existente
  if (isShiftOpen === null || !orderLoaded) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
                 {/* Header - Minimal & Functional */}
                 <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h1 className="text-lg font-semibold text-foreground">
                            {existingOrderId ? (
                                <>Orden <span className="font-mono">#{existingOrderId}</span></>
                            ) : (
                                isDeliveryMode ? 'Delivery' : 'Nueva Venta'
                            )}
                        </h1>
                        {tableId && (
                            <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                Mesa {tableId}
                            </span>
                        )}
                    </div>

                    {!existingOrderId && (
                        <button
                            onClick={() => setIsDeliveryMode(!isDeliveryMode)}
                            className={`
                                flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                                ${isDeliveryMode
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                                }
                            `}
                        >
                            <Truck className="w-4 h-4" />
                            {isDeliveryMode ? 'Delivery' : 'Mostrador'}
                        </button>
                    )}
                 </div>

                 {/* Client Lookup for Delivery */}
                 {isDeliveryMode && (
                     <div className="mb-3">
                         <ClientLookup
                            onSelect={setSelectedClient}
                            selectedClient={selectedClient}
                         />
                     </div>
                 )}

                 {/* Product Grid */}
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
                    (sum: number, mod: { priceCharged?: string | number }) => sum + Number(mod.priceCharged || 0),
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

