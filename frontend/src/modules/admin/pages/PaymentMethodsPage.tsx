import React, { useState, useEffect } from 'react';
import { Plus, Loader2, Save, X, ToggleLeft, ToggleRight, Trash2, CreditCard } from 'lucide-react';
import { paymentMethodService, type PaymentMethodConfig } from '../../../services/paymentMethodService';

export const PaymentMethodsPage: React.FC = () => {
    const [methods, setMethods] = useState<PaymentMethodConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMethod, setEditingMethod] = useState<PaymentMethodConfig | null>(null);

    // Form state
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [icon, setIcon] = useState('');
    const [sortOrder, setSortOrder] = useState(0);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await paymentMethodService.getAll();
            setMethods(data);
        } catch (error) {
            console.error('Failed to load payment methods', error);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setCode('');
        setName('');
        setIcon('');
        setSortOrder(0);
        setEditingMethod(null);
    };

    const openModal = (method?: PaymentMethodConfig) => {
        if (method) {
            setEditingMethod(method);
            setCode(method.code);
            setName(method.name);
            setIcon(method.icon || '');
            setSortOrder(method.sortOrder);
        } else {
            resetForm();
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = { code, name, icon: icon || undefined, sortOrder };
            if (editingMethod) {
                await paymentMethodService.update(editingMethod.id, data);
            } else {
                await paymentMethodService.create(data);
            }
            setIsModalOpen(false);
            resetForm();
            loadData();
        } catch (error: any) {
            console.error('Failed to save', error);
            alert(error?.response?.data?.error?.message || 'Error al guardar');
        }
    };

    const handleToggle = async (id: number) => {
        try {
            await paymentMethodService.toggleActive(id);
            loadData();
        } catch (error: any) {
            alert(error?.response?.data?.error?.message || 'Error al cambiar estado');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Eliminar este método de pago?')) return;
        try {
            await paymentMethodService.delete(id);
            loadData();
        } catch (error: any) {
            alert(error?.response?.data?.error?.message || 'Error al eliminar');
        }
    };

    const handleSeedDefaults = async () => {
        try {
            await paymentMethodService.seedDefaults();
            loadData();
        } catch (error: any) {
            alert(error?.response?.data?.error?.message || 'Error al crear métodos por defecto');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800">Métodos de Pago</h1>
                <div className="flex gap-2">
                    {methods.length === 0 && (
                        <button 
                            onClick={handleSeedDefaults}
                            className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            Cargar por defecto
                        </button>
                    )}
                    <button 
                        onClick={() => openModal()}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
                    >
                        <Plus size={20} /> Nuevo Método
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-100">
                {loading ? (
                    <div className="p-8 flex justify-center">
                        <Loader2 className="animate-spin text-indigo-600" size={32} />
                    </div>
                ) : methods.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        No hay métodos de pago configurados
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="text-left p-4 font-semibold text-slate-600">Código</th>
                                <th className="text-left p-4 font-semibold text-slate-600">Nombre</th>
                                <th className="text-left p-4 font-semibold text-slate-600">Icono</th>
                                <th className="text-center p-4 font-semibold text-slate-600">Orden</th>
                                <th className="text-center p-4 font-semibold text-slate-600">Activo</th>
                                <th className="text-right p-4 font-semibold text-slate-600">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {methods.map(method => (
                                <tr key={method.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-mono font-bold text-slate-800">{method.code}</td>
                                    <td className="p-4 text-slate-700">{method.name}</td>
                                    <td className="p-4 text-slate-500 font-mono text-sm">{method.icon || '-'}</td>
                                    <td className="p-4 text-center text-slate-600">{method.sortOrder}</td>
                                    <td className="p-4 text-center">
                                        <button 
                                            onClick={() => handleToggle(method.id)}
                                            className={`${method.isActive ? 'text-green-600' : 'text-slate-400'}`}
                                        >
                                            {method.isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                        </button>
                                    </td>
                                    <td className="p-4 text-right space-x-2">
                                        <button 
                                            onClick={() => openModal(method)}
                                            className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-sm font-bold hover:bg-indigo-200"
                                        >
                                            Editar
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(method.id)}
                                            className="bg-red-100 text-red-600 px-2 py-1 rounded-lg hover:bg-red-200"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <CreditCard size={24} />
                                {editingMethod ? 'Editar Método' : 'Nuevo Método de Pago'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Código *</label>
                                <input 
                                    type="text"
                                    value={code}
                                    onChange={e => setCode(e.target.value.toUpperCase())}
                                    className="w-full border border-slate-300 rounded-lg p-3 font-mono"
                                    placeholder="CASH, CARD..."
                                    required
                                    disabled={!!editingMethod}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Nombre *</label>
                                <input 
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg p-3"
                                    placeholder="Efectivo, Tarjeta..."
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Icono (Lucide)</label>
                                <input 
                                    type="text"
                                    value={icon}
                                    onChange={e => setIcon(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg p-3"
                                    placeholder="CreditCard, Banknote..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Orden</label>
                                <input 
                                    type="number"
                                    value={sortOrder}
                                    onChange={e => setSortOrder(parseInt(e.target.value) || 0)}
                                    className="w-full border border-slate-300 rounded-lg p-3"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 flex items-center justify-center gap-2"
                                >
                                    <Save size={20} /> Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
