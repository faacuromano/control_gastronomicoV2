/**
 * @fileoverview QR Menu Admin Page
 * Manage QR codes and menu configuration
 */

import React, { useState, useEffect } from 'react';
import { qrService, type QrCodeData, type QrMenuConfig } from '../services/qrService';
import { tableService } from '../services/tableService';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { 
    QrCode, Settings, Plus, Trash2, ToggleLeft, ToggleRight, 
    Loader2, Copy, ExternalLink, FileText, Image, Palette,
    ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react';

interface TableOption {
    id: number;
    name: string;
    areaName: string;
}

export const QrAdminPage: React.FC = () => {
    const [config, setConfig] = useState<QrMenuConfig | null>(null);
    const [codes, setCodes] = useState<QrCodeData[]>([]);
    const [tables, setTables] = useState<TableOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [selectedTableId, setSelectedTableId] = useState<number | ''>('');
    const [showStyleOptions, setShowStyleOptions] = useState(false);
    
    // Check global module enabled status
    const { features, loading: loadingFlags } = useFeatureFlags();
    const isModuleEnabled = features?.enableDigital ?? false;

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [configData, codesData, areasData] = await Promise.all([
                qrService.getConfig(),
                qrService.getAllCodes(),
                tableService.getAreas()
            ]);
            setConfig(configData);
            setCodes(codesData);
            
            // Flatten tables from areas
            const allTables: TableOption[] = [];
            areasData.forEach((area: any) => {
                area.tables.forEach((table: any) => {
                    allTables.push({
                        id: table.id,
                        name: table.name,
                        areaName: area.name
                    });
                });
            });
            setTables(allTables);
        } catch (err) {
            console.error('Failed to load QR data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateConfig = async (updates: any) => {
        try {
            const updated = await qrService.updateConfig(updates);
            setConfig(updated);
        } catch (err) {
            console.error('Failed to update config:', err);
        }
    };

    const handleToggleEnabled = () => handleUpdateConfig({ qrMenuEnabled: !config?.enabled });
    const handleToggleMode = () => handleUpdateConfig({ qrMenuMode: config?.mode === 'INTERACTIVE' ? 'STATIC' : 'INTERACTIVE' });
    const handleToggleSelfOrder = () => handleUpdateConfig({ qrSelfOrderEnabled: !config?.selfOrderEnabled });

    const handleGenerateCode = async () => {
        setGenerating(true);
        try {
            const newCode = await qrService.generateCode(
                selectedTableId ? Number(selectedTableId) : undefined
            );
            setCodes([newCode, ...codes]);
            setSelectedTableId('');
        } catch (err) {
            console.error('Failed to generate QR:', err);
        } finally {
            setGenerating(false);
        }
    };

    const handleToggleCode = async (id: number) => {
        try {
            const updated = await qrService.toggleCode(id);
            setCodes(codes.map(c => c.id === id ? updated : c));
        } catch (err) {
            console.error('Failed to toggle code:', err);
        }
    };

    const handleDeleteCode = async (id: number) => {
        if (!confirm('¿Eliminar este código QR?')) return;
        try {
            await qrService.deleteCode(id);
            setCodes(codes.filter(c => c.id !== id));
        } catch (err) {
            console.error('Failed to delete code:', err);
        }
    };

    const copyUrl = (code: string) => {
        const url = qrService.getQrUrl(code);
        navigator.clipboard.writeText(url);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="animate-spin text-indigo-600" size={48} />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
                <QrCode size={32} className="text-indigo-600" />
                <h1 className="text-2xl font-bold text-slate-800">Menú QR</h1>
            </div>

            {/* Warning: Module disabled globally */}
            {!loadingFlags && !isModuleEnabled && (
                <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-300 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={24} />
                    <div>
                        <p className="font-bold text-amber-800">Módulo Deshabilitado</p>
                        <p className="text-sm text-amber-700">
                            El módulo de Menú Digital / QR está desactivado en <strong>Configuración General</strong>.
                            Los códigos QR generados no funcionarán hasta que lo actives.
                        </p>
                        <a 
                            href="/admin/settings" 
                            className="mt-2 inline-block text-sm font-bold text-amber-800 underline hover:text-amber-900"
                        >
                            Ir a Configuración →
                        </a>
                    </div>
                </div>
            )}

            {/* Configuration Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Settings size={20} className="text-slate-500" />
                    <h2 className="text-lg font-bold text-slate-700">Configuración</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Enable/Disable */}
                    <div className="p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-slate-700">Menú QR</p>
                                <p className="text-sm text-slate-500">
                                    {config?.enabled ? 'Habilitado' : 'Deshabilitado'}
                                </p>
                            </div>
                            <button
                                onClick={handleToggleEnabled}
                                className={`p-2 rounded-lg ${config?.enabled ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-400'}`}
                            >
                                {config?.enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                            </button>
                        </div>
                    </div>

                    {/* Mode */}
                    <div className="p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-slate-700">Modo</p>
                                <p className="text-sm text-slate-500">
                                    {config?.mode === 'INTERACTIVE' ? 'Interactivo' : 'PDF/Imagen'}
                                </p>
                            </div>
                            <button
                                onClick={handleToggleMode}
                                className="p-2 rounded-lg bg-indigo-100 text-indigo-600"
                            >
                                {config?.mode === 'INTERACTIVE' ? <FileText size={24} /> : <Image size={24} />}
                            </button>
                        </div>
                    </div>

                    {/* Self-Order */}
                    <div className="p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-slate-700">Pedidos desde QR</p>
                                <p className="text-sm text-slate-500">
                                    {config?.selfOrderEnabled ? 'Permitidos' : 'Solo lectura'}
                                </p>
                            </div>
                            <button
                                onClick={handleToggleSelfOrder}
                                className={`p-2 rounded-lg ${config?.selfOrderEnabled ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-400'}`}
                            >
                                {config?.selfOrderEnabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Visual Customization Section - Collapsible */}
                <div className="mt-8 pt-8 border-t border-slate-100">
                    <button
                        onClick={() => setShowStyleOptions(!showStyleOptions)}
                        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors group"
                    >
                        <div className="flex items-center gap-2">
                            <Palette size={20} className="text-indigo-600" />
                            <h3 className="font-bold text-slate-700">Estilo del Menú</h3>
                            <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded-full">
                                {config?.theme?.fontFamily || 'Outfit'} • {(config?.theme?.enableAnimations ?? true) ? 'Animado' : 'Estático'}
                            </span>
                        </div>
                        {showStyleOptions ? (
                            <ChevronUp size={20} className="text-slate-400 group-hover:text-slate-600" />
                        ) : (
                            <ChevronDown size={20} className="text-slate-400 group-hover:text-slate-600" />
                        )}
                    </button>

                    {showStyleOptions && (
                        <div className="mt-4 space-y-6 p-4 bg-slate-50/50 rounded-lg border border-slate-100">
                            {/* Theme Presets */}
                            <div>
                                <label className="text-sm font-medium text-slate-600 block mb-2">Plantillas Prediseñadas</label>
                                <div className="grid grid-cols-3 gap-3">
                                    <button
                                        onClick={() => handleUpdateConfig({ qrMenuTheme: {
                                            backgroundColor: '#2c2e2c',
                                            primaryColor: '#ffffff',
                                            secondaryColor: 'rgba(254, 243, 199, 0.6)',
                                            accentColor: '#fef3c7',
                                            fontFamily: 'Outfit',
                                            enableAnimations: true
                                        }})}
                                        className="p-4 rounded-lg border-2 border-slate-200 hover:border-indigo-400 transition-colors"
                                    >
                                        <div className="w-full h-16 bg-gradient-to-br from-slate-800 to-slate-900 rounded mb-2" />
                                        <p className="text-xs font-bold text-slate-700">Clásico Oscuro</p>
                                        <p className="text-[10px] text-slate-400">Por defecto</p>
                                    </button>
                                    <button
                                        onClick={() => handleUpdateConfig({ qrMenuTheme: {
                                            backgroundColor: '#f5f5dc',
                                            primaryColor: '#2c2416',
                                            secondaryColor: 'rgba(44, 36, 22, 0.6)',
                                            accentColor: '#8b7355',
                                            fontFamily: 'Playfair Display',
                                            enableAnimations: true
                                        }})}
                                        className="p-4 rounded-lg border-2 border-slate-200 hover:border-indigo-400 transition-colors"
                                    >
                                        <div className="w-full h-16 bg-gradient-to-br from-[#f5f5dc] to-[#e8e4d0] rounded mb-2" />
                                        <p className="text-xs font-bold text-slate-700">Elegante Claro</p>
                                        <p className="text-[10px] text-slate-400">Vintage</p>
                                    </button>
                                    <button
                                        onClick={() => handleUpdateConfig({ qrMenuTheme: {
                                            backgroundColor: '#ffffff',
                                            primaryColor: '#000000',
                                            secondaryColor: 'rgba(0, 0, 0, 0.5)',
                                            accentColor: '#000000',
                                            fontFamily: 'Montserrat',
                                            enableAnimations: false
                                        }})}
                                        className="p-4 rounded-lg border-2 border-slate-200 hover:border-indigo-400 transition-colors"
                                    >
                                        <div className="w-full h-16 bg-gradient-to-br from-white to-gray-100 rounded mb-2 border border-slate-200" />
                                        <p className="text-xs font-bold text-slate-700">Minimalista</p>
                                        <p className="text-[10px] text-slate-400">Moderno</p>
                                    </button>
                                </div>
                            </div>

                            {/* Custom Colors */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-600 block">Fondo del Menú</label>
                                    <input 
                                        type="color" 
                                        value={config?.theme?.backgroundColor || '#2c2e2c'}
                                        onChange={(e) => handleUpdateConfig({ qrMenuTheme: { ...(config?.theme || {}), backgroundColor: e.target.value } })}
                                        className="w-full h-10 rounded-lg cursor-pointer border-none p-0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-600 block">Texto Principal</label>
                                    <input 
                                        type="color" 
                                        value={config?.theme?.primaryColor || '#ffffff'}
                                        onChange={(e) => handleUpdateConfig({ qrMenuTheme: { ...(config?.theme || {}), primaryColor: e.target.value } })}
                                        className="w-full h-10 rounded-lg cursor-pointer border-none p-0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-600 block">Texto Secundario</label>
                                    <input 
                                        type="color" 
                                        value={config?.theme?.secondaryColor || '#fef3c7'}
                                        onChange={(e) => handleUpdateConfig({ qrMenuTheme: { ...(config?.theme || {}), secondaryColor: e.target.value } })}
                                        className="w-full h-10 rounded-lg cursor-pointer border-none p-0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-600 block">Color de Acento (Botones)</label>
                                    <input 
                                        type="color" 
                                        value={config?.theme?.accentColor || '#fef3c7'}
                                        onChange={(e) => handleUpdateConfig({ qrMenuTheme: { ...(config?.theme || {}), accentColor: e.target.value } })}
                                        className="w-full h-10 rounded-lg cursor-pointer border-none p-0"
                                    />
                                </div>
                            </div>

                            {/* Typography & Effects */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-600 block">Tipografía</label>
                                    <select
                                        value={config?.theme?.fontFamily || 'Outfit'}
                                        onChange={(e) => handleUpdateConfig({ qrMenuTheme: { ...(config?.theme || {}), fontFamily: e.target.value } })}
                                        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    >
                                        <option value="Outfit" style={{ fontFamily: 'Outfit' }}>Outfit (Moderno)</option>
                                        <option value="Playfair Display" style={{ fontFamily: 'Playfair Display' }}>Playfair Display (Elegante)</option>
                                        <option value="Roboto" style={{ fontFamily: 'Roboto' }}>Roboto (Neutro)</option>
                                        <option value="Merriweather" style={{ fontFamily: 'Merriweather' }}>Merriweather (Clásico)</option>
                                        <option value="Montserrat" style={{ fontFamily: 'Montserrat' }}>Montserrat (Contemporáneo)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-600 block">Animaciones</label>
                                    <button
                                        onClick={() => handleUpdateConfig({ qrMenuTheme: { ...(config?.theme || {}), enableAnimations: !(config?.theme?.enableAnimations ?? true) } })}
                                        className={`w-full p-3 rounded-lg font-medium transition-all ${
                                            (config?.theme?.enableAnimations ?? true)
                                                ? 'bg-green-100 text-green-700 border-2 border-green-300'
                                                : 'bg-slate-100 text-slate-500 border-2 border-slate-300'
                                        }`}
                                    >
                                        {(config?.theme?.enableAnimations ?? true) ? '✓ Activadas' : '✗ Desactivadas'}
                                    </button>
                                </div>
                            </div>

                            <p className="text-xs text-slate-400 italic">
                                * Los cambios se aplican instantáneamente al menú público.
                            </p>
                        </div>
                    )}
                </div>

                {/* Static Mode Config (PDF/Image URL) */}
                {config?.mode === 'STATIC' && (
                    <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <h3 className="font-bold text-amber-800 mb-3 flex items-center gap-2">
                            <FileText size={18} />
                            Configuración Modo Estático
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    URL del PDF o Imagen del Menú
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="url"
                                        value={config?.pdfUrl || ''}
                                        onChange={async (e) => {
                                            const url = e.target.value;
                                            try {
                                                const updated = await qrService.updateConfig({
                                                    qrMenuPdfUrl: url || null
                                                });
                                                setConfig(updated);
                                            } catch (err) {
                                                console.error('Failed to update PDF URL:', err);
                                            }
                                        }}
                                        className="flex-1 p-2 border rounded-lg"
                                        placeholder="https://example.com/menu.pdf"
                                    />
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    Ingresa la URL de un PDF o imagen (Google Drive, Dropbox, etc.)
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    URL del Banner (opcional)
                                </label>
                                <input
                                    type="url"
                                    value={config?.bannerUrl || ''}
                                    onChange={async (e) => {
                                        const url = e.target.value;
                                        try {
                                            const updated = await qrService.updateConfig({
                                                qrMenuBannerUrl: url || null
                                            });
                                            setConfig(updated);
                                        } catch (err) {
                                            console.error('Failed to update banner URL:', err);
                                        }
                                    }}
                                    className="w-full p-2 border rounded-lg"
                                    placeholder="https://example.com/banner.jpg"
                                />
                            </div>
                            {config?.pdfUrl && (
                                <div className="flex items-center gap-2">
                                    <a 
                                        href={config.pdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2 hover:bg-indigo-700"
                                    >
                                        <ExternalLink size={16} />
                                        Ver Menú
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Generate QR Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                <h2 className="text-lg font-bold text-slate-700 mb-4">Generar Código QR</h2>
                
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-600 mb-1">
                            Mesa (opcional)
                        </label>
                        <select
                            value={selectedTableId}
                            onChange={(e) => setSelectedTableId(e.target.value ? Number(e.target.value) : '')}
                            className="w-full p-2 border rounded-lg"
                        >
                            <option value="">QR Genérico (sin mesa)</option>
                            {tables.map(t => (
                                <option key={t.id} value={t.id}>
                                    {t.name} ({t.areaName})
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={handleGenerateCode}
                        disabled={generating}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center gap-2 disabled:opacity-50"
                    >
                        {generating ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                        Generar QR
                    </button>
                </div>
            </div>

            {/* QR Codes List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-bold text-slate-700 mb-4">
                    Códigos QR ({codes.length})
                </h2>

                {codes.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">
                        No hay códigos QR generados
                    </p>
                ) : (
                    <div className="divide-y">
                        {codes.map(code => (
                            <div key={code.id} className="py-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg ${code.isActive ? 'bg-green-100' : 'bg-slate-100'}`}>
                                        <QrCode size={24} className={code.isActive ? 'text-green-600' : 'text-slate-400'} />
                                    </div>
                                    <div>
                                        <p className="font-mono font-bold text-slate-700">{code.code}</p>
                                        <p className="text-sm text-slate-500">
                                            {code.tableName || 'QR Genérico'} • {code.scansCount} escaneos
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => copyUrl(code.code)}
                                        className="p-2 hover:bg-slate-100 rounded-lg"
                                        title="Copiar URL"
                                    >
                                        <Copy size={18} className="text-slate-500" />
                                    </button>
                                    <a
                                        href={qrService.getQrUrl(code.code)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 hover:bg-slate-100 rounded-lg"
                                        title="Abrir"
                                    >
                                        <ExternalLink size={18} className="text-slate-500" />
                                    </a>
                                    <button
                                        onClick={() => handleToggleCode(code.id)}
                                        className={`p-2 rounded-lg ${code.isActive ? 'hover:bg-red-50' : 'hover:bg-green-50'}`}
                                        title={code.isActive ? 'Desactivar' : 'Activar'}
                                    >
                                        {code.isActive ? 
                                            <ToggleRight size={18} className="text-green-600" /> : 
                                            <ToggleLeft size={18} className="text-slate-400" />
                                        }
                                    </button>
                                    <button
                                        onClick={() => handleDeleteCode(code.id)}
                                        className="p-2 hover:bg-red-50 rounded-lg"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={18} className="text-red-500" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default QrAdminPage;
