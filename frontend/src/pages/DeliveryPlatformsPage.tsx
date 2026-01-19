/**
 * @fileoverview Delivery Platforms Admin Page
 * Manage external delivery platform integrations
 */

import React, { useState, useEffect } from 'react';
import { deliveryService, type DeliveryPlatform } from '../services/deliveryService';
import { 
    Loader2, Plus, Trash2, ToggleLeft, ToggleRight, 
    Edit, Percent
} from 'lucide-react';

export const DeliveryPlatformsPage: React.FC = () => {
    const [platforms, setPlatforms] = useState<DeliveryPlatform[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingPlatform, setEditingPlatform] = useState<DeliveryPlatform | null>(null);
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        apiKey: '',
        webhookSecret: '',
        storeId: '',
        commissionRate: ''
    });

    useEffect(() => {
        loadPlatforms();
    }, []);

    const loadPlatforms = async () => {
        setLoading(true);
        try {
            const data = await deliveryService.getAllPlatforms();
            setPlatforms(data);
        } catch (err) {
            console.error('Failed to load platforms:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = {
                code: formData.code,
                name: formData.name,
                apiKey: formData.apiKey || undefined,
                webhookSecret: formData.webhookSecret || undefined,
                storeId: formData.storeId || undefined,
                commissionRate: formData.commissionRate ? Number(formData.commissionRate) : undefined
            };

            if (editingPlatform) {
                const updated = await deliveryService.updatePlatform(editingPlatform.id, data);
                setPlatforms(platforms.map(p => p.id === updated.id ? updated : p));
            } else {
                const created = await deliveryService.createPlatform(data);
                setPlatforms([...platforms, created]);
            }
            closeModal();
        } catch (err) {
            console.error('Failed to save platform:', err);
        }
    };

    const handleToggle = async (id: number) => {
        try {
            const updated = await deliveryService.togglePlatform(id);
            setPlatforms(platforms.map(p => p.id === id ? updated : p));
        } catch (err) {
            console.error('Failed to toggle platform:', err);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Eliminar esta plataforma?')) return;
        try {
            await deliveryService.deletePlatform(id);
            setPlatforms(platforms.filter(p => p.id !== id));
        } catch (err) {
            console.error('Failed to delete platform:', err);
        }
    };

    const openEditModal = (platform: DeliveryPlatform) => {
        setEditingPlatform(platform);
        setFormData({
            code: platform.code,
            name: platform.name,
            apiKey: platform.apiKey || '',
            webhookSecret: platform.webhookSecret || '',
            storeId: platform.storeId || '',
            commissionRate: platform.commissionRate?.toString() || ''
        });
        setShowModal(true);
    };

    const openCreateModal = () => {
        setEditingPlatform(null);
        setFormData({
            code: '',
            name: '',
            apiKey: '',
            webhookSecret: '',
            storeId: '',
            commissionRate: ''
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingPlatform(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="animate-spin text-indigo-600" size={48} />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Plataformas de Delivery</h1>
                    <p className="text-slate-500">Gestiona integraciones con PedidosYa, Rappi, Glovo, etc.</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center gap-2"
                >
                    <Plus size={20} />
                    Agregar Plataforma
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                {platforms.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                        No hay plataformas configuradas
                    </div>
                ) : (
                    <div className="divide-y">
                        {platforms.map(platform => (
                            <div key={platform.id} className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                                        platform.isEnabled 
                                            ? 'bg-green-100 text-green-700' 
                                            : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {platform.code}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-700">{platform.name}</p>
                                        <div className="flex items-center gap-3 text-sm text-slate-500">
                                            {platform.storeId && (
                                                <span>Store: {platform.storeId}</span>
                                            )}
                                            {platform.commissionRate && (
                                                <span className="flex items-center gap-1">
                                                    <Percent size={12} />
                                                    {platform.commissionRate}%
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleToggle(platform.id)}
                                        className={`p-2 rounded-lg ${
                                            platform.isEnabled 
                                                ? 'bg-green-100 text-green-600' 
                                                : 'bg-slate-100 text-slate-400'
                                        }`}
                                    >
                                        {platform.isEnabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                    </button>
                                    <button
                                        onClick={() => openEditModal(platform)}
                                        className="p-2 hover:bg-slate-100 rounded-lg"
                                    >
                                        <Edit size={18} className="text-slate-500" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(platform.id)}
                                        className="p-2 hover:bg-red-50 rounded-lg"
                                    >
                                        <Trash2 size={18} className="text-red-500" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">
                            {editingPlatform ? 'Editar Plataforma' : 'Nueva Plataforma'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">
                                    Código
                                </label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                                    className="w-full p-2 border rounded-lg"
                                    placeholder="PEDIDOSYA"
                                    required
                                    disabled={!!editingPlatform}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">
                                    Nombre
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    className="w-full p-2 border rounded-lg"
                                    placeholder="PedidosYa"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">
                                    API Key
                                </label>
                                <input
                                    type="password"
                                    value={formData.apiKey}
                                    onChange={e => setFormData({...formData, apiKey: e.target.value})}
                                    className="w-full p-2 border rounded-lg"
                                    placeholder="••••••••"
                                />
                                <p className="text-xs text-slate-400 mt-1">
                                    Credencial para llamadas salientes a la API de la plataforma
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">
                                    Webhook Secret
                                </label>
                                <input
                                    type="password"
                                    value={formData.webhookSecret}
                                    onChange={e => setFormData({...formData, webhookSecret: e.target.value})}
                                    className="w-full p-2 border rounded-lg"
                                    placeholder="••••••••"
                                />
                                <p className="text-xs text-slate-400 mt-1">
                                    Clave para validar webhooks entrantes (HMAC). Obtenerla del portal de partners.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">
                                    Store ID
                                </label>
                                <input
                                    type="text"
                                    value={formData.storeId}
                                    onChange={e => setFormData({...formData, storeId: e.target.value})}
                                    className="w-full p-2 border rounded-lg"
                                    placeholder="12345"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">
                                    Comisión (%)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.commissionRate}
                                    onChange={e => setFormData({...formData, commissionRate: e.target.value})}
                                    className="w-full p-2 border rounded-lg"
                                    placeholder="15.00"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-lg"
                                >
                                    {editingPlatform ? 'Guardar' : 'Crear'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DeliveryPlatformsPage;
