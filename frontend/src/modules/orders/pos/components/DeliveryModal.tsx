import React, { useState, useEffect } from 'react';
import { X, MapPin, Truck, Check } from 'lucide-react';
import type { Client } from '../../../../services/clientService';

interface DeliveryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: { address: string; notes?: string; driverId?: number; name?: string; phone?: string }) => void;
    client: Client | Partial<Client>; // Allow partial for new
}

export const DeliveryModal: React.FC<DeliveryModalProps> = ({ isOpen, onClose, onConfirm, client }) => {
    const [address, setAddress] = useState(client.address || '');
    const [notes, setNotes] = useState('');
    const [manualName, setManualName] = useState('');
    const [manualPhone, setManualPhone] = useState('');
    
    useEffect(() => {
        if (client.address) setAddress(client.address);
        // If client is temporary (no ID), prepopulate manual fields if available?
        // Logic depends on how parent passes 'client' prop for new users.
    }, [client]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-background rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Truck className="w-5 h-5 text-primary" />
                        Datos de Entrega
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-background rounded-full transition-colors">
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-2">
                        {client.id ? (
                            <>
                                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                                    Cliente: {client.name}
                                </p>
                                <p className="text-xs text-blue-600 dark:text-blue-300">
                                    {client.phone}
                                </p>
                            </>
                        ) : (
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-blue-800">Cliente Eventual</label>
                                <input 
                                    placeholder="Nombre"
                                    value={manualName}
                                    onChange={e => setManualName(e.target.value)}
                                    className="w-full p-2 bg-white rounded border border-blue-200 text-sm"
                                    autoFocus
                                />
                                <input 
                                    placeholder="Teléfono"
                                    value={manualPhone}
                                    onChange={e => setManualPhone(e.target.value)}
                                    className="w-full p-2 bg-white rounded border border-blue-200 text-sm"
                                />
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            Dirección de entrega
                        </label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Calle, Altura, Piso, Depto..."
                            className="w-full p-3 rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Notas para el repartidor (Opcional)</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Ej: Timbre no anda, dejar en guardia, etc."
                            className="w-full p-3 rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none h-24 resize-none"
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-border bg-muted/30 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium hover:bg-background rounded-lg transition-colors border border-transparent hover:border-border"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={() => onConfirm({ address, notes, name: manualName, phone: manualPhone })}
                        disabled={!address.trim() || (!client.id && !manualName.trim())}
                        className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Check className="w-4 h-4" />
                        Confirmar Envío
                    </button>
                </div>
            </div>
        </div>
    );
};
