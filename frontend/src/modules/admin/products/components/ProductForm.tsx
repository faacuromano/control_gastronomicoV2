import { useState, useEffect } from 'react';
import { categoryService, type Category } from '../../../../services/categoryService';
import { productService, type Product } from '../../../../services/productService';
import { modifierService, type ModifierGroup } from '../../../../services/modifierService';
import { ingredientService, type Ingredient } from '../../../../services/ingredientService';
import { X, Save, Trash, Loader2 } from 'lucide-react';
import { cn } from '../../../../lib/utils';

interface ProductFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    productToEdit?: Product;
}

export default function ProductForm({ isOpen, onClose, onSuccess, productToEdit }: ProductFormProps) {
    const [activeTab, setActiveTab] = useState<'info' | 'ingredients' | 'modifiers'>('info');
    
    // Data Sources
    const [categories, setCategories] = useState<Category[]>([]);
    const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
    const [allModifierGroups, setAllModifierGroups] = useState<ModifierGroup[]>([]);
    
    // Form State
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [description, setDescription] = useState('');
    const [productType, setProductType] = useState('SIMPLE');
    
    // Relation State
    const [selectedIngredients, setSelectedIngredients] = useState<{ ingredientId: number, quantity: number, name: string, unit: string }[]>([]);
    const [selectedModifierIds, setSelectedModifierIds] = useState<number[]>([]);

    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadInitialData();
            if (productToEdit) {
                setName(productToEdit.name);
                setPrice(productToEdit.price.toString());
                setCategoryId(productToEdit.categoryId.toString());
                setDescription(productToEdit.description || '');
                setProductType(productToEdit.productType);
                
                // Map existing relationships
                if (productToEdit.ingredients) {
                    setSelectedIngredients(productToEdit.ingredients.map(pi => ({
                        ingredientId: pi.ingredientId,
                        quantity: Number(pi.quantity),
                        name: pi.ingredient?.name || 'Unknown',
                        unit: pi.ingredient?.unit || ''
                    })));
                }
                
                if (productToEdit.modifiers) {
                    setSelectedModifierIds(productToEdit.modifiers.map(m => m.modifierGroupId));
                }
            } else {
                resetForm();
            }
        }
    }, [isOpen, productToEdit]);

    const loadInitialData = async () => {
        try {
            setLoadingData(true);
            const [cats, ings, mods] = await Promise.all([
                categoryService.getAll(),
                ingredientService.getAll(),
                modifierService.getAll()
            ]);
            setCategories(cats);
            setAllIngredients(ings);
            setAllModifierGroups(mods);
        } catch (err) {
            console.error(err);
            setError('Failed to load form data');
        } finally {
            setLoadingData(false);
        }
    };

    const resetForm = () => {
        setName('');
        setPrice('');
        setCategoryId('');
        setDescription('');
        setProductType('SIMPLE');
        setSelectedIngredients([]);
        setSelectedModifierIds([]);
        setActiveTab('info');
        setError('');
    };

    const handleAddIngredient = (ingredientId: string) => {
        const id = Number(ingredientId);
        if (!id) return;
        
        const ing = allIngredients.find(i => i.id === id);
        if (!ing) return;
        
        if (selectedIngredients.some(si => si.ingredientId === id)) return;
        
        setSelectedIngredients([...selectedIngredients, { 
            ingredientId: id, 
            quantity: 1, 
            name: ing.name, 
            unit: ing.unit 
        }]);
    };

    const handleUpdateIngredientQty = (idx: number, qty: string) => {
        const newIngs = [...selectedIngredients];
        newIngs[idx].quantity = parseFloat(qty) || 0;
        setSelectedIngredients(newIngs);
    };

    const handleRemoveIngredient = (idx: number) => {
        const newIngs = [...selectedIngredients];
        newIngs.splice(idx, 1);
        setSelectedIngredients(newIngs);
    };

    const toggleModifierGroup = (groupId: number) => {
        if (selectedModifierIds.includes(groupId)) {
            setSelectedModifierIds(selectedModifierIds.filter(id => id !== groupId));
        } else {
            setSelectedModifierIds([...selectedModifierIds, groupId]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const payload = {
                name,
                price: parseFloat(price),
                categoryId: parseInt(categoryId),
                description,
                productType,
                isActive: true,
                isStockable: true,
                ingredients: selectedIngredients.map(si => ({
                    ingredientId: si.ingredientId,
                    quantity: si.quantity
                })),
                modifierIds: selectedModifierIds
            };

            if (productToEdit) {
                await productService.update(productToEdit.id, payload);
            } else {
                await productService.create(payload);
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error?.message || 'Failed to save product');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-background w-full max-w-2xl rounded-lg shadow-lg border border-border flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-border">
                    <h2 className="text-xl font-semibold">{productToEdit ? 'Edit Product' : 'New Product'}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-accent rounded-md">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex border-b border-border">
                    <button 
                        onClick={() => setActiveTab('info')}
                        className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors", activeTab === 'info' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
                    >
                        Basic Info
                    </button>
                    <button 
                        onClick={() => setActiveTab('ingredients')}
                        className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors", activeTab === 'ingredients' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
                    >
                        Ingredients ({selectedIngredients.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('modifiers')}
                        className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors", activeTab === 'modifiers' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
                    >
                        Modifiers ({selectedModifierIds.length})
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
                    <div className="p-6 overflow-y-auto flex-1">
                        {error && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm mb-4">{error}</div>}
                        {loadingData ? <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div> : (
                            <>
                                {activeTab === 'info' && (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Name</label>
                                            <input required type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 bg-background border border-input rounded-md focus:ring-2 focus:ring-ring" />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Price</label>
                                                <input required type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full px-3 py-2 bg-background border border-input rounded-md" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Type</label>
                                                <select value={productType} onChange={(e) => setProductType(e.target.value)} className="w-full px-3 py-2 bg-background border border-input rounded-md">
                                                    <option value="SIMPLE">Simple</option>
                                                    <option value="COMBO">Combo</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Category</label>
                                            <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full px-3 py-2 bg-background border border-input rounded-md">
                                                <option value="">Select Category</option>
                                                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Description</label>
                                            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 bg-background border border-input rounded-md min-h-[80px]" />
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'ingredients' && (
                                    <div className="space-y-4">
                                        <div className="flex gap-2">
                                            <select 
                                                className="flex-1 px-3 py-2 bg-background border border-input rounded-md"
                                                onChange={(e) => { handleAddIngredient(e.target.value); e.target.value = ''; }}
                                            >
                                                <option value="">Add Ingredient...</option>
                                                {allIngredients.map(ing => (
                                                    <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            {selectedIngredients.map((ing, idx) => (
                                                <div key={ing.ingredientId} className="flex items-center gap-2 p-2 bg-slate-50 border rounded-md">
                                                    <span className="flex-1 font-medium">{ing.name}</span>
                                                    <input 
                                                        type="number" 
                                                        step="0.0001" 
                                                        value={ing.quantity}
                                                        onChange={(e) => handleUpdateIngredientQty(idx, e.target.value)}
                                                        className="w-24 px-2 py-1 border rounded"
                                                        placeholder="Qty"
                                                    />
                                                    <span className="text-sm text-slate-500 w-12">{ing.unit}</span>
                                                    <button onClick={() => handleRemoveIngredient(idx)} className="p-1 hover:bg-red-100 rounded text-red-500">
                                                        <Trash size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                            {selectedIngredients.length === 0 && <div className="text-center text-slate-400 py-8">No ingredients linked</div>}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'modifiers' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-slate-500 mb-2">Select modifier groups available for this product.</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {allModifierGroups.map(group => (
                                                <div 
                                                    key={group.id} 
                                                    className={cn("border rounded-lg p-3 cursor-pointer transition-colors flex items-start gap-3", selectedModifierIds.includes(group.id) ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-slate-300")}
                                                    onClick={() => toggleModifierGroup(group.id)}
                                                >
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedModifierIds.includes(group.id)}
                                                        onChange={() => toggleModifierGroup(group.id)}
                                                        className="mt-1"
                                                    />
                                                    <div>
                                                        <div className="font-medium">{group.name}</div>
                                                        <div className="text-xs text-slate-500">
                                                            {group.options.length} options, Select {group.minSelection}-{group.maxSelection}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {allModifierGroups.length === 0 && <div className="text-center text-slate-400 py-8">No modifier groups created yet. Go to Modifiers page.</div>}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="p-4 border-t border-border flex justify-end gap-2 bg-slate-50">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-md">Cancel</button>
                        <button 
                            type="submit" 
                            disabled={loading || loadingData} 
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {loading ? 'Saving...' : 'Save Product'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
