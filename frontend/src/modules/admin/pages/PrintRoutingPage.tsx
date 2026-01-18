import React, { useState, useEffect } from 'react';
import { Loader2, Printer as PrinterIcon, MapPin, Tag, X, Check, ChevronDown, AlertCircle } from 'lucide-react';
import { printRoutingService, type PrintRoutingConfig, type PrintRoutingArea } from '../../../services/printRoutingService';

/**
 * Print Routing Configuration Page
 * Allows configuring which printers receive orders based on:
 * 1. Category (global default)
 * 2. Area overrides (local exceptions)
 */
export const PrintRoutingPage: React.FC = () => {
    const [config, setConfig] = useState<PrintRoutingConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedArea, setExpandedArea] = useState<number | null>(null);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await printRoutingService.getConfiguration();
            setConfig(data);
        } catch (err) {
            console.error('Failed to load print routing config', err);
            setError('No se pudo cargar la configuración');
        } finally {
            setLoading(false);
        }
    };

    const handleCategoryPrinterChange = async (categoryId: number, printerId: number | null) => {
        if (!config) return;
        
        setSaving(`category-${categoryId}`);
        try {
            await printRoutingService.setCategoryPrinter(categoryId, printerId);
            // Update local state
            setConfig({
                ...config,
                categories: config.categories.map(c => 
                    c.id === categoryId 
                        ? { ...c, printerId, printerName: config.printers.find(p => p.id === printerId)?.name ?? null }
                        : c
                )
            });
        } catch (err) {
            console.error('Failed to update category printer', err);
            setError('Error al actualizar');
        } finally {
            setSaving(null);
        }
    };

    const handleAreaOverride = async (areaId: number, categoryId: number | null, printerId: number) => {
        if (!config) return;

        setSaving(`area-${areaId}-${categoryId}`);
        try {
            await printRoutingService.setAreaOverride(areaId, categoryId, printerId);
            await loadConfig(); // Reload to get updated state
        } catch (err) {
            console.error('Failed to set area override', err);
            setError('Error al configurar override');
        } finally {
            setSaving(null);
        }
    };

    const handleRemoveAreaOverride = async (areaId: number, categoryId: number | null) => {
        if (!config) return;

        setSaving(`remove-${areaId}-${categoryId}`);
        try {
            await printRoutingService.removeAreaOverride(areaId, categoryId);
            await loadConfig();
        } catch (err) {
            console.error('Failed to remove area override', err);
            setError('Error al eliminar override');
        } finally {
            setSaving(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
        );
    }

    if (!config) {
        return (
            <div className="p-8 text-center text-red-600">
                <AlertCircle className="mx-auto mb-2" size={48} />
                <p>{error || 'Error al cargar configuración'}</p>
                <button onClick={loadConfig} className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg">
                    Reintentar
                </button>
            </div>
        );
    }

    const hasNoPrinters = config.printers.length === 0;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Enrutamiento de Impresión</h1>
                <p className="text-slate-500 mt-1">
                    Configura qué impresora recibe los tickets de cada categoría
                </p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
                    <AlertCircle size={20} />
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto">
                        <X size={16} />
                    </button>
                </div>
            )}

            {hasNoPrinters && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl">
                    <strong>⚠️ No hay impresoras configuradas.</strong>
                    <p className="text-sm mt-1">
                        Primero agrega impresoras en la sección de Impresoras para poder configurar el enrutamiento.
                    </p>
                </div>
            )}

            {/* Level 1: Category → Printer */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b flex items-center gap-2">
                    <Tag className="text-indigo-600" size={20} />
                    <h2 className="text-lg font-bold text-slate-800">Impresora por Categoría</h2>
                    <span className="text-sm text-slate-500">(Configuración Global)</span>
                </div>
                
                <div className="p-4">
                    <p className="text-sm text-slate-600 mb-4">
                        Define qué impresora recibe los tickets de cada categoría de productos.
                        Ejemplo: "Bebidas" → Impresora Barra, "Platos" → Impresora Cocina
                    </p>

                    <div className="grid gap-3">
                        {config.categories.map(category => (
                            <div 
                                key={category.id}
                                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                            >
                                <span className="font-medium text-slate-700">{category.name}</span>
                                <div className="flex items-center gap-2">
                                    {saving === `category-${category.id}` && (
                                        <Loader2 className="animate-spin text-indigo-600" size={16} />
                                    )}
                                    <select
                                        value={category.printerId ?? ''}
                                        onChange={(e) => handleCategoryPrinterChange(
                                            category.id, 
                                            e.target.value ? Number(e.target.value) : null
                                        )}
                                        disabled={saving !== null || hasNoPrinters}
                                        className="border border-slate-300 rounded-lg px-3 py-2 bg-white min-w-[200px] disabled:opacity-50"
                                    >
                                        <option value="">Sin impresora</option>
                                        {config.printers.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Level 2: Area Overrides */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b flex items-center gap-2">
                    <MapPin className="text-green-600" size={20} />
                    <h2 className="text-lg font-bold text-slate-800">Overrides por Área</h2>
                    <span className="text-sm text-slate-500">(Excepciones Locales)</span>
                </div>

                <div className="p-4">
                    <p className="text-sm text-slate-600 mb-4">
                        Configura excepciones para áreas específicas. Por ejemplo, el área "Terraza" 
                        puede enviar todo a una impresora diferente.
                    </p>

                    {config.areas.length === 0 ? (
                        <p className="text-slate-500 text-center py-4">No hay áreas configuradas</p>
                    ) : (
                        <div className="space-y-3">
                            {config.areas.map(area => (
                                <AreaOverrideCard
                                    key={area.id}
                                    area={area}
                                    printers={config.printers}
                                    categories={config.categories}
                                    expanded={expandedArea === area.id}
                                    onToggle={() => setExpandedArea(expandedArea === area.id ? null : area.id)}
                                    onSetOverride={(categoryId, printerId) => handleAreaOverride(area.id, categoryId, printerId)}
                                    onRemoveOverride={(categoryId) => handleRemoveAreaOverride(area.id, categoryId)}
                                    saving={saving}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface AreaOverrideCardProps {
    area: PrintRoutingArea;
    printers: { id: number; name: string }[];
    categories: { id: number; name: string }[];
    expanded: boolean;
    onToggle: () => void;
    onSetOverride: (categoryId: number | null, printerId: number) => void;
    onRemoveOverride: (categoryId: number | null) => void;
    saving: string | null;
}

const AreaOverrideCard: React.FC<AreaOverrideCardProps> = ({
    area,
    printers,
    categories,
    expanded,
    onToggle,
    onSetOverride,
    onRemoveOverride,
    saving
}) => {
    const [newCategoryId, setNewCategoryId] = useState<string>('');
    const [newPrinterId, setNewPrinterId] = useState<string>('');

    const hasAreaWideOverride = area.overrides.some(o => o.categoryId === null);
    const areaWideOverride = area.overrides.find(o => o.categoryId === null);

    const handleAddOverride = () => {
        if (!newPrinterId) return;
        const categoryId = newCategoryId === 'all' ? null : (newCategoryId ? Number(newCategoryId) : null);
        onSetOverride(categoryId, Number(newPrinterId));
        setNewCategoryId('');
        setNewPrinterId('');
    };

    return (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <MapPin className="text-green-600" size={18} />
                    <span className="font-semibold text-slate-700">{area.name}</span>
                    {area.overrides.length > 0 && (
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                            {area.overrides.length} override{area.overrides.length > 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                <ChevronDown className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} size={20} />
            </button>

            {expanded && (
                <div className="p-4 border-t bg-white space-y-4">
                    {/* Quick action: Area-wide override */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <label className="flex items-center gap-2 text-sm text-blue-800 font-medium">
                            <PrinterIcon size={16} />
                            Override general (todo a una impresora):
                        </label>
                        <div className="flex items-center gap-2 mt-2">
                            <select
                                value={areaWideOverride?.printerId ?? ''}
                                onChange={(e) => {
                                    if (e.target.value) {
                                        onSetOverride(null, Number(e.target.value));
                                    } else if (areaWideOverride) {
                                        onRemoveOverride(null);
                                    }
                                }}
                                className="flex-1 border border-blue-300 rounded-lg px-3 py-2 bg-white"
                                disabled={saving !== null}
                            >
                                <option value="">Usar configuración por categoría</option>
                                {printers.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            {saving?.includes(`area-${area.id}-null`) && (
                                <Loader2 className="animate-spin text-blue-600" size={16} />
                            )}
                        </div>
                    </div>

                    {/* Existing category-specific overrides */}
                    {area.overrides.filter(o => o.categoryId !== null).length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold text-slate-600 mb-2">Overrides por categoría:</h4>
                            <div className="space-y-2">
                                {area.overrides.filter(o => o.categoryId !== null).map(override => (
                                    <div key={override.id} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg">
                                        <span className="text-sm">
                                            <span className="font-medium">{override.categoryName}</span>
                                            <span className="text-slate-400 mx-2">→</span>
                                            <span className="text-green-700">{override.printerName}</span>
                                        </span>
                                        <button
                                            onClick={() => onRemoveOverride(override.categoryId)}
                                            className="text-red-500 hover:text-red-700 p-1"
                                            disabled={saving !== null}
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Add new category-specific override */}
                    {!hasAreaWideOverride && (
                        <div className="border-t pt-4">
                            <h4 className="text-sm font-semibold text-slate-600 mb-2">Agregar override por categoría:</h4>
                            <div className="flex items-center gap-2">
                                <select
                                    value={newCategoryId}
                                    onChange={(e) => setNewCategoryId(e.target.value)}
                                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 bg-white"
                                >
                                    <option value="">Seleccionar categoría...</option>
                                    {categories
                                        .filter(c => !area.overrides.some(o => o.categoryId === c.id))
                                        .map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))
                                    }
                                </select>
                                <select
                                    value={newPrinterId}
                                    onChange={(e) => setNewPrinterId(e.target.value)}
                                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 bg-white"
                                >
                                    <option value="">Seleccionar impresora...</option>
                                    {printers.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={handleAddOverride}
                                    disabled={!newCategoryId || !newPrinterId || saving !== null}
                                    className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                    <Check size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PrintRoutingPage;
