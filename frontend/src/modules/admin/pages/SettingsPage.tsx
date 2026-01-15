import React, { useState, useEffect } from 'react';
import { Settings, Package, Truck, Monitor, FileText, Smartphone, Save, Loader2 } from 'lucide-react';
import { configService, type TenantConfig } from '../../../services/configService';

interface FeatureToggle {
    key: keyof TenantConfig['features'];
    label: string;
    description: string;
    icon: React.ReactNode;
}

const FEATURE_TOGGLES: FeatureToggle[] = [
    {
        key: 'enableStock',
        label: 'Gestión de Stock',
        description: 'Control de inventario y movimientos de ingredientes',
        icon: <Package className="w-5 h-5" />
    },
    {
        key: 'enableDelivery',
        label: 'Delivery',
        description: 'Módulo de envíos y despacho a domicilio',
        icon: <Truck className="w-5 h-5" />
    },
    {
        key: 'enableKDS',
        label: 'Pantalla de Cocina (KDS)',
        description: 'Kitchen Display System para visualización de órdenes',
        icon: <Monitor className="w-5 h-5" />
    },
    {
        key: 'enableFiscal',
        label: 'Facturación Fiscal',
        description: 'Emisión de comprobantes fiscales electrónicos',
        icon: <FileText className="w-5 h-5" />
    },
    {
        key: 'enableDigital',
        label: 'Menú Digital / QR',
        description: 'Menú web accesible por código QR',
        icon: <Smartphone className="w-5 h-5" />
    }
];

export const SettingsPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [businessName, setBusinessName] = useState('');
    const [currencySymbol, setCurrencySymbol] = useState('$');
    const [features, setFeatures] = useState<TenantConfig['features']>({
        enableStock: true,
        enableDelivery: true,
        enableKDS: false,
        enableFiscal: false,
        enableDigital: false
    });
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            configService.clearCache();
            const data = await configService.getConfig();
            setBusinessName(data.businessName);
            setCurrencySymbol(data.currencySymbol);
            setFeatures(data.features);
        } catch (error) {
            console.error('Error loading config:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFeatureToggle = (key: keyof TenantConfig['features']) => {
        setFeatures(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await configService.updateConfig({
                businessName,
                currencySymbol,
                ...features
            } as any);
            setHasChanges(false);
            // Force reload to update Header navigation
            window.location.reload();
        } catch (error) {
            console.error('Error saving config:', error);
            alert('Error al guardar la configuración');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-primary/10 rounded-xl">
                    <Settings className="w-8 h-8 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Configuración del Sistema</h1>
                    <p className="text-muted-foreground">Ajusta los módulos y preferencias del negocio</p>
                </div>
            </div>

            {/* Business Info */}
            <section className="bg-card border border-border rounded-xl p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Información del Negocio</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Nombre del Negocio</label>
                        <input
                            type="text"
                            value={businessName}
                            onChange={(e) => { setBusinessName(e.target.value); setHasChanges(true); }}
                            className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Símbolo de Moneda</label>
                        <input
                            type="text"
                            value={currencySymbol}
                            onChange={(e) => { setCurrencySymbol(e.target.value); setHasChanges(true); }}
                            className="w-24 px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-center"
                            maxLength={3}
                        />
                    </div>
                </div>
            </section>

            {/* Feature Toggles */}
            <section className="bg-card border border-border rounded-xl p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Módulos del Sistema</h2>
                <p className="text-sm text-muted-foreground mb-6">
                    Activa o desactiva funcionalidades según las necesidades de tu negocio.
                    Los módulos desactivados no aparecerán en el menú de navegación.
                </p>
                
                <div className="space-y-4">
                    {FEATURE_TOGGLES.map((toggle) => (
                        <div 
                            key={toggle.key}
                            className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg ${features[toggle.key] ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                    {toggle.icon}
                                </div>
                                <div>
                                    <h3 className="font-medium">{toggle.label}</h3>
                                    <p className="text-sm text-muted-foreground">{toggle.description}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleFeatureToggle(toggle.key)}
                                className={`relative w-14 h-7 rounded-full transition-colors ${
                                    features[toggle.key] ? 'bg-primary' : 'bg-muted-foreground/30'
                                }`}
                            >
                                <span 
                                    className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                                        features[toggle.key] ? 'left-8' : 'left-1'
                                    }`}
                                />
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {/* Save Button */}
            {hasChanges && (
                <div className="fixed bottom-6 right-6 z-50">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg font-medium transition-all disabled:opacity-50"
                    >
                        {saving ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Save className="w-5 h-5" />
                        )}
                        Guardar Cambios
                    </button>
                </div>
            )}
        </div>
    );
};
