import React, { useState, useEffect, useCallback } from 'react';
import { ScrollText, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { auditService, type AuditLog, type AuditFilters } from '../../../services/auditService';
import { toast } from 'sonner';

const ACTION_LABELS: Record<string, string> = {
    LOGIN: 'Inicio de sesión',
    LOGOUT: 'Cierre de sesión',
    LOGIN_FAILED: 'Login fallido',
    ORDER_CREATED: 'Orden creada',
    ORDER_CANCELLED: 'Orden cancelada',
    ORDER_REFUNDED: 'Orden reembolsada',
    ITEM_VOIDED: 'Item anulado',
    ITEM_TRANSFERRED: 'Item transferido',
    PAYMENT_RECEIVED: 'Pago recibido',
    PAYMENT_VOIDED: 'Pago anulado',
    DISCOUNT_APPLIED: 'Descuento aplicado',
    SHIFT_OPENED: 'Turno abierto',
    SHIFT_CLOSED: 'Turno cerrado',
    CASH_ADJUSTMENT: 'Ajuste de caja',
    STOCK_ADJUSTED: 'Stock ajustado',
    STOCK_WASTED: 'Merma registrada',
    BULK_PRICE_UPDATE: 'Actualización masiva de precios',
    USER_CREATED: 'Usuario creado',
    USER_UPDATED: 'Usuario actualizado',
    USER_DELETED: 'Usuario eliminado',
    ROLE_CREATED: 'Rol creado',
    ROLE_UPDATED: 'Rol actualizado',
    ROLE_DELETED: 'Rol eliminado',
    ROLE_PERMISSIONS_UPDATED: 'Permisos de rol actualizados',
    PRODUCT_CREATED: 'Producto creado',
    PRODUCT_UPDATED: 'Producto actualizado',
    PRODUCT_DELETED: 'Producto eliminado',
    PRINTER_CREATED: 'Impresora creada',
    PRINTER_UPDATED: 'Impresora actualizada',
    PRINTER_DELETED: 'Impresora eliminada',
    SUPPLIER_CREATED: 'Proveedor creado',
    SUPPLIER_UPDATED: 'Proveedor actualizado',
    SUPPLIER_DELETED: 'Proveedor eliminado',
    PAYMENT_METHOD_CREATED: 'Método de pago creado',
    PAYMENT_METHOD_UPDATED: 'Método de pago actualizado',
    PAYMENT_METHOD_DELETED: 'Método de pago eliminado',
    ROLE_CHANGED: 'Rol cambiado',
    CONFIG_CHANGED: 'Configuración cambiada',
    SYNC_COMPLETED: 'Sincronización completada',
};

const ACTION_CATEGORIES: Record<string, string[]> = {
    'Autenticación': ['LOGIN', 'LOGOUT', 'LOGIN_FAILED'],
    'Órdenes': ['ORDER_CREATED', 'ORDER_CANCELLED', 'ORDER_REFUNDED', 'ITEM_VOIDED', 'ITEM_TRANSFERRED'],
    'Pagos': ['PAYMENT_RECEIVED', 'PAYMENT_VOIDED', 'DISCOUNT_APPLIED'],
    'Caja': ['SHIFT_OPENED', 'SHIFT_CLOSED', 'CASH_ADJUSTMENT'],
    'Inventario': ['STOCK_ADJUSTED', 'STOCK_WASTED', 'BULK_PRICE_UPDATE'],
    'Admin': ['USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'ROLE_CREATED', 'ROLE_UPDATED', 'ROLE_DELETED', 'ROLE_PERMISSIONS_UPDATED', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_DELETED', 'PRINTER_CREATED', 'PRINTER_UPDATED', 'PRINTER_DELETED', 'SUPPLIER_CREATED', 'SUPPLIER_UPDATED', 'SUPPLIER_DELETED', 'PAYMENT_METHOD_CREATED', 'PAYMENT_METHOD_UPDATED', 'PAYMENT_METHOD_DELETED', 'ROLE_CHANGED', 'CONFIG_CHANGED'],
    'Sistema': ['SYNC_COMPLETED'],
};

const ACTION_COLORS: Record<string, string> = {
    LOGIN: 'bg-green-100 text-green-700',
    LOGOUT: 'bg-slate-100 text-slate-600',
    LOGIN_FAILED: 'bg-red-100 text-red-700',
    ORDER_CREATED: 'bg-blue-100 text-blue-700',
    ORDER_CANCELLED: 'bg-orange-100 text-orange-700',
    ORDER_REFUNDED: 'bg-amber-100 text-amber-700',
    PAYMENT_RECEIVED: 'bg-emerald-100 text-emerald-700',
    PAYMENT_VOIDED: 'bg-red-100 text-red-700',
    SHIFT_OPENED: 'bg-teal-100 text-teal-700',
    SHIFT_CLOSED: 'bg-teal-100 text-teal-700',
    CASH_ADJUSTMENT: 'bg-yellow-100 text-yellow-700',
};

const PAGE_SIZE = 50;

export const AuditLogPage: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState<AuditFilters>({});
    const [page, setPage] = useState(0);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const loadLogs = useCallback(async () => {
        setLoading(true);
        try {
            const data = await auditService.getAll({
                ...filters,
                limit: PAGE_SIZE,
                offset: page * PAGE_SIZE,
            });
            setLogs(data);
        } catch {
            toast.error('Error al cargar registros de auditoría');
        } finally {
            setLoading(false);
        }
    }, [filters, page]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const handleFilterChange = (key: keyof AuditFilters, value: string) => {
        setPage(0);
        setFilters(prev => ({
            ...prev,
            [key]: value || undefined,
        }));
    };

    const clearFilters = () => {
        setPage(0);
        setFilters({});
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Registro de Auditoría</h1>
                    <p className="text-sm text-slate-500 mt-1">Historial de acciones del sistema</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex flex-wrap gap-4 items-end">
                    {/* Action filter */}
                    <div className="min-w-[200px]">
                        <label className="block text-sm font-medium text-slate-600 mb-1">Acción</label>
                        <select
                            value={filters.action || ''}
                            onChange={(e) => handleFilterChange('action', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Todas las acciones</option>
                            {Object.entries(ACTION_CATEGORIES).map(([category, actions]) => (
                                <optgroup key={category} label={category}>
                                    {actions.map(action => (
                                        <option key={action} value={action}>
                                            {ACTION_LABELS[action] || action}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>

                    {/* Entity filter */}
                    <div className="min-w-[150px]">
                        <label className="block text-sm font-medium text-slate-600 mb-1">Entidad</label>
                        <select
                            value={filters.entity || ''}
                            onChange={(e) => handleFilterChange('entity', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Todas</option>
                            <option value="User">Usuario</option>
                            <option value="Order">Orden</option>
                            <option value="Payment">Pago</option>
                            <option value="CashShift">Turno de caja</option>
                            <option value="Product">Producto</option>
                            <option value="Role">Rol</option>
                            <option value="Printer">Impresora</option>
                            <option value="Supplier">Proveedor</option>
                            <option value="PaymentMethod">Método de pago</option>
                        </select>
                    </div>

                    {/* Date range */}
                    <div className="min-w-[150px]">
                        <label className="block text-sm font-medium text-slate-600 mb-1">Desde</label>
                        <input
                            type="date"
                            value={filters.startDate || ''}
                            onChange={(e) => handleFilterChange('startDate', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="min-w-[150px]">
                        <label className="block text-sm font-medium text-slate-600 mb-1">Hasta</label>
                        <input
                            type="date"
                            value={filters.endDate || ''}
                            onChange={(e) => handleFilterChange('endDate', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Clear filters */}
                    <button
                        onClick={clearFilters}
                        className="px-3 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1"
                    >
                        <Filter className="w-4 h-4" />
                        Limpiar
                    </button>
                </div>
            </div>

            {/* Log Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Cargando...</div>
                ) : logs.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        <ScrollText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p>No se encontraron registros de auditoría</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Fecha</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Acción</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Entidad</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">ID</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Usuario</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">IP</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {logs.map((log) => (
                                <React.Fragment key={log.id}>
                                    <tr
                                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                                    >
                                        <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                                            {formatDate(log.createdAt)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {ACTION_LABELS[log.action] || log.action}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600">
                                            {log.entity}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-500 font-mono">
                                            {log.entityId ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600">
                                            {log.userId ?? 'Sistema'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-400 font-mono">
                                            {log.ipAddress || '—'}
                                        </td>
                                    </tr>
                                    {expandedId === log.id && log.details && (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-3 bg-slate-50">
                                                <pre className="text-xs text-slate-600 overflow-x-auto max-w-full whitespace-pre-wrap">
                                                    {JSON.stringify(log.details, null, 2)}
                                                </pre>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* Pagination */}
                {logs.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                        <span className="text-sm text-slate-500">
                            Página {page + 1} — {logs.length} registros
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Anterior
                            </button>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={logs.length < PAGE_SIZE}
                                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                            >
                                Siguiente
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuditLogPage;
