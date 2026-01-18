import React, { useState, useEffect } from 'react';
import { Plus, Edit, History, AlertTriangle, PowerOff, Loader2 } from 'lucide-react';
import { ingredientService, type Ingredient } from '../../../services/ingredientService';
import { configService } from '../../../services/configService';
import StockHistoryModal from './components/StockHistoryModal';

export const IngredientsPage: React.FC = () => {
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [loading, setLoading] = useState(false);
    const [disabling, setDisabling] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        unit: 'kg',
        stock: 0,
        minStock: 0,
        cost: 0
    });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [selectedIngredient, setSelectedIngredient] = useState<{id: number, name: string} | null>(null);

    // Computed: count of ingredients with negative stock
    const negativeStockCount = ingredients.filter(ing => (ing.stock || 0) < 0).length;

    useEffect(() => {
        loadIngredients();
    }, []);

    const loadIngredients = async () => {
        setLoading(true);
        try {
            const data = await ingredientService.getAll();
            setIngredients(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to load ingredients", error);
            setIngredients([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                stock: Number(formData.stock),
                minStock: Number(formData.minStock),
                cost: Number(formData.cost)
            };
            if (editingId) {
                await ingredientService.update(editingId, payload);
            } else {
                await ingredientService.create(payload);
            }
            setIsModalOpen(false);
            setEditingId(null);
            setFormData({ name: '', unit: 'kg', stock: 0, minStock: 0, cost: 0 });
            loadIngredients();
        } catch (error) {
            console.error("Error saving ingredient", error);
            alert("Error al guardar insumo");
        }
    };

    const handleEdit = (ing: Ingredient) => {
        setEditingId(ing.id);
        setFormData({
            name: ing.name,
            unit: ing.unit,
            stock: ing.stock,
            minStock: ing.minStock,
            cost: ing.cost
        });
        setIsModalOpen(true);
    };

    const handleDisableStock = async () => {
        if (!confirm('¿Desactivar el módulo de stock? Las ventas dejarán de descontar inventario hasta que lo reactives en Configuración.')) return;
        setDisabling(true);
        try {
            await configService.updateConfig({ enableStock: false } as any);
            alert('Módulo de stock desactivado. Serás redirigido al panel de administración.');
            window.location.href = '/admin';
        } catch (error) {
            console.error('Error disabling stock:', error);
            alert('Error al desactivar el módulo');
        } finally {
            setDisabling(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800">Insumos (Stock)</h1>
                <button 
                    onClick={() => {
                        setEditingId(null);
                        setFormData({ name: '', unit: 'kg', stock: 0, minStock: 0, cost: 0 });
                        setIsModalOpen(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                >
                    <Plus size={20} /> Nuevo Insumo
                </button>
            </div>

            {/* Warning Banner for Negative Stock */}
            {negativeStockCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-4">
                    <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="font-semibold text-amber-800">
                            {negativeStockCount} ingrediente{negativeStockCount > 1 ? 's' : ''} con stock negativo
                        </h3>
                        <p className="text-sm text-amber-700 mt-1">
                            Esto puede ocurrir si hubo ventas sin cargar las compras correspondientes.
                            Si el inventario no está actualizado, puedes desactivar temporalmente el módulo.
                        </p>
                    </div>
                    <button
                        onClick={handleDisableStock}
                        disabled={disabling}
                        className="shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg font-medium text-sm transition-colors"
                    >
                        {disabling ? <Loader2 className="w-4 h-4 animate-spin" /> : <PowerOff size={16} />}
                        Desactivar Stock
                    </button>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium text-sm">
                            <tr>
                                <th className="px-6 py-4">Nombre</th>
                                <th className="px-6 py-4">Stock Actual</th>
                                <th className="px-6 py-4">Unidad</th>
                                <th className="px-6 py-4">Costo Unit.</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-slate-500">Cargando insumos...</td></tr>
                            ) : ingredients.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-slate-500">No hay insumos registrados.</td></tr>
                            ) : (
                                ingredients.map(ing => (
                                    <tr key={ing.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900">{ing.name}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                (ing.stock || 0) <= ing.minStock ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                                            }`}>
                                                {ing.stock || 0}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">{ing.unit}</td>
                                        <td className="px-6 py-4 text-slate-500">${ing.cost}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => {
                                                setSelectedIngredient({ id: ing.id, name: ing.name });
                                                setHistoryModalOpen(true);
                                            }} className="text-slate-400 hover:text-blue-600 mx-1" title="Ver Historial">
                                                <History size={18} />
                                            </button>
                                            <button onClick={() => handleEdit(ing)} className="text-slate-400 hover:text-indigo-600 mx-1"><Edit size={18} /></button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h2 className="font-bold text-lg text-slate-800">{editingId ? 'Editar' : 'Nuevo'} Insumo</h2>
                            <button onClick={() => setIsModalOpen(false)}><Plus className="rotate-45 text-slate-500" /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                                <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border rounded" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Stock Actual</label>
                                    <input type="number" required value={formData.stock} onChange={e => setFormData({...formData, stock: parseFloat(e.target.value)})} className="w-full p-2 border rounded" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Stock Mínimo</label>
                                    <input type="number" required value={formData.minStock} onChange={e => setFormData({...formData, minStock: parseFloat(e.target.value)})} className="w-full p-2 border rounded" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Unidad (kg, l, u)</label>
                                    <input required value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full p-2 border rounded" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Costo ($)</label>
                                    <input type="number" required value={formData.cost} onChange={e => setFormData({...formData, cost: parseFloat(e.target.value)})} className="w-full p-2 border rounded" />
                                </div>
                            </div>
                            <button type="submit" className="w-full py-2 bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700">Guardar</button>
                        </form>
                    </div>
                </div>
            )}

            <StockHistoryModal 
                isOpen={historyModalOpen}
                onClose={() => setHistoryModalOpen(false)}
                ingredientId={selectedIngredient?.id || 0}
                ingredientName={selectedIngredient?.name || ''}
            />
        </div>
    );
};
