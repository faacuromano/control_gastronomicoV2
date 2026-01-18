import React, { useState, useEffect } from 'react';
import { Shield, Loader2, Save, X, Users, Package, ShoppingCart, Settings, Grid, type LucideProps } from 'lucide-react';
import { roleService, type Role, type RolePermissions, type PermissionOptions } from '../../../services/roleService';

// Resource grouping for better organization
const RESOURCE_GROUPS: Record<string, { label: string; icon: React.FC<LucideProps>; resources: string[] }> = {
    catalog: {
        label: 'Catálogo',
        icon: Package,
        resources: ['products', 'categories']
    },
    operations: {
        label: 'Operación',
        icon: ShoppingCart,
        resources: ['orders', 'stock']
    },
    team: {
        label: 'Equipo',
        icon: Users,
        resources: ['users', 'clients']
    },
    system: {
        label: 'Sistema',
        icon: Settings,
        resources: ['roles', 'settings', 'suppliers', 'analytics']
    }
};

// Labels for display
const MODULE_LABELS: Record<string, string> = {
    pos: 'Punto de Venta',
    tables: 'Mesas',
    cash: 'Caja',
    kds: 'Cocina (KDS)',
    delivery: 'Delivery',
    admin: 'Administración'
};

const RESOURCE_LABELS: Record<string, string> = {
    products: 'Productos',
    categories: 'Categorías',
    orders: 'Órdenes',
    stock: 'Stock',
    users: 'Usuarios',
    clients: 'Clientes',
    analytics: 'Analytics',
    suppliers: 'Proveedores',
    settings: 'Configuración',
    roles: 'Roles'
};

const ACTION_LABELS: Record<string, string> = {
    access: 'Acceso',
    create: 'Crear',
    read: 'Ver',
    update: 'Editar',
    delete: 'Eliminar'
};

// Toggle Switch Component
const ToggleSwitch: React.FC<{
    checked: boolean;
    onChange: () => void;
    label?: string;
}> = ({ checked, onChange, label }) => (
    <button
        type="button"
        onClick={onChange}
        className="group flex items-center gap-2"
        title={label}
    >
        <div className={`
            relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out
            ${checked ? 'bg-green-500' : 'bg-slate-300'}
        `}>
            <div className={`
                absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md
                transition-transform duration-200 ease-in-out
                ${checked ? 'translate-x-5' : 'translate-x-0'}
            `}>
                {checked ? (
                    <svg className="w-5 h-5 text-green-500 p-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                ) : (
                    <svg className="w-5 h-5 text-slate-400 p-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                )}
            </div>
        </div>
    </button>
);

export const RolesPage: React.FC = () => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissionOptions, setPermissionOptions] = useState<PermissionOptions | null>(null);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [editedPermissions, setEditedPermissions] = useState<RolePermissions>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [rolesData, optionsData] = await Promise.all([
                roleService.getAll(),
                roleService.getPermissionOptions()
            ]);
            setRoles(rolesData);
            setPermissionOptions(optionsData);
            
            if (rolesData.length > 0 && !selectedRole) {
                selectRole(rolesData[0]);
            }
        } catch (error) {
            console.error('Failed to load roles', error);
        } finally {
            setLoading(false);
        }
    };

    const selectRole = (role: Role) => {
        setSelectedRole(role);
        setEditedPermissions(role.permissions || {});
        setHasChanges(false);
    };

    const togglePermission = (item: string, action: string) => {
        setEditedPermissions(prev => {
            const current = prev[item] || [];
            const hasAction = current.includes(action);
            
            const newActions = hasAction
                ? current.filter(a => a !== action)
                : [...current, action];
            
            return {
                ...prev,
                [item]: newActions
            };
        });
        setHasChanges(true);
    };

    const hasPermission = (item: string, action: string): boolean => {
        const actions = editedPermissions[item] || [];
        return actions.includes(action);
    };

    const handleSave = async () => {
        if (!selectedRole || !permissionOptions) return;
        
        setSaving(true);
        try {
            const validItems = new Set([...permissionOptions.modules, ...permissionOptions.resources]);
            const filteredPermissions: RolePermissions = {};
            
            for (const [item, actions] of Object.entries(editedPermissions)) {
                if (validItems.has(item) && Array.isArray(actions) && actions.length > 0) {
                    filteredPermissions[item] = actions;
                }
            }
            
            const updated = await roleService.updatePermissions(selectedRole.id, filteredPermissions);
            setRoles(prev => prev.map(r => r.id === updated.id ? { ...r, permissions: updated.permissions } : r));
            setSelectedRole({ ...selectedRole, permissions: updated.permissions });
            setHasChanges(false);
        } catch (error: any) {
            console.error('Failed to save permissions', error);
            alert(error?.response?.data?.error?.message || 'Error al guardar permisos');
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = () => {
        if (selectedRole) {
            setEditedPermissions(selectedRole.permissions || {});
            setHasChanges(false);
        }
    };

    // Count active permissions
    const countActivePermissions = (): number => {
        return Object.values(editedPermissions).reduce((acc, actions) => acc + actions.length, 0);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-indigo-600" size={48} />
            </div>
        );
    }

    const crudActions = permissionOptions?.actions.filter(a => a !== 'access') || [];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Roles y Permisos</h1>
                    <p className="text-muted-foreground mt-1">Configura qué puede hacer cada rol en el sistema</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Role List */}
                <div className="bg-card rounded-2xl shadow-lg border border-border p-4">
                    <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                        <Shield size={20} className="text-primary" /> Roles
                    </h2>
                    <div className="space-y-2">
                        {roles.map(role => (
                            <button
                                key={role.id}
                                onClick={() => selectRole(role)}
                                className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                                    selectedRole?.id === role.id
                                        ? 'bg-primary text-primary-foreground shadow-md'
                                        : 'hover:bg-accent text-foreground'
                                }`}
                            >
                                <div className="font-medium">{role.name}</div>
                                {role._count?.users !== undefined && (
                                    <div className={`text-xs mt-1 ${
                                        selectedRole?.id === role.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                    }`}>
                                        {role._count.users} usuario{role._count.users !== 1 ? 's' : ''}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Permission Editor */}
                <div className="lg:col-span-3 space-y-6">
                    {selectedRole && permissionOptions ? (
                        <>
                            {/* Header with Save/Discard */}
                            <div className="bg-card rounded-2xl shadow-lg border border-border p-4 flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                                        <Shield className="text-primary" size={24} />
                                        {selectedRole.name}
                                    </h2>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary">
                                            {countActivePermissions()} permisos activos
                                        </span>
                                        {hasChanges && (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700">
                                                Cambios sin guardar
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {hasChanges && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleDiscard}
                                            className="flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground rounded-xl hover:bg-accent transition-colors"
                                        >
                                            <X size={18} /> Descartar
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-md"
                                        >
                                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                            Guardar
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Modules Section */}
                            <div className="bg-card rounded-2xl shadow-lg border border-border overflow-hidden">
                                <div className="p-4 border-b border-border bg-muted/30">
                                    <div className="flex items-center gap-2">
                                        <Grid size={20} className="text-primary" />
                                        <h3 className="font-bold text-foreground">Acceso a Módulos</h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Secciones principales visibles en la navegación
                                    </p>
                                </div>
                                <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {permissionOptions.modules.map(mod => (
                                        <div
                                            key={mod}
                                            className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                                                hasPermission(mod, 'access')
                                                    ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/30'
                                                    : 'border-border bg-card'
                                            }`}
                                        >
                                            <span className={`font-medium ${
                                                hasPermission(mod, 'access') ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'
                                            }`}>
                                                {MODULE_LABELS[mod] || mod}
                                            </span>
                                            <ToggleSwitch
                                                checked={hasPermission(mod, 'access')}
                                                onChange={() => togglePermission(mod, 'access')}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Resources CRUD - Grouped */}
                            {Object.entries(RESOURCE_GROUPS).map(([groupKey, group]) => {
                                const availableResources = group.resources.filter(r => 
                                    permissionOptions.resources.includes(r)
                                );
                                if (availableResources.length === 0) return null;

                                return (
                                    <div key={groupKey} className="bg-card rounded-2xl shadow-lg border border-border overflow-hidden">
                                        <div className="p-4 border-b border-border bg-muted/30">
                                            <div className="flex items-center gap-2">
                                                <group.icon size={20} className="text-primary" />
                                                <h3 className="font-bold text-foreground">{group.label}</h3>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Operaciones permitidas
                                            </p>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead className="bg-muted/20">
                                                    <tr>
                                                        <th className="text-left p-4 font-semibold text-muted-foreground">Recurso</th>
                                                        {crudActions.map(action => (
                                                            <th key={action} className="text-center p-4 font-semibold text-muted-foreground w-28">
                                                                {ACTION_LABELS[action] || action}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                    {availableResources.map(resource => (
                                                        <tr key={resource} className="hover:bg-muted/20 transition-colors">
                                                            <td className="p-4 font-medium text-foreground">
                                                                {RESOURCE_LABELS[resource] || resource}
                                                            </td>
                                                            {crudActions.map(action => (
                                                                <td key={action} className="p-4 text-center">
                                                                    <div className="flex justify-center">
                                                                        <ToggleSwitch
                                                                            checked={hasPermission(resource, action)}
                                                                            onChange={() => togglePermission(resource, action)}
                                                                            label={`${ACTION_LABELS[action]} ${RESOURCE_LABELS[resource]}`}
                                                                        />
                                                                    </div>
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    ) : (
                        <div className="bg-card rounded-2xl shadow-lg border border-border p-8 text-center text-muted-foreground">
                            <Shield size={48} className="mx-auto mb-4 text-muted-foreground/50" />
                            <p>Seleccione un rol para editar sus permisos</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
