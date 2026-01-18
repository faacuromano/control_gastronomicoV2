import { useState, useEffect } from 'react';
import { modifierService, type ModifierGroup } from '../../../services/modifierService';
import { ingredientService, type Ingredient } from '../../../services/ingredientService';
import { Plus, Trash, Edit, Loader2 } from 'lucide-react';

export default function ModifiersPage() {
    const [groups, setGroups] = useState<ModifierGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);

    // Edit/Create State for Group
    const [editingGroup, setEditingGroup] = useState<{ id?: number, name: string, min: number, max: number } | null>(null);

    // Edit/Create State for Option
    const [editingOption, setEditingOption] = useState<{ id?: number, groupId: number, name: string, price: string, ingredientId: string, qty: string } | null>(null);


    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [groupsData, ingredientsData] = await Promise.all([
                modifierService.getAll(),
                ingredientService.getAll()
            ]);
            setGroups(groupsData);
            setIngredients(ingredientsData);
        } catch (err) {
            console.error(err);
            setError('Failed to load modifiers');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveGroup = async () => {
        if (!editingGroup) return;
        try {
            if (editingGroup.id) {
                await modifierService.updateGroup(editingGroup.id, {
                    name: editingGroup.name,
                    minSelection: editingGroup.min,
                    maxSelection: editingGroup.max
                });
            } else {
                await modifierService.createGroup({
                    name: editingGroup.name,
                    minSelection: editingGroup.min,
                    maxSelection: editingGroup.max
                });
            }
            setEditingGroup(null);
            loadData();
        } catch (err: any) {
            alert(err.message || 'Error saving group');
        }
    };

    const handleDeleteGroup = async (id: number) => {
        if (!confirm('Delete this group? It will remove all options.')) return;
        try {
            await modifierService.deleteGroup(id);
            loadData();
        } catch (err: any) {
            alert(err.message || 'Error deleting group');
        }
    };

    const handleSaveOption = async () => {
        if (!editingOption) return;
        try {
            const payload = {
                name: editingOption.name,
                priceOverlay: parseFloat(editingOption.price) || 0,
                ingredientId: editingOption.ingredientId ? Number(editingOption.ingredientId) : undefined,
                qtyUsed: editingOption.qty ? Number(editingOption.qty) : undefined
            };

            if (editingOption.id) {
                await modifierService.updateOption(editingOption.id, payload);
            } else {
                await modifierService.addOption(editingOption.groupId, payload);
            }
            setEditingOption(null);
            loadData();
        } catch (err: any) {
            alert(err.message || 'Error saving option');
        }
    };

    const handleDeleteOption = async (id: number) => {
        if (!confirm('Delete this option?')) return;
        try {
            await modifierService.deleteOption(id);
            loadData();
        } catch (err: any) {
            alert(err.message || 'Error deleting option');
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                 <h1 className="text-2xl font-bold">Modificadores</h1>
                 <button 
                     onClick={() => setEditingGroup({ name: '', min: 0, max: 1 })}
                     className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 hover:opacity-90"
                 >
                     <Plus size={18} /> Nuevo Grupo
                 </button>
            </div>

            {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.map(group => (
                    <div key={group.id} className="bg-white rounded-xl shadow border overflow-hidden flex flex-col">
                        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-lg">{group.name}</h3>
                                <div className="text-xs text-slate-500 font-mono">
                                    Min: {group.minSelection} | Max: {group.maxSelection}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setEditingGroup({ id: group.id, name: group.name, min: group.minSelection, max: group.maxSelection })} 
                                    className="p-1 hover:bg-slate-200 rounded"
                                >
                                    <Edit size={16} className="text-slate-600" />
                                </button>
                                <button 
                                    onClick={() => handleDeleteGroup(group.id)} 
                                    className="p-1 hover:bg-red-100 rounded"
                                >
                                    <Trash size={16} className="text-red-600" />
                                </button>
                            </div>
                        </div>

                        <div className="p-4 flex-1 space-y-2">
                             {group.options.map(option => (
                                 <div key={option.id} className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100 group">
                                     <div>
                                         <div className="font-medium text-sm">{option.name}</div>
                                         <div className="text-xs text-slate-500">
                                             {option.priceOverlay > 0 && `+$${option.priceOverlay} `}
                                             {option.ingredient && `(${option.qtyUsed} ${option.ingredient.unit} ${option.ingredient.name})`}
                                         </div>
                                     </div>
                                     <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                         <button 
                                             onClick={() => setEditingOption({ 
                                                 id: option.id, 
                                                 groupId: group.id, 
                                                 name: option.name, 
                                                 price: option.priceOverlay.toString(), 
                                                 ingredientId: option.ingredientId?.toString() || '',
                                                 qty: option.qtyUsed?.toString() || '' 
                                             })}
                                             className="p-1 hover:bg-white rounded"
                                          >
                                             <Edit size={14} className="text-slate-500" />
                                          </button>
                                          <button 
                                              onClick={() => handleDeleteOption(option.id)}
                                              className="p-1 hover:bg-red-50 rounded"
                                          >
                                              <Trash size={14} className="text-red-500" />
                                          </button>
                                     </div>
                                 </div>
                             ))}
                             
                             {group.options.length === 0 && (
                                 <div className="text-center text-sm text-slate-400 py-4 italic">No options</div>
                             )}
                        </div>

                        <div className="p-3 bg-slate-50 border-t">
                            <button 
                                onClick={() => setEditingOption({ groupId: group.id, name: '', price: '', ingredientId: '', qty: '' })}
                                className="w-full py-1.5 text-sm border-2 border-dashed border-slate-300 text-slate-500 rounded-lg hover:border-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus size={14} /> Add Option
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Group Modal */}
            {editingGroup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-lg w-full max-w-sm">
                        <h3 className="text-lg font-bold mb-4">{editingGroup.id ? 'Edit Group' : 'New Group'}</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">Name</label>
                                <input 
                                    value={editingGroup.name} 
                                    onChange={e => setEditingGroup({...editingGroup, name: e.target.value})}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Min Select</label>
                                    <input 
                                        type="number"
                                        value={editingGroup.min} 
                                        onChange={e => setEditingGroup({...editingGroup, min: Number(e.target.value)})}
                                        className="w-full p-2 border rounded"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Max Select</label>
                                    <input 
                                        type="number"
                                        value={editingGroup.max} 
                                        onChange={e => setEditingGroup({...editingGroup, max: Number(e.target.value)})}
                                        className="w-full p-2 border rounded"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end mt-4">
                                <button onClick={() => setEditingGroup(null)} className="px-4 py-2 text-slate-600">Cancel</button>
                                <button onClick={handleSaveGroup} className="px-4 py-2 bg-primary text-primary-foreground rounded">Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Option Modal */}
            {editingOption && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-lg w-full max-w-sm">
                        <h3 className="text-lg font-bold mb-4">{editingOption.id ? 'Edit Option' : 'New Option'}</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">Name</label>
                                <input 
                                    value={editingOption.name} 
                                    onChange={e => setEditingOption({...editingOption, name: e.target.value})}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Extra Price ($)</label>
                                <input 
                                    type="number"
                                    step="0.1"
                                    value={editingOption.price} 
                                    onChange={e => setEditingOption({...editingOption, price: e.target.value})}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Link Ingredient (Stock)</label>
                                <select 
                                    value={editingOption.ingredientId} 
                                    onChange={e => setEditingOption({...editingOption, ingredientId: e.target.value})}
                                    className="w-full p-2 border rounded"
                                >
                                    <option value="">No Ingredient Linked</option>
                                    {ingredients.map(ing => (
                                        <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                                    ))}
                                </select>
                            </div>
                            {editingOption.ingredientId && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Quantity to Deduct</label>
                                    <input 
                                        type="number"
                                        step="0.01"
                                        value={editingOption.qty} 
                                        onChange={e => setEditingOption({...editingOption, qty: e.target.value})}
                                        className="w-full p-2 border rounded"
                                    />
                                </div>
                            )}
                            <div className="flex gap-2 justify-end mt-4">
                                <button onClick={() => setEditingOption(null)} className="px-4 py-2 text-slate-600">Cancel</button>
                                <button onClick={handleSaveOption} className="px-4 py-2 bg-primary text-primary-foreground rounded">Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
