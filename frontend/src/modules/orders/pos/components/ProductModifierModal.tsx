import React, { useState, useEffect } from 'react';
import { X, Check, Minus, Plus } from 'lucide-react';
import { type Product } from '../../../../services/productService';

interface ModifierOption {
    id: number;
    name: string;
    priceOverlay: number;
}

interface ModifierSelection {
    modifierGroupId: number;
    modifierOptionId: number;
    name: string;
    priceOverlay: number;
}

interface ProductModifierModalProps {
    product: Product | null;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (quantity: number, modifiers: ModifierSelection[], notes: string, removedIngredientIds: number[]) => void;
}

export const ProductModifierModal: React.FC<ProductModifierModalProps> = ({ 
    product, 
    isOpen, 
    onClose, 
    onConfirm 
}) => {
    const [quantity, setQuantity] = useState(1);
    const [selections, setSelections] = useState<ModifierSelection[]>([]);
    const [notes, setNotes] = useState('');
    const [removedIngredientIds, setRemovedIngredientIds] = useState<number[]>([]);

    // Reset when product changes
    useEffect(() => {
        if (isOpen) {
            setQuantity(1);
            setSelections([]);
            setNotes('');
            setRemovedIngredientIds([]);
        }
    }, [isOpen, product]);

    if (!product || !isOpen) return null;

    // Helper to check selection count for a group
    const getSelectionCount = (groupId: number) => {
        return selections.filter(s => s.modifierGroupId === groupId).length;
    };

    const toggleIngredient = (id: number) => {
        setRemovedIngredientIds(prev => 
            prev.includes(id) 
                ? prev.filter(i => i !== id) 
                : [...prev, id]
        );
    };

    const toggleOption = (groupId: number, option: ModifierOption, max: number) => {
        const isSelected = selections.some(s => s.modifierOptionId === option.id);
        const currentCount = getSelectionCount(groupId);

        if (isSelected) {
            // Deselect logic
            setSelections(prev => prev.filter(s => s.modifierOptionId !== option.id));
        } else {
            // Select logic
            // If single select (max=1), simple switch
            if (max === 1) {
                // Remove other option from same group AND add new one
                setSelections(prev => [
                    ...prev.filter(s => s.modifierGroupId !== groupId),
                    { modifierGroupId: groupId, modifierOptionId: option.id, name: option.name, priceOverlay: option.priceOverlay }
                ]);
            } else {
                // Multi select
                if (currentCount >= max) return; // Cap reached
                 setSelections(prev => [
                    ...prev,
                    { modifierGroupId: groupId, modifierOptionId: option.id, name: option.name, priceOverlay: option.priceOverlay }
                ]);
            }
        }
    };

    const isValid = () => {
        if (!product.modifiers) return true;
        
        // Check strict min/max compliance for all groups
        return product.modifiers.every(mod => {
            const group = mod.modifierGroup;
            const count = getSelectionCount(group.id);
            return count >= group.minSelection;
        });
    };

    // Get list of groups that don't meet minimum selection
    const getMissingGroups = () => {
        if (!product.modifiers) return [];
        return product.modifiers
            .filter(mod => {
                const group = mod.modifierGroup;
                const count = getSelectionCount(group.id);
                return count < group.minSelection;
            })
            .map(mod => ({
                name: mod.modifierGroup.name,
                missing: mod.modifierGroup.minSelection - getSelectionCount(mod.modifierGroup.id)
            }));
    };

    const calculateTotal = () => {
        const modsTotal = selections.reduce((acc, s) => acc + Number(s.priceOverlay), 0);
        return (Number(product.price) + modsTotal) * quantity;
    };

    const handleConfirm = () => {
        if (!isValid()) return;
        onConfirm(quantity, selections, notes, removedIngredientIds);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                 <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">{product.name}</h2>
                        <p className="text-slate-500 text-sm line-clamp-1">{product.description}</p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={24} className="text-slate-500" />
                    </button>
                 </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    
                    {/* Ingredients Section (New) */}
                    {product.ingredients && product.ingredients.length > 0 && (
                        <div className="space-y-2">
                             <div className="flex justify-between items-center bg-slate-50 p-2 rounded">
                                <h4 className="font-semibold text-sm uppercase text-slate-700">
                                    Ingredientes
                                </h4>
                                <span className="text-xs text-slate-500">
                                    Desmarcar para quitar
                                </span>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {product.ingredients.map((ing) => {
                                    const isIncluded = !removedIngredientIds.includes(ing.ingredientId);
                                    return (
                                        <div 
                                            key={ing.ingredientId}
                                            onClick={() => toggleIngredient(ing.ingredientId)}
                                            className={`
                                                flex items-center justify-between p-3 rounded border cursor-pointer transition-all
                                                ${isIncluded ? 'border-green-600 bg-green-50 ring-1 ring-green-600' : 'border-slate-200 opacity-60'}
                                            `}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`
                                                    w-4 h-4 rounded flex items-center justify-center
                                                    ${isIncluded ? 'bg-green-600 text-white' : 'border border-slate-400'}
                                                `}>
                                                    {isIncluded && <Check size={12} strokeWidth={4} />}
                                                </div>
                                                <span className={isIncluded ? 'font-medium text-slate-900' : 'text-slate-500 line-through'}>
                                                    {ing.ingredient?.name || `Ingrediente ${ing.ingredientId}`}
                                                </span>
                                            </div>
                                            <span className="text-xs text-slate-500">
                                                {ing.quantity} {ing.ingredient?.unit}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {product.modifiers?.map((mod) => {
                        const { modifierGroup } = mod;
                        const currentCount = getSelectionCount(modifierGroup.id);
                        const isSatisfied = currentCount >= modifierGroup.minSelection;
                        
                        return (
                            <div key={modifierGroup.id} className="space-y-2">
                                <div className="flex justify-between items-center bg-slate-50 p-2 rounded">
                                    <h4 className="font-semibold text-sm uppercase text-slate-700">
                                        {modifierGroup.name}
                                    </h4>
                                    <span className={`text-xs px-2 py-0.5 rounded font-mono ${isSatisfied ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {modifierGroup.minSelection > 0 ? `Requerido` : 'Opcional'} 
                                        {modifierGroup.maxSelection > 1 ? ` (Max ${modifierGroup.maxSelection})` : ''}
                                    </span>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-2">
                                    {modifierGroup.options.filter(o => o.isActive !== false).map(option => {
                                        const isSelected = selections.some(s => s.modifierOptionId === option.id);
                                        return (
                                            <div 
                                                key={option.id}
                                                onClick={() => toggleOption(modifierGroup.id, option, modifierGroup.maxSelection)}
                                                className={`
                                                    flex items-center justify-between p-3 rounded border cursor-pointer transition-all
                                                    ${isSelected ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'border-slate-200 hover:border-slate-300'}
                                                `}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`
                                                        w-4 h-4 rounded-full border flex items-center justify-center
                                                        ${isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-400'}
                                                        ${modifierGroup.maxSelection > 1 ? 'rounded-md' : 'rounded-full'} 
                                                    `}>
                                                        {isSelected && <Check size={10} strokeWidth={4} />}
                                                    </div>
                                                    <span className={isSelected ? 'font-medium text-slate-900' : 'text-slate-600'}>
                                                        {option.name}
                                                    </span>
                                                </div>
                                                {option.priceOverlay > 0 && (
                                                    <span className="text-sm font-semibold text-slate-700">
                                                        +${Number(option.priceOverlay).toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    <div className="space-y-2 pt-2 border-t">
                        <label className="text-sm font-semibold text-slate-700">Notas de Cocina</label>
                        <input 
                            value={notes} 
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Ej: Sin sal, bien cocido..."
                            className="w-full bg-slate-50 border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between">
                         <div className="flex items-center bg-white rounded-lg border shadow-sm">
                            <button 
                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-l-lg border-r"
                            >
                                <Minus size={16} />
                            </button>
                            <span className="w-12 text-center font-bold text-lg">{quantity}</span>
                            <button 
                                onClick={() => setQuantity(quantity + 1)}
                                className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-r-lg border-l"
                            >
                                <Plus size={16} />
                            </button>
                         </div>
                         <div className="text-right">
                             <p className="text-xs text-slate-500">Total</p>
                             <p className="text-xl font-bold text-slate-900">${calculateTotal().toFixed(2)}</p>
                         </div>
                    </div>

                    {/* Validation message */}
                    {!isValid() && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center">
                            <p className="text-sm text-red-700">
                                Falta seleccionar: {getMissingGroups().map(g => g.name).join(', ')}
                            </p>
                        </div>
                    )}

                    <button 
                        onClick={handleConfirm} 
                        disabled={!isValid()}
                        className={`w-full h-12 text-lg font-bold shadow-md rounded-xl transition-all ${isValid() ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}
                    >
                        {isValid() ? 'AGREGAR AL PEDIDO' : 'SELECCION INCOMPLETA'}
                    </button>
                </div>
            </div>
        </div>
    );
};
