import React, { useState, useEffect } from 'react';
import { Plus, Loader2, Save, X, ToggleLeft, ToggleRight, Trash2, MonitorPlay, Star, StarOff } from 'lucide-react';
import * as kdsStationService from '../../../services/kdsStationService';
import type { KdsStation, KdsStationInput } from '../../../services/kdsStationService';
import { toast } from 'sonner';
import { getErrorMessage } from '../../../lib/errorUtils';
import { confirmDelete } from '../../../lib/confirmDialog';

export const KdsStationsPage: React.FC = () => {
    const [stations, setStations] = useState<KdsStation[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStation, setEditingStation] = useState<KdsStation | null>(null);

    // Form state
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [sortOrder, setSortOrder] = useState(0);
    const [isActive, setIsActive] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await kdsStationService.getStations();
            setStations(data);
        } catch (error) {
            console.error('Failed to load KDS stations', error);
            toast.error(getErrorMessage(error, 'Error al cargar estaciones'));
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setCode('');
        setName('');
        setSortOrder(stations.length + 1);
        setIsActive(true);
        setEditingStation(null);
    };

    const openModal = (station?: KdsStation) => {
        if (station) {
            setEditingStation(station);
            setCode(station.code);
            setName(station.name);
            setSortOrder(station.sortOrder);
            setIsActive(station.isActive);
        } else {
            resetForm();
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data: KdsStationInput = { code, name, sortOrder, isActive };
            if (editingStation) {
                await kdsStationService.updateStation(editingStation.id, data);
                toast.success('Estación actualizada');
            } else {
                await kdsStationService.createStation(data);
                toast.success('Estación creada');
            }
            setIsModalOpen(false);
            resetForm();
            loadData();
        } catch (error: unknown) {
            console.error('Failed to save', error);
            toast.error(getErrorMessage(error, 'Error al guardar'));
        }
    };

    const handleToggleActive = async (station: KdsStation) => {
        try {
            await kdsStationService.updateStation(station.id, { isActive: !station.isActive });
            loadData();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'Error al cambiar estado'));
        }
    };

    const handleSetDefault = async (id: number) => {
        try {
            await kdsStationService.setDefaultStation(id);
            toast.success('Estación por defecto actualizada');
            loadData();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'Error al establecer por defecto'));
        }
    };

    const handleDelete = async (id: number) => {
        if (!await confirmDelete('esta estación KDS')) return;
        try {
            await kdsStationService.deleteStation(id);
            toast.success('Estación eliminada');
            loadData();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'Error al eliminar. Verifica que no tenga productos o categorías asignados.'));
        }
    };

    const handleSeedDefaults = async () => {
        try {
            await kdsStationService.seedDefaultStations();
            toast.success('Estaciones por defecto creadas');
            loadData();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'Error al crear estaciones por defecto'));
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Estaciones KDS</h1>
                    <p className="text-slate-500 mt-1">
                        Configura las estaciones de cocina para enrutar items a diferentes pantallas
                    </p>
                </div>
                <div className="flex gap-2">
                    {stations.length === 0 && (
                        <button
                            onClick={handleSeedDefaults}
                            className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            Cargar por defecto
                        </button>
                    )}
                    <button
                        onClick={() => openModal()}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
                    >
                        <Plus size={20} /> Nueva Estación
                    </button>
                </div>
            </div>

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-800">
                <p className="text-sm">
                    <strong>Cómo funciona:</strong> Asigna una estación a cada categoría o producto desde su configuración.
                    Los items de los pedidos se enrutarán automáticamente a la pantalla KDS correspondiente (ej: bebidas a Barra, platos a Cocina).
                </p>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-100">
                {loading ? (
                    <div className="p-8 flex justify-center">
                        <Loader2 className="animate-spin text-indigo-600" size={32} />
                    </div>
                ) : stations.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        <MonitorPlay className="mx-auto mb-3 text-slate-300" size={48} />
                        <p>No hay estaciones KDS configuradas</p>
                        <p className="text-sm mt-1">Haz clic en "Cargar por defecto" para crear Cocina, Barra, Fría y Postres</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="text-left p-4 font-semibold text-slate-600">Código</th>
                                <th className="text-left p-4 font-semibold text-slate-600">Nombre</th>
                                <th className="text-center p-4 font-semibold text-slate-600">Orden</th>
                                <th className="text-center p-4 font-semibold text-slate-600">Productos</th>
                                <th className="text-center p-4 font-semibold text-slate-600">Categorías</th>
                                <th className="text-center p-4 font-semibold text-slate-600">Por Defecto</th>
                                <th className="text-center p-4 font-semibold text-slate-600">Activo</th>
                                <th className="text-right p-4 font-semibold text-slate-600">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {stations.map(station => (
                                <tr key={station.id} className={`hover:bg-slate-50 transition-colors ${!station.isActive ? 'opacity-50' : ''}`}>
                                    <td className="p-4 font-mono font-bold text-slate-800">{station.code}</td>
                                    <td className="p-4 text-slate-700">{station.name}</td>
                                    <td className="p-4 text-center text-slate-600">{station.sortOrder}</td>
                                    <td className="p-4 text-center text-slate-600">{station._count?.products ?? 0}</td>
                                    <td className="p-4 text-center text-slate-600">{station._count?.categories ?? 0}</td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => handleSetDefault(station.id)}
                                            className={station.isDefault ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}
                                            title={station.isDefault ? 'Estación por defecto' : 'Establecer como por defecto'}
                                        >
                                            {station.isDefault ? <Star size={24} fill="currentColor" /> : <StarOff size={24} />}
                                        </button>
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => handleToggleActive(station)}
                                            className={station.isActive ? 'text-green-600' : 'text-slate-400'}
                                        >
                                            {station.isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                        </button>
                                    </td>
                                    <td className="p-4 text-right space-x-2">
                                        <button
                                            onClick={() => openModal(station)}
                                            className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-sm font-bold hover:bg-indigo-200"
                                        >
                                            Editar
                                        </button>
                                        <button
                                            onClick={() => handleDelete(station.id)}
                                            className="bg-red-100 text-red-600 px-2 py-1 rounded-lg hover:bg-red-200"
                                            disabled={(station._count?.products ?? 0) > 0 || (station._count?.categories ?? 0) > 0}
                                        >
                                            <Trash2 size={16} />
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
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <MonitorPlay size={24} />
                                {editingStation ? 'Editar Estación' : 'Nueva Estación KDS'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Código *</label>
                                <input
                                    type="text"
                                    value={code}
                                    onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                                    className="w-full border border-slate-300 rounded-lg p-3 font-mono"
                                    placeholder="KITCHEN, BAR, COLD..."
                                    required
                                    minLength={2}
                                    disabled={!!editingStation}
                                />
                                <p className="text-xs text-slate-400 mt-1">Solo letras, números y guión bajo</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Nombre *</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg p-3"
                                    placeholder="Cocina, Barra, Fría..."
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Orden de visualización</label>
                                <input
                                    type="number"
                                    value={sortOrder}
                                    onChange={e => setSortOrder(parseInt(e.target.value) || 0)}
                                    className="w-full border border-slate-300 rounded-lg p-3"
                                    min={0}
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={isActive}
                                    onChange={e => setIsActive(e.target.checked)}
                                    className="w-5 h-5 rounded border-slate-300"
                                />
                                <label htmlFor="isActive" className="text-sm text-slate-600">Estación activa</label>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 flex items-center justify-center gap-2"
                                >
                                    <Save size={20} /> Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
