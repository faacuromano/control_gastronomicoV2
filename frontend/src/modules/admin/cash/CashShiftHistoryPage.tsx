import React, { useState, useEffect } from 'react';
import { cashShiftService, type CashShift } from '../../../services/cashShiftService';
import { userService } from '../../../services/userService';
import { Wallet, Filter, Download } from 'lucide-react';

export const CashShiftHistoryPage = () => {
    const [shifts, setShifts] = useState<CashShift[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [dateFilter, setDateFilter] = useState('');
    const [userFilter, setUserFilter] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [shiftsData, usersData] = await Promise.all([
                cashShiftService.getAll(),
                userService.getAll()
            ]);
            setShifts(shiftsData);
            setUsers(usersData);
        } catch (error) {
            console.error("Failed to load history", error);
        } finally {
            setLoading(false);
        }
    };

    const handleApplyFilters = async () => {
        setLoading(true);
        try {
            const data = await cashShiftService.getAll({
                fromDate: dateFilter || undefined,
                userId: userFilter ? Number(userFilter) : undefined
            });
            setShifts(data);
        } catch (error) {
            console.error("Filter failed", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading && shifts.length === 0) {
        return <div className="p-8 text-center">Cargando historial...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Wallet className="h-8 w-8 text-primary" />
                    Historial de Cajas
                </h1>
                <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-accent transition-colors">
                    <Download className="h-4 w-4" />
                    Exportar
                </button>
            </div>

            {/* Filters */}
            <div className="bg-card border border-border rounded-xl p-4 flex gap-4 items-end">
                <div>
                    <label className="block text-sm font-medium mb-1">Fecha</label>
                    <input 
                        type="date" 
                        value={dateFilter}
                        onChange={e => setDateFilter(e.target.value)}
                        className="p-2 border rounded-lg bg-background"
                        data-testid="filter-date"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Usuario</label>
                    <select
                        value={userFilter}
                        onChange={e => setUserFilter(e.target.value)}
                        className="p-2 border rounded-lg bg-background min-w-[200px]"
                        data-testid="filter-user"
                    >
                        <option value="">Todos</option>
                        {users.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>
                </div>
                <button 
                    onClick={handleApplyFilters}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2"
                    data-testid="btn-apply-filters"
                >
                    <Filter className="h-4 w-4" />
                    Filtrar
                </button>
            </div>

            {/* List */}
            <div className="grid gap-4">
                {shifts.map(shift => {
                    const diff = (shift.endAmount || 0) - (shift.expectedCash || 0); // Assuming API returns expectedCash or we verify logic
                    // The test checks for specific data-testids inside the record
                    
                    return (
                        <div 
                            key={shift.id} 
                            className="bg-card border border-border rounded-xl p-6 flex justify-between items-center hover:shadow-md transition-shadow"
                            data-testid="shift-record"
                        >
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-lg">
                                        {new Date(shift.startTime).toLocaleDateString()}
                                    </span>
                                    <span className="text-sm px-2 py-0.5 bg-muted rounded-full">
                                        #{shift.id}
                                    </span>
                                    {!shift.endTime && (
                                        <span className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full font-bold">
                                            ACTIVO
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Operador: <span className="text-foreground font-medium">{users.find(u => u.id === shift.userId)?.name || 'Unknown'}</span>
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {new Date(shift.startTime).toLocaleTimeString()} - {shift.endTime ? new Date(shift.endTime).toLocaleTimeString() : 'En curso'}
                                </p>
                            </div>

                            <div className="flex gap-8 text-right">
                                <div>
                                    <p className="text-xs text-muted-foreground">Apertura</p>
                                    <p className="font-bold text-lg">${Number(shift.startAmount).toFixed(2)}</p>
                                </div>
                                {shift.endTime && (
                                    <>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Cierre</p>
                                            <p className="font-bold text-lg">${Number(shift.endAmount).toFixed(2)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Diferencia</p>
                                            <p 
                                                className={`font-bold text-lg ${diff < 0 ? 'text-red-500' : diff > 0 ? 'text-green-500' : 'text-zinc-500'}`}
                                                data-testid="shift-difference"
                                            >
                                                {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}

                {shifts.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        No se encontraron registros
                    </div>
                )}
            </div>
        </div>
    );
};
