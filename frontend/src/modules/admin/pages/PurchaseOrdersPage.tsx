import React, { useState, useEffect } from 'react';
import { Plus, Package, CheckCircle, XCircle, Clock, Loader2, Truck } from 'lucide-react';
import { purchaseOrderService, type PurchaseOrderListItem } from '../../../services/purchaseOrderService';
import { supplierService, type Supplier } from '../../../services/supplierService';
import { ingredientService, type Ingredient } from '../../../services/ingredientService';

type PurchaseStatus = 'PENDING' | 'ORDERED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';

const STATUS_CONFIG: Record<PurchaseStatus, { label: string; color: string; icon: React.ComponentType<any> }> = {
    PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    ORDERED: { label: 'Ordenada', color: 'bg-blue-100 text-blue-700', icon: Truck },
    PARTIAL: { label: 'Parcial', color: 'bg-orange-100 text-orange-700', icon: Package },
    RECEIVED: { label: 'Recibida', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    CANCELLED: { label: 'Cancelada', color: 'bg-red-100 text-red-700', icon: XCircle }
};

export const PurchaseOrdersPage: React.FC = () => {
    const [orders, setOrders] = useState<PurchaseOrderListItem[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form state for new order
    const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
    const [orderItems, setOrderItems] = useState<{ingredientId: number; quantity: number; unitCost: number}[]>([]);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [ordersData, suppliersData, ingredientsData] = await Promise.all([
                purchaseOrderService.getAll(),
                supplierService.getAll(),
                ingredientService.getAll()
            ]);
            setOrders(ordersData);
            setSuppliers(suppliersData);
            setIngredients(ingredientsData);
        } catch (error) {
            console.error("Failed to load data", error);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setSelectedSupplier(null);
        setOrderItems([]);
        setNotes('');
    };

    const addItem = () => {
        setOrderItems([...orderItems, { ingredientId: 0, quantity: 1, unitCost: 0 }]);
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...orderItems];
        (newItems[index] as any)[field] = value;
        setOrderItems(newItems);
    };

    const removeItem = (index: number) => {
        setOrderItems(orderItems.filter((_, i) => i !== index));
    };

    const calculateTotal = () => {
        return orderItems.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSupplier || orderItems.length === 0) {
            alert('Debe seleccionar un proveedor y agregar al menos un item');
            return;
        }

        const validItems = orderItems.filter(item => item.ingredientId > 0 && item.quantity > 0);
        if (validItems.length === 0) {
            alert('Todos los items deben tener ingrediente y cantidad válidos');
            return;
        }

        try {
            await purchaseOrderService.create({
                supplierId: selectedSupplier,
                notes: notes || undefined,
                items: validItems
            });
            setIsModalOpen(false);
            resetForm();
            loadData();
        } catch (error: any) {
            console.error("Error creating order", error);
            alert(error?.response?.data?.error?.message || "Error al crear orden");
        }
    };

    const handleReceive = async (id: number) => {
        if (!confirm('¿Confirmar recepción de la orden? Esto actualizará el stock de ingredientes.')) return;
        try {
            await purchaseOrderService.receive(id);
            loadData();
        } catch (error: any) {
            console.error("Error receiving order", error);
            alert(error?.response?.data?.error?.message || "Error al recibir orden");
        }
    };

    const handleCancel = async (id: number) => {
        if (!confirm('¿Cancelar esta orden de compra?')) return;
        try {
            await purchaseOrderService.cancel(id);
            loadData();
        } catch (error: any) {
            alert(error?.response?.data?.error?.message || "Error al cancelar orden");
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800">Órdenes de Compra</h1>
                <button 
                    onClick={() => {
                        resetForm();
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
                >
                    <Plus size={20} /> Nueva Orden
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-100">
                {loading ? (
                    <div className="p-8 flex justify-center">
                        <Loader2 className="animate-spin text-indigo-600" size={32} />
                    </div>
                ) : orders.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        No hay órdenes de compra registradas
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="text-left p-4 font-semibold text-slate-600"># Orden</th>
                                <th className="text-left p-4 font-semibold text-slate-600">Proveedor</th>
                                <th className="text-left p-4 font-semibold text-slate-600">Estado</th>
                                <th className="text-left p-4 font-semibold text-slate-600">Items</th>
                                <th className="text-right p-4 font-semibold text-slate-600">Total</th>
                                <th className="text-right p-4 font-semibold text-slate-600">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {orders.map(order => {
                                const statusConfig = STATUS_CONFIG[order.status];
                                const StatusIcon = statusConfig.icon;
                                return (
                                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-mono font-bold text-slate-800">
                                            #{order.orderNumber.toString().padStart(4, '0')}
                                        </td>
                                        <td className="p-4 text-slate-700">{order.supplier.name}</td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${statusConfig.color}`}>
                                                <StatusIcon size={12} /> {statusConfig.label}
                                            </span>
                                        </td>
                                        <td className="p-4 text-slate-600">{order._count.items} items</td>
                                        <td className="p-4 text-right font-bold text-slate-800">
                                            ${Number(order.total).toFixed(2)}
                                        </td>
                                        <td className="p-4 text-right space-x-2">
                                            {(order.status === 'PENDING' || order.status === 'ORDERED') && (
                                                <>
                                                    <button 
                                                        onClick={() => handleReceive(order.id)}
                                                        className="bg-green-100 text-green-700 px-3 py-1 rounded-lg text-sm font-bold hover:bg-green-200"
                                                    >
                                                        Recibir
                                                    </button>
                                                    <button 
                                                        onClick={() => handleCancel(order.id)}
                                                        className="bg-red-100 text-red-600 px-3 py-1 rounded-lg text-sm font-bold hover:bg-red-200"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Create Order Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100">
                            <h2 className="text-xl font-bold text-slate-800">Nueva Orden de Compra</h2>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Proveedor *</label>
                                <select 
                                    value={selectedSupplier ?? ''}
                                    onChange={e => setSelectedSupplier(Number(e.target.value))}
                                    className="w-full border border-slate-300 rounded-lg p-3"
                                    required
                                >
                                    <option value="">Seleccionar proveedor...</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Notas</label>
                                <textarea 
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg p-3"
                                    rows={2}
                                />
                            </div>

                            <div className="border-t pt-4">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium text-slate-600">Items *</label>
                                    <button 
                                        type="button" 
                                        onClick={addItem}
                                        className="text-indigo-600 text-sm font-bold hover:underline"
                                    >
                                        + Agregar Item
                                    </button>
                                </div>

                                {orderItems.length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-4">No hay items. Haga clic en "Agregar Item"</p>
                                ) : (
                                    <div className="space-y-2">
                                        {orderItems.map((item, idx) => (
                                            <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg">
                                                <div className="col-span-5">
                                                    <select
                                                        value={item.ingredientId}
                                                        onChange={e => updateItem(idx, 'ingredientId', Number(e.target.value))}
                                                        className="w-full border border-slate-300 rounded p-2 text-sm"
                                                    >
                                                        <option value={0}>Seleccionar...</option>
                                                        {ingredients.map(ing => (
                                                            <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="col-span-2">
                                                    <input
                                                        type="number"
                                                        placeholder="Cant."
                                                        value={item.quantity}
                                                        onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                                                        className="w-full border border-slate-300 rounded p-2 text-sm"
                                                        min="0.01"
                                                        step="0.01"
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <input
                                                        type="number"
                                                        placeholder="Costo Unit."
                                                        value={item.unitCost}
                                                        onChange={e => updateItem(idx, 'unitCost', Number(e.target.value))}
                                                        className="w-full border border-slate-300 rounded p-2 text-sm"
                                                        min="0"
                                                        step="0.01"
                                                    />
                                                </div>
                                                <div className="col-span-2 text-right">
                                                    <button 
                                                        type="button"
                                                        onClick={() => removeItem(idx)}
                                                        className="text-red-500 text-sm hover:underline"
                                                    >
                                                        Eliminar
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="border-t pt-4 flex justify-between items-center">
                                <div className="text-xl font-bold text-slate-800">
                                    Total: ${calculateTotal().toFixed(2)}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setIsModalOpen(false);
                                        resetForm();
                                    }}
                                    className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    disabled={!selectedSupplier || orderItems.length === 0}
                                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:bg-slate-300"
                                >
                                    Crear Orden
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
