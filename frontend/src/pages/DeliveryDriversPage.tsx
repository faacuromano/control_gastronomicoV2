/**
 * @fileoverview Delivery Drivers Admin Page
 * Manage own fleet of delivery drivers
 */

import React, { useState, useEffect } from 'react';
import { deliveryService, type DeliveryDriver } from '../services/deliveryService';
import { 
    Loader2, Plus, Trash2, ToggleLeft, ToggleRight, 
    Edit, User, Phone, Bike, Car
} from 'lucide-react';

const vehicleIcons: Record<string, React.ReactNode> = {
    MOTORCYCLE: <Bike size={16} />,
    BICYCLE: <Bike size={16} />,
    CAR: <Car size={16} />,
    WALKING: <User size={16} />
};

const vehicleLabels: Record<string, string> = {
    MOTORCYCLE: 'Moto',
    BICYCLE: 'Bicicleta',
    CAR: 'Auto',
    WALKING: 'A pie'
};

export const DeliveryDriversPage: React.FC = () => {
    const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingDriver, setEditingDriver] = useState<DeliveryDriver | null>(null);
    const [formData, setFormData] = useState<{
        name: string;
        phone: string;
        email: string;
        vehicleType: 'MOTORCYCLE' | 'BICYCLE' | 'CAR' | 'WALKING';
        licensePlate: string;
    }>({
        name: '',
        phone: '',
        email: '',
        vehicleType: 'MOTORCYCLE',
        licensePlate: ''
    });

    useEffect(() => {
        loadDrivers();
    }, []);

    const loadDrivers = async () => {
        setLoading(true);
        try {
            const data = await deliveryService.getAllDrivers();
            setDrivers(data);
        } catch (err) {
            console.error('Failed to load drivers:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = {
                name: formData.name,
                phone: formData.phone,
                email: formData.email || undefined,
                vehicleType: formData.vehicleType,
                licensePlate: formData.licensePlate || undefined
            };

            if (editingDriver) {
                const updated = await deliveryService.updateDriver(editingDriver.id, data);
                setDrivers(drivers.map(d => d.id === updated.id ? updated : d));
            } else {
                const created = await deliveryService.createDriver(data);
                setDrivers([...drivers, created]);
            }
            closeModal();
        } catch (err) {
            console.error('Failed to save driver:', err);
        }
    };

    const handleToggleAvailability = async (id: number) => {
        try {
            const updated = await deliveryService.toggleDriverAvailability(id);
            setDrivers(drivers.map(d => d.id === id ? updated : d));
        } catch (err) {
            console.error('Failed to toggle availability:', err);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Eliminar este conductor?')) return;
        try {
            await deliveryService.deleteDriver(id);
            setDrivers(drivers.filter(d => d.id !== id));
        } catch (err) {
            console.error('Failed to delete driver:', err);
        }
    };

    const openEditModal = (driver: DeliveryDriver) => {
        setEditingDriver(driver);
        setFormData({
            name: driver.name,
            phone: driver.phone,
            email: driver.email || '',
            vehicleType: driver.vehicleType,
            licensePlate: driver.licensePlate || ''
        });
        setShowModal(true);
    };

    const openCreateModal = () => {
        setEditingDriver(null);
        setFormData({
            name: '',
            phone: '',
            email: '',
            vehicleType: 'MOTORCYCLE',
            licensePlate: ''
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingDriver(null);
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
                    <h1 className="text-2xl font-bold text-slate-800">Conductores</h1>
                    <p className="text-slate-500">Gestiona tu flota propia de delivery</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center gap-2"
                >
                    <Plus size={20} />
                    Agregar Conductor
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                {drivers.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                        No hay conductores registrados
                    </div>
                ) : (
                    <div className="divide-y">
                        {drivers.map(driver => (
                            <div key={driver.id} className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                        driver.isActive && driver.isAvailable
                                            ? 'bg-green-100 text-green-600'
                                            : driver.isActive
                                                ? 'bg-yellow-100 text-yellow-600'
                                                : 'bg-slate-100 text-slate-400'
                                    }`}>
                                        <User size={20} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-700">{driver.name}</p>
                                        <div className="flex items-center gap-3 text-sm text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <Phone size={12} />
                                                {driver.phone}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                {vehicleIcons[driver.vehicleType]}
                                                {vehicleLabels[driver.vehicleType]}
                                            </span>
                                            {driver.licensePlate && (
                                                <span>{driver.licensePlate}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                        driver.isAvailable 
                                            ? 'bg-green-100 text-green-700' 
                                            : 'bg-red-100 text-red-700'
                                    }`}>
                                        {driver.isAvailable ? 'Disponible' : 'Ocupado'}
                                    </span>
                                    <button
                                        onClick={() => handleToggleAvailability(driver.id)}
                                        className="p-2 hover:bg-slate-100 rounded-lg"
                                        title="Toggle Disponibilidad"
                                    >
                                        {driver.isAvailable 
                                            ? <ToggleRight size={20} className="text-green-600" /> 
                                            : <ToggleLeft size={20} className="text-slate-400" />
                                        }
                                    </button>
                                    <button
                                        onClick={() => openEditModal(driver)}
                                        className="p-2 hover:bg-slate-100 rounded-lg"
                                    >
                                        <Edit size={18} className="text-slate-500" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(driver.id)}
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
                            {editingDriver ? 'Editar Conductor' : 'Nuevo Conductor'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">
                                    Nombre
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    className="w-full p-2 border rounded-lg"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">
                                    Teléfono
                                </label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={e => setFormData({...formData, phone: e.target.value})}
                                    className="w-full p-2 border rounded-lg"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({...formData, email: e.target.value})}
                                    className="w-full p-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">
                                    Vehículo
                                </label>
                                <select
                                    value={formData.vehicleType}
                                    onChange={e => setFormData({...formData, vehicleType: e.target.value as any})}
                                    className="w-full p-2 border rounded-lg"
                                >
                                    <option value="MOTORCYCLE">Moto</option>
                                    <option value="BICYCLE">Bicicleta</option>
                                    <option value="CAR">Auto</option>
                                    <option value="WALKING">A pie</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">
                                    Patente
                                </label>
                                <input
                                    type="text"
                                    value={formData.licensePlate}
                                    onChange={e => setFormData({...formData, licensePlate: e.target.value.toUpperCase()})}
                                    className="w-full p-2 border rounded-lg"
                                    placeholder="ABC123"
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
                                    {editingDriver ? 'Guardar' : 'Crear'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DeliveryDriversPage;
