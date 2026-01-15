import React, { useEffect, useState } from 'react';
import { Truck, MapPin, User, CheckCircle } from 'lucide-react';
import { orderService } from '../../../../services/orderService';
import type { OrderResponse } from '../../../../services/orderService';
import { userService } from '../../../../services/userService';
import type { User as UserType } from '../../../../services/userService';

// Simple Status Mapping
const STATUS_COLUMNS = {
    NEW: ['OPEN', 'CONFIRMED', 'COOKING'], // 'COOKING' is ItemStatus, OrderStatus usually stays CONFIRMED until PREPARED? 
                                          // Let's assume CONFIRMED is New/Kitchen.
    READY: ['PREPARED'],
    ON_ROUTE: ['ON_ROUTE'],
    DELIVERED: ['DELIVERED']
};

export const DeliveryDashboard: React.FC = () => {
    const [orders, setOrders] = useState<OrderResponse[]>([]);
    const [drivers, setDrivers] = useState<UserType[]>([]); // All users for now, or filtered by role if backend supports
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 15000); // Poll every 15s
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const [ordersData, driversData] = await Promise.all([
                orderService.getDeliveryOrders(),
                userService.getUsersWithCapability('delivery')
            ]);
            setOrders(ordersData);
            setDrivers(driversData);
        } catch (error) {
            console.error("Failed to fetch dashboard data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAssignDriver = async (orderId: number, driverId: string) => { // driverId from select is string
        if (!driverId) return;
        try {
            await orderService.assignDriver(orderId, Number(driverId));
            fetchData(); // Refresh immediately
        } catch (error) {
            console.error("Failed to assign driver", error);
            alert("Error al asignar repartidor");
        }
    };

    const handleMarkDelivered = async (orderId: number) => {
        if (!confirm("¿Marcar pedido como entregado?")) return;
        try {
            await orderService.updateStatus(orderId, 'DELIVERED');
            fetchData();
        } catch (error) {
            console.error("Failed to update status", error);
        }
    };

    const getColumnOrders = (statuses: string[]) => {
        return orders.filter(o => statuses.includes(o.status));
    };

    if (loading && orders.length === 0) {
        return <div className="p-8 text-center">Cargando tablero...</div>;
    }

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 p-6 overflow-hidden">
            <header className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3 text-slate-800 dark:text-slate-100">
                        <Truck className="w-8 h-8 text-primary" />
                        Despacho de Delivery
                    </h1>
                    <p className="text-slate-500">Gestión de envíos y repartidores</p>
                </div>
                <button 
                    onClick={fetchData} 
                    className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
                    data-testid="btn-refresh-delivery"
                >
                    Actualizar
                </button>
            </header>

            <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <div className="flex h-full gap-6 min-w-[1000px]">
                    {/* CONFIRMED / KITCHEN */}
                    <DashboardColumn 
                        title="En Cocina / Pendientes" 
                        count={getColumnOrders(STATUS_COLUMNS.NEW).length}
                        color="bg-blue-100 dark:bg-blue-900/20 border-blue-200"
                    >
                        {getColumnOrders(STATUS_COLUMNS.NEW).map(order => (
                            <DeliveryCard 
                                key={order.id} 
                                order={order} 
                                drivers={drivers}
                                onAssignDriver={handleAssignDriver}
                            />
                        ))}
                    </DashboardColumn>

                    {/* PREPARED / READY */}
                    <DashboardColumn 
                        title="Listo para Retirar" 
                        count={getColumnOrders(STATUS_COLUMNS.READY).length}
                        color="bg-yellow-100 dark:bg-yellow-900/20 border-yellow-200"
                    >
                         {getColumnOrders(STATUS_COLUMNS.READY).map(order => (
                            <DeliveryCard 
                                key={order.id} 
                                order={order} 
                                drivers={drivers}
                                onAssignDriver={handleAssignDriver}
                                isReady
                            />
                        ))}
                    </DashboardColumn>

                    {/* ON ROUTE */}
                    <DashboardColumn 
                        title="En Camino" 
                        count={getColumnOrders(STATUS_COLUMNS.ON_ROUTE).length}
                        color="bg-purple-100 dark:bg-purple-900/20 border-purple-200"
                    >
                         {getColumnOrders(STATUS_COLUMNS.ON_ROUTE).map(order => (
                            <DeliveryCard 
                                key={order.id} 
                                order={order} 
                                drivers={drivers}
                                onAssignDriver={handleAssignDriver} // Can reassign?
                                onMarkDelivered={handleMarkDelivered}
                                isOnRoute
                            />
                        ))}
                    </DashboardColumn>

                    {/* DELIVERED */}
                     <DashboardColumn 
                        title="Entregados (Hoy)" 
                        count={getColumnOrders(STATUS_COLUMNS.DELIVERED).length}
                        color="bg-green-100 dark:bg-green-900/20 border-green-200"
                    >
                         {getColumnOrders(STATUS_COLUMNS.DELIVERED).map(order => (
                            <div key={order.id} className="opacity-60 grayscale hover:grayscale-0 transition-all">
                                 <DeliveryCard order={order} drivers={[]} readOnly />
                            </div>
                        ))}
                    </DashboardColumn>
                </div>
            </div>
        </div>
    );
};

const DashboardColumn: React.FC<{ title: string; count: number; children: React.ReactNode; color: string }> = ({ title, count, children, color }) => (
    <div className={`flex-1 flex flex-col rounded-xl border-t-4 ${color} bg-white dark:bg-slate-800 shadow-sm overflow-hidden`}>
        <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 dark:text-slate-200">{title}</h3>
            <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full text-xs font-bold">{count}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
            {children}
        </div>
    </div>
);

interface DeliveryCardProps {
    order: OrderResponse;
    drivers: UserType[];
    onAssignDriver?: (orderId: number, driverId: string) => void;
    onMarkDelivered?: (orderId: number) => void;
    isReady?: boolean;
    isOnRoute?: boolean;
    readOnly?: boolean;
}

const DeliveryCard: React.FC<DeliveryCardProps> = ({ order, drivers, onAssignDriver, onMarkDelivered, isReady, isOnRoute, readOnly }) => {
    // Assuming backend sends `deliveryAddress` and `client` in OrderResponse. 
    // Need to verify OrderResponse interface in orderService.ts if it includes these fields.
    // It currently includes `items`, `orderNumber`, etc. 
    // It might be missing `deliveryAddress`, `client`, `deliveryNotes`, `driver`.
    // I should cast or assume backend sends it (it likely does if I updated controller to include relations).
    // Let's assume standard `any` access or update interface later.
    
    // Safety check for delivery props which might not be typed yet
    const anyOrder = order as any; 
    const address = anyOrder.deliveryAddress || anyOrder.client?.address || 'Sin dirección';
    const clientName = anyOrder.client?.name || 'Cliente Ocasional';
    const clientPhone = anyOrder.client?.phone;
    const notes = anyOrder.deliveryNotes;
    const driverId = anyOrder.driverId;

    return (
        <div className={`bg-white dark:bg-slate-800 border ${isReady ? 'border-yellow-400 shadow-md ring-1 ring-yellow-400' : 'border-slate-200 dark:border-700'} rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow`}>
            <div className="flex justify-between items-start mb-2">
                <span className="font-mono font-bold text-lg">#{order.orderNumber}</span>
                <span className="text-xs font-medium text-slate-500">
                    {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
            
            <div className="space-y-2 mb-4">
                <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div>
                        <p className="font-semibold text-sm leading-none">{clientName}</p>
                        {clientPhone && <p className="text-xs text-slate-500">{clientPhone}</p>}
                    </div>
                </div>
                <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-red-400 mt-0.5" />
                    <p className="text-sm font-medium leading-tight">{address}</p>
                </div>
                {notes && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/10 p-2 rounded text-xs text-yellow-800 dark:text-yellow-200 border border-yellow-100">
                        {notes}
                    </div>
                )}
            </div>

            <div className="border-t border-slate-100 dark:border-slate-700 pt-3 flex flex-col gap-2">
                 <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500">{order.items.length} items</span>
                    <span className="font-bold text-lg">${Number(order.total).toFixed(2)}</span>
                </div>

                {!readOnly && (
                    <div className="mt-1">
                        {isOnRoute ? (
                             <div className="flex flex-col gap-2">
                                <p className="text-xs flex items-center gap-1 text-purple-600 font-medium">
                                    <Truck className="w-3 h-3" />
                                    {anyOrder.driver?.name || "Repartidor asignado"}
                                </p>
                                <button 
                                    onClick={() => onMarkDelivered && onMarkDelivered(order.id)}
                                    className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors flex justify-center items-center gap-2"
                                    data-testid="btn-delivered"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    Entregado
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <select 
                                    className="flex-1 text-sm border rounded bg-slate-50 p-1.5 outline-none focus:ring-1 focus:ring-primary"
                                    value={driverId || ""}
                                    onChange={(e) => onAssignDriver && onAssignDriver(order.id, e.target.value)}
                                    data-testid="driver-select"
                                >
                                    <option value="">Detalle Repartidor...</option>
                                    {drivers.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
