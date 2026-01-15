import { useState, useEffect } from 'react';
import { Search, UserPlus, User } from 'lucide-react';
import type { Client } from '../../../../services/clientService';
import { clientService } from '../../../../services/clientService';
import { useDebounce } from '../../../../hooks/useDebounce';

interface ClientLookupProps {
    onSelect: (client: Client) => void;
    selectedClient?: Client | null;
}

export const ClientLookup: React.FC<ClientLookupProps> = ({ onSelect, selectedClient }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Client[]>([]);
    const [loading, setLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newClient, setNewClient] = useState({ name: '', phone: '', address: '' });

    const debouncedQuery = useDebounce(query, 500);

    useEffect(() => {
        if (debouncedQuery.length > 2) {
            searchClients();
        } else {
            setResults([]);
        }
    }, [debouncedQuery]);

    const searchClients = async () => {
        setLoading(true);
        try {
            const data = await clientService.search(debouncedQuery);
            setResults(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateClient = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const client = await clientService.create(newClient);
            onSelect(client);
            setIsCreating(false);
            setQuery(''); // Clear search
        } catch (error) {
            console.error(error);
        }
    };

    if (selectedClient) {
        return (
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20 flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <User className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="font-bold text-lg leading-none">{selectedClient.name}</p>
                        <p className="text-sm text-muted-foreground">{selectedClient.phone || 'Sin teléfono'}</p>
                    </div>
                </div>
                <button 
                    onClick={() => onSelect(null as any)} // Allow clearing
                    className="text-sm text-primary hover:underline font-medium"
                >
                    Cambiar
                </button>
            </div>
        );
    }

    if (isCreating) {
        return (
            <div className="p-4 bg-muted/30 rounded-lg border border-border mb-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-primary" />
                        Nuevo Cliente
                    </h3>
                    <button 
                         type="button"
                         onClick={() => setIsCreating(false)} 
                         className="text-xs text-muted-foreground hover:text-foreground"
                    >
                        Cancelar
                    </button>
                </div>
                <form onSubmit={handleCreateClient} className="space-y-3">
                    <input
                        type="text"
                        placeholder="Nombre completo"
                        className="w-full p-2 rounded-md border bg-background"
                        value={newClient.name}
                        onChange={e => setNewClient({ ...newClient, name: e.target.value })}
                        required
                    />
                    <input
                        type="tel"
                        placeholder="Teléfono (Ej: 1123456789)"
                        className="w-full p-2 rounded-md border bg-background"
                        value={newClient.phone}
                        onChange={e => setNewClient({ ...newClient, phone: e.target.value })}
                        required
                    />
                    <input
                        type="text"
                        placeholder="Dirección completa"
                        className="w-full p-2 rounded-md border bg-background"
                        value={newClient.address}
                        onChange={e => setNewClient({ ...newClient, address: e.target.value })}
                    />
                    <button 
                        type="submit" 
                        className="w-full py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
                    >
                        Crear Cliente
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="mb-4 relative">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                    type="text"
                    placeholder="Buscar cliente por nombre o teléfono..."
                    className="w-full pl-9 pr-4 py-2 rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                />
            </div>
            
            {/* Results Dropdown */}
            {(results.length > 0 || (query.length > 2 && results.length === 0)) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                    {results.map(client => (
                        <button
                            key={client.id}
                            onClick={() => onSelect(client)}
                            className="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex justify-between items-center group"
                        >
                            <div>
                                <p className="font-medium group-hover:text-primary transition-colors">{client.name}</p>
                                <p className="text-xs text-muted-foreground">{client.phone}</p>
                            </div>
                            {client.address && <p className="text-xs text-muted-foreground max-w-[150px] truncate">{client.address}</p>}
                        </button>
                    ))}
                    <button
                        onClick={() => { setIsCreating(true); setQuery(query); setNewClient({ name: query, phone: '', address: '' }) }}
                        className="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center gap-2 text-primary font-medium border-t border-border"
                    >
                        <UserPlus className="w-4 h-4" />
                        Crear nuevo: "{query}"
                    </button>
                </div>
            )}
        </div>
    );
};
