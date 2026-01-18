/**
 * Bulk Price Update Page
 * Spreadsheet-like interface for mass price updates
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
    ArrowUp, ArrowDown, Percent, DollarSign, Search, 
    Save, AlertCircle, CheckCircle, RefreshCw, Filter
} from 'lucide-react';
import { 
    bulkPriceUpdateService, 
    type ProductPriceChange, 
    type Category,
    type PriceUpdateType 
} from '../../../services/bulkPriceUpdateService';

export const BulkPriceUpdatePage: React.FC = () => {
    const [products, setProducts] = useState<ProductPriceChange[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    
    // Bulk update controls
    const [updateType, setUpdateType] = useState<PriceUpdateType>('PERCENTAGE');
    const [updateValue, setUpdateValue] = useState<number>(0);
    const [roundPrices, setRoundPrices] = useState(false);
    
    // Search filter
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modified products tracking
    const [modifiedProducts, setModifiedProducts] = useState<Map<number, number>>(new Map());

    useEffect(() => {
        loadData();
    }, [selectedCategory]);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [productsData, categoriesData] = await Promise.all([
                bulkPriceUpdateService.getProductsForGrid(selectedCategory),
                bulkPriceUpdateService.getCategories()
            ]);
            setProducts(productsData);
            setCategories(categoriesData);
            setModifiedProducts(new Map());
        } catch (err: any) {
            setError(err.response?.data?.error?.message || 'Error cargando productos');
        } finally {
            setLoading(false);
        }
    };

    // Filter products by search term
    const filteredProducts = useMemo(() => {
        if (!searchTerm) return products;
        const term = searchTerm.toLowerCase();
        return products.filter(p => 
            p.name.toLowerCase().includes(term) ||
            p.categoryName.toLowerCase().includes(term)
        );
    }, [products, searchTerm]);

    // Apply bulk update preview
    const handlePreviewBulkUpdate = () => {
        if (updateValue === 0) return;
        
        const updated = bulkPriceUpdateService.calculateLocalPreview(
            products, 
            updateType, 
            updateValue, 
            roundPrices
        );
        
        setProducts(updated);
        
        // Track all as modified
        const newModified = new Map<number, number>();
        updated.forEach(p => {
            if (p.newPrice !== p.currentPrice) {
                newModified.set(p.id, p.newPrice);
            }
        });
        setModifiedProducts(newModified);
    };

    // Handle individual price edit
    const handlePriceEdit = (productId: number, newValue: string) => {
        const newPrice = parseFloat(newValue) || 0;
        
        setProducts(prev => prev.map(p => {
            if (p.id === productId) {
                return {
                    ...p,
                    newPrice,
                    difference: newPrice - p.currentPrice,
                    percentChange: p.currentPrice > 0 
                        ? ((newPrice - p.currentPrice) / p.currentPrice) * 100 
                        : 0
                };
            }
            return p;
        }));

        // Track modification
        const newModified = new Map(modifiedProducts);
        const original = products.find(p => p.id === productId);
        if (original && newPrice !== original.currentPrice) {
            newModified.set(productId, newPrice);
        } else {
            newModified.delete(productId);
        }
        setModifiedProducts(newModified);
    };

    // Save all changes
    const handleSaveChanges = async () => {
        if (modifiedProducts.size === 0) {
            setError('No hay cambios para guardar');
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const updates = Array.from(modifiedProducts.entries()).map(([id, newPrice]) => ({
                id,
                newPrice
            }));

            const result = await bulkPriceUpdateService.applyUpdates(updates);
            
            setSuccess(`${result.productsUpdated} productos actualizados. Diferencia total: $${(result.totalNewValue - result.totalPreviousValue).toFixed(2)}`);
            
            // Reload fresh data
            await loadData();
        } catch (err: any) {
            setError(err.response?.data?.error?.message || 'Error guardando cambios');
        } finally {
            setSaving(false);
        }
    };

    // Reset all changes
    const handleReset = () => {
        setProducts(prev => prev.map(p => ({
            ...p,
            newPrice: p.currentPrice,
            difference: 0,
            percentChange: 0
        })));
        setModifiedProducts(new Map());
        setUpdateValue(0);
    };

    const hasChanges = modifiedProducts.size > 0;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Actualización Masiva de Precios</h1>
                <p className="text-slate-500">Modifica precios de forma rápida por categoría o individual</p>
            </div>

            {/* Alerts */}
            {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}
            {success && (
                <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
                    <CheckCircle size={18} />
                    {success}
                </div>
            )}

            {/* Controls */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Category Filter */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">
                            <Filter size={12} className="inline mr-1" />
                            Categoría
                        </label>
                        <select
                            value={selectedCategory || ''}
                            onChange={(e) => setSelectedCategory(e.target.value ? parseInt(e.target.value) : undefined)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        >
                            <option value="">Todas las categorías</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Update Type */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">
                            Tipo de Aumento
                        </label>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setUpdateType('PERCENTAGE')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1 ${
                                    updateType === 'PERCENTAGE' 
                                        ? 'bg-indigo-600 text-white' 
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                <Percent size={14} /> %
                            </button>
                            <button
                                onClick={() => setUpdateType('FIXED')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1 ${
                                    updateType === 'FIXED' 
                                        ? 'bg-indigo-600 text-white' 
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                <DollarSign size={14} /> $
                            </button>
                        </div>
                    </div>

                    {/* Update Value */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">
                            Valor del Aumento
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                value={updateValue || ''}
                                onChange={(e) => setUpdateValue(parseFloat(e.target.value) || 0)}
                                placeholder={updateType === 'PERCENTAGE' ? '10' : '50.00'}
                                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                            />
                            <label className="flex items-center gap-1 text-xs text-slate-500">
                                <input
                                    type="checkbox"
                                    checked={roundPrices}
                                    onChange={(e) => setRoundPrices(e.target.checked)}
                                    className="rounded"
                                />
                                Redondear
                            </label>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-end gap-2">
                        <button
                            onClick={handlePreviewBulkUpdate}
                            disabled={updateValue === 0 || loading}
                            className="flex-1 bg-indigo-100 text-indigo-700 py-2 px-3 rounded-lg text-sm font-medium hover:bg-indigo-200 disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                            Aplicar a Todos
                        </button>
                        <button
                            onClick={handleReset}
                            disabled={!hasChanges}
                            className="bg-slate-100 text-slate-600 py-2 px-3 rounded-lg text-sm hover:bg-slate-200 disabled:opacity-50"
                        >
                            <RefreshCw size={14} />
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="mt-4">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar producto..."
                            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Producto</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Categoría</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Precio Actual</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-32">Nuevo Precio</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Diferencia</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">%</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-slate-500">
                                        Cargando productos...
                                    </td>
                                </tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-slate-500">
                                        No se encontraron productos
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map(product => (
                                    <tr 
                                        key={product.id} 
                                        className={`hover:bg-slate-50 ${modifiedProducts.has(product.id) ? 'bg-amber-50' : ''}`}
                                    >
                                        <td className="px-4 py-3 font-medium text-slate-800">{product.name}</td>
                                        <td className="px-4 py-3 text-slate-500 text-sm">{product.categoryName}</td>
                                        <td className="px-4 py-3 text-right text-slate-600">${product.currentPrice.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right">
                                            <input
                                                type="number"
                                                value={product.newPrice}
                                                onChange={(e) => handlePriceEdit(product.id, e.target.value)}
                                                step="0.01"
                                                min="0"
                                                className={`w-24 text-right border rounded px-2 py-1 text-sm ${
                                                    modifiedProducts.has(product.id) 
                                                        ? 'border-amber-400 bg-amber-50' 
                                                        : 'border-slate-200'
                                                }`}
                                            />
                                        </td>
                                        <td className={`px-4 py-3 text-right font-medium ${
                                            product.difference > 0 ? 'text-green-600' : 
                                            product.difference < 0 ? 'text-red-600' : 'text-slate-400'
                                        }`}>
                                            {product.difference > 0 ? '+' : ''}{product.difference.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`inline-flex items-center gap-0.5 text-sm ${
                                                product.percentChange > 0 ? 'text-green-600' : 
                                                product.percentChange < 0 ? 'text-red-600' : 'text-slate-400'
                                            }`}>
                                                {product.percentChange > 0 ? <ArrowUp size={12} /> : 
                                                 product.percentChange < 0 ? <ArrowDown size={12} /> : null}
                                                {Math.abs(product.percentChange).toFixed(1)}%
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Save Bar */}
            {hasChanges && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-lg">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <div className="text-sm text-slate-600">
                            <span className="font-bold text-amber-600">{modifiedProducts.size}</span> productos modificados
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleReset}
                                className="px-4 py-2 text-slate-600 hover:text-slate-800"
                            >
                                Descartar Cambios
                            </button>
                            <button
                                onClick={handleSaveChanges}
                                disabled={saving}
                                className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {saving ? (
                                    <>Guardando...</>
                                ) : (
                                    <><Save size={16} /> Guardar Cambios</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BulkPriceUpdatePage;
