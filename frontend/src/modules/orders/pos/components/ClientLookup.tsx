import { useState, useEffect } from 'react';
import { Search, UserPlus, User } from 'lucide-react';
import type { Client } from '../../../../services/clientService';
import { clientService } from '../../../../services/clientService';
import { useDebounce } from '../../../../hooks/useDebounce';

interface ClientLookupProps {
    onSelect: (client: Client | null) => void;
    selectedClient?: Client | null;
}

export const ClientLookup: React.FC<ClientLookupProps> = ({ onSelect, selectedClient }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Client[]>([]);
    const [, setLoading] = useState(false);
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
            <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/30 flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                        <User className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                        <p className="font-display font-bold text-lg text-foreground leading-tight">{selectedClient.name}</p>
                        <p className="text-sm text-muted-foreground font-mono">{selectedClient.phone || 'Sin teléfono'}</p>
                    </div>
                </div>
                <button
                    onClick={() => onSelect(null)}
                    className="text-sm text-purple-400 hover:text-purple-300 font-semibold px-3 py-1.5 bg-purple-500/10 rounded-lg hover:bg-purple-500/20 transition-colors"
                >
                    Cambiar
                </button>
            </div>
        );
    }

    if (isCreating) {
        return (
            <div className="p-4 bg-secondary/50 rounded-xl border border-border/50 mb-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-purple-400" />
                        Nuevo Cliente
                    </h3>
                    <button
                         type="button"
                         onClick={() => setIsCreating(false)}
                         className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 hover:bg-secondary rounded transition-colors"
                    >
                        Cancelar
                    </button>
                </div>
                <form onSubmit={handleCreateClient} className="space-y-3">
                    <input
                        type="text"
                        placeholder="Nombre completo"
                        className="w-full p-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                        value={newClient.name}
                        onChange={e => setNewClient({ ...newClient, name: e.target.value })}
                        required
                    />
                    <input
                        type="tel"
                        placeholder="Teléfono (Ej: 1123456789)"
                        className="w-full p-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 font-mono"
                        value={newClient.phone}
                        onChange={e => setNewClient({ ...newClient, phone: e.target.value })}
                        required
                    />
                    <input
                        type="text"
                        placeholder="Dirección completa"
                        className="w-full p-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                        value={newClient.address}
                        onChange={e => setNewClient({ ...newClient, address: e.target.value })}
                    />
                    <button
                        type="submit"
                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-xl font-bold hover:from-purple-500 hover:to-purple-400 transition-all shadow-lg shadow-purple-500/20"
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
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                    type="text"
                    placeholder="Buscar cliente por nombre o teléfono..."
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                />
            </div>

            {/* Results Dropdown */}
            {(results.length > 0 || (query.length > 2 && results.length === 0)) && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border/50 rounded-xl shadow-2xl shadow-black/30 z-50 overflow-hidden backdrop-blur-xl">
                    {results.map(client => (
                        <button
                            key={client.id}
                            onClick={() => onSelect(client)}
                            className="w-full text-left px-4 py-3 hover:bg-purple-500/10 transition-colors flex justify-between items-center group border-b border-border/30 last:border-b-0"
                        >
                            <div>
                                <p className="font-semibold text-foreground group-hover:text-purple-400 transition-colors">{client.name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{client.phone}</p>
                            </div>
                            {client.address && <p className="text-xs text-muted-foreground max-w-[150px] truncate">{client.address}</p>}
                        </button>
                    ))}
                    <button
                        onClick={() => { setIsCreating(true); setQuery(query); setNewClient({ name: query, phone: '', address: '' }) }}
                        className="w-full text-left px-4 py-3 hover:bg-purple-500/10 transition-colors flex items-center gap-2 text-purple-400 font-semibold border-t border-border/50 bg-purple-500/5"
                    >
                        <UserPlus className="w-4 h-4" />
                        Crear nuevo: "{query}"
                    </button>
                </div>
            )}
        </div>
    );
};
