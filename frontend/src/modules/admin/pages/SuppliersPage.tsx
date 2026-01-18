import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Phone, Mail, MapPin, Loader2 } from 'lucide-react';
import { supplierService, type Supplier, type CreateSupplierData } from '../../../services/supplierService';

export const SuppliersPage: React.FC = () => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState<CreateSupplierData>({
        name: '',
        phone: '',
        email: '',
        address: '',
        taxId: ''
    });

    useEffect(() => {
        loadSuppliers();
    }, []);

    const loadSuppliers = async () => {
        setLoading(true);
        try {
            const data = await supplierService.getAll();
            setSuppliers(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to load suppliers", error);
            setSuppliers([]);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({ name: '', phone: '', email: '', address: '', taxId: '' });
        setEditingId(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await supplierService.update(editingId, formData);
            } else {
                await supplierService.create(formData);
            }
            setIsModalOpen(false);
            resetForm();
            loadSuppliers();
        } catch (error: any) {
            console.error("Error saving supplier", error);
            const msg = error?.response?.data?.error?.message || "Error al guardar proveedor";
            alert(msg);
        }
    };

    const handleEdit = (supplier: Supplier) => {
        setEditingId(supplier.id);
        setFormData({
            name: supplier.name,
            phone: supplier.phone || '',
            email: supplier.email || '',
            address: supplier.address || '',
            taxId: supplier.taxId || ''
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Eliminar este proveedor?')) return;
        try {
            await supplierService.delete(id);
            loadSuppliers();
        } catch (error: any) {
            console.error("Error deleting supplier", error);
            const msg = error?.response?.data?.error?.message || "Error al eliminar proveedor";
            alert(msg);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800">Proveedores</h1>
                <button 
                    onClick={() => {
                        resetForm();
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
                >
                    <Plus size={20} /> Agregar Proveedor
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-100">
                {loading ? (
                    <div className="p-8 flex justify-center">
                        <Loader2 className="animate-spin text-indigo-600" size={32} />
                    </div>
                ) : suppliers.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        No hay proveedores registrados
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="text-left p-4 font-semibold text-slate-600">Nombre</th>
                                <th className="text-left p-4 font-semibold text-slate-600">Contacto</th>
                                <th className="text-left p-4 font-semibold text-slate-600">CUIT</th>
                                <th className="text-right p-4 font-semibold text-slate-600">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {suppliers.map(supplier => (
                                <tr key={supplier.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-slate-800">{supplier.name}</div>
                                        {supplier.address && (
                                            <div className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                                                <MapPin size={14} /> {supplier.address}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-slate-600">
                                        {supplier.phone && (
                                            <div className="flex items-center gap-1 text-sm">
                                                <Phone size={14} /> {supplier.phone}
                                            </div>
                                        )}
                                        {supplier.email && (
                                            <div className="flex items-center gap-1 text-sm mt-1">
                                                <Mail size={14} /> {supplier.email}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-slate-600 font-mono">
                                        {supplier.taxId || '-'}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button 
                                            onClick={() => handleEdit(supplier)}
                                            className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors mr-2"
                                        >
                                            <Edit size={18} />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(supplier.id)}
                                            className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={18} />
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
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
                        <h2 className="text-xl font-bold mb-4 text-slate-800">
                            {editingId ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                        </h2>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Nombre *</label>
                                <input 
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Teléfono</label>
                                    <input 
                                        type="tel"
                                        value={formData.phone}
                                        onChange={e => setFormData({...formData, phone: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Email</label>
                                    <input 
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({...formData, email: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Dirección</label>
                                <input 
                                    type="text"
                                    value={formData.address}
                                    onChange={e => setFormData({...formData, address: e.target.value})}
                                    className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">CUIT</label>
                                <input 
                                    type="text"
                                    value={formData.taxId}
                                    onChange={e => setFormData({...formData, taxId: e.target.value})}
                                    placeholder="XX-XXXXXXXX-X"
                                    className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                                />
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
                                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                                >
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
