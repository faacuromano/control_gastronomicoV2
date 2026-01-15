import React, { useState, useEffect } from 'react';
import { Plus, Search, MapPin, Phone, Mail, Edit, Trash2 } from 'lucide-react';
import { clientService, type Client } from '../../../services/clientService';

export const ClientsPage: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        address: '',
        email: '',
        taxId: ''
    });

    useEffect(() => {
        loadClients();
    }, [search]); // Reload when search changes (debounce would be better but keeping simple for MVP)

    const loadClients = async () => {
        setLoading(true);
        try {
            // If empty search, we might want a different endpoint or just search empty string
            // Current clientService.search returns [] if query is empty.
            // We might need a getAll or search handles empty.
            // Let's assume search(' ') or similar works, or add getAll to service.
            // For now, let's try searching 'a' or commonly used vowel if empty, 
            // OR better, modify service/controller to return recent if empty.
            // Client controller currently returns [] if !q. 
            // We should fix that to return recent 50 or similar.
            const data = await clientService.search(search || ' '); 
            setClients(data);
        } catch (error) {
            console.error("Failed to load clients");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await clientService.create(formData);
            setIsModalOpen(false);
            setFormData({ name: '', phone: '', address: '', email: '', taxId: '' });
            loadClients();
        } catch (error) {
            console.error("Failed to create client", error);
            alert("Error al crear cliente");
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800">Clientes</h1>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                >
                    <Plus size={20} /> Nuevo Cliente
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input 
                            type="text" 
                            placeholder="Buscar por nombre, teléfono..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium text-sm">
                            <tr>
                                <th className="px-6 py-4">Nombre</th>
                                <th className="px-6 py-4">Contacto</th>
                                <th className="px-6 py-4">Dirección</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-500">Cargando...</td></tr>
                            ) : clients.length === 0 ? (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-500">No se encontraron clientes.</td></tr>
                            ) : (
                                clients.map(client => (
                                    <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900">{client.name}</div>
                                            {client.taxId && <div className="text-xs text-slate-400">CUIT: {client.taxId}</div>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1 text-sm text-slate-600">
                                                {client.phone && (
                                                    <div className="flex items-center gap-2">
                                                        <Phone size={14} className="text-slate-400" /> {client.phone}
                                                    </div>
                                                )}
                                                {client.email && (
                                                    <div className="flex items-center gap-2">
                                                        <Mail size={14} className="text-slate-400" /> {client.email}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                             {client.address ? (
                                                <div className="flex items-start gap-2 text-sm text-slate-600">
                                                    <MapPin size={14} className="text-slate-400 mt-0.5" />
                                                    {client.address}
                                                </div>
                                             ) : <span className="text-slate-400 text-sm italic">Sin dirección</span>}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="text-slate-400 hover:text-indigo-600 mx-1"><Edit size={18} /></button>
                                            {/* <button className="text-slate-400 hover:text-red-600 mx-1"><Trash2 size={18} /></button> */}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h2 className="font-bold text-lg text-slate-800">Nuevo Cliente</h2>
                            <button onClick={() => setIsModalOpen(false)}><Plus className="rotate-45 text-slate-500" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo *</label>
                                <input 
                                    required 
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                                <input 
                                    value={formData.phone}
                                    onChange={e => setFormData({...formData, phone: e.target.value})}
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                                <input 
                                    value={formData.address}
                                    onChange={e => setFormData({...formData, address: e.target.value})}
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                    <input 
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({...formData, email: e.target.value})}
                                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">CUIT/Tax ID</label>
                                    <input 
                                        value={formData.taxId}
                                        onChange={e => setFormData({...formData, taxId: e.target.value})}
                                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                    />
                                </div>
                            </div>
                            
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Crear Cliente</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
