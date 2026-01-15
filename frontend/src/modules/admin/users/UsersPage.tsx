import React, { useState, useEffect } from 'react';
import { Plus, Search, User as UserIcon, Shield, Key, Edit, Trash2 } from 'lucide-react';
import { userService, type User } from '../../../services/userService';
import { roleService, type Role } from '../../../services/roleService';

export const UsersPage: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    
    // Form State
    const [formData, setFormData] = useState({
        id: undefined as number | undefined,
        name: '',
        email: '',
        pin: '',
        roleId: 2 // Default to Waiter (usually ID 2, we will fetch roles to confirm)
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [usersData, rolesData] = await Promise.all([
                userService.getAll(),
                roleService.getAll()
            ]);
            setUsers(usersData);
            setRoles(rolesData);
            // Set default role to WAITER if exists, else first role
            const waiterRole = rolesData.find((r: Role) => r.name === 'WAITER');
            if (waiterRole) setFormData(prev => ({ ...prev, roleId: waiterRole.id }));
        } catch (error) {
            console.error("Failed to load users/roles", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (formData.id) {
                await userService.update(formData.id, {
                    name: formData.name,
                    email: formData.email,
                    roleId: Number(formData.roleId),
                    ...(formData.pin ? { pin: formData.pin } : {})
                });
            } else {
                await userService.create({
                    name: formData.name,
                    email: formData.email,
                    pin: formData.pin,
                    roleId: Number(formData.roleId)
                });
            }
            
            setIsModalOpen(false);
            resetForm();
            loadData();
        } catch (error) {
            console.error("Failed to save user", error);
            alert("Error al guardar usuario");
        }
    };

    const handleDelete = async (userId: number) => {
        if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
        try {
            await userService.delete(userId);
            loadData();
        } catch (error) {
            console.error("Failed to delete user", error);
            alert("Error al eliminar usuario");
        }
    };

    const openEdit = (user: User) => {
        setFormData({
            id: user.id,
            name: user.name,
            email: user.email || '',
            pin: '', // Don't show existing PIN
            roleId: user.roleId || user.role?.id || 1
        });
        setIsModalOpen(true);
    };

    const resetForm = () => {
        setFormData({
            id: undefined,
            name: '',
            email: '',
            pin: '',
            roleId: roles.find((r) => r.name === 'WAITER')?.id || (roles.length > 0 ? roles[0].id : 0)
        });
    };

    const handleCreateRole = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRoleName.trim()) return;
        try {
            await roleService.create(newRoleName.trim());
            setNewRoleName('');
            loadData(); // Reload to get new role
        } catch (error: any) {
            console.error("Failed to create role", error);  
            alert(error.response?.data?.error || "Error al crear rol");
        }
    };

    const handleDeleteRole = async (roleId: number) => {
        if (!confirm('¿Estás seguro de eliminar este rol?')) return;
        try {
            await roleService.delete(roleId);
            loadData();
        } catch (error: any) {
            console.error("Failed to delete role", error);
            alert(error.response?.data?.error || "Error al eliminar rol");
        }
    };

    const filteredUsers = users.filter(user => 
        user.name.toLowerCase().includes(search.toLowerCase()) || 
        user.email?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Guidance Card */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <div className="text-3xl">💡</div>
                    <div className="flex-1">
                        <h3 className="font-bold text-foreground mb-2">¿Cómo funciona el sistema de Roles y Empleados?</h3>
                        <div className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex items-start gap-2">
                                <Shield size={16} className="mt-0.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                <div>
                                    <span className="font-medium text-foreground">1. Creá Roles</span> (Mesero, Cajero, Repartidor) → Define <strong>QUÉ puede hacer</strong>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <UserIcon size={16} className="mt-0.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                                <div>
                                    <span className="font-medium text-foreground">2. Creá Empleados</span> con sus nombres reales → Asigná <strong>QUIÉN tiene ese rol</strong>
                                    <div className="text-xs mt-1 text-muted-foreground">Ej: "Juan Pérez" → Rol: MESERO</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-foreground">Usuarios del Sistema</h1>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsRoleModalOpen(true)}
                        className="bg-secondary hover:bg-secondary/90 text-secondary-foreground px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                    >
                        <Shield size={20} /> Gestionar Roles
                    </button>
                    <button 
                        onClick={() => { resetForm(); setIsModalOpen(true); }}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                        data-testid="btn-add-user"
                    >
                        <Plus size={20} /> Nuevo Empleado
                    </button>
                </div>
            </div>

            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border bg-muted/20 flex gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <input 
                            type="text" 
                            placeholder="Buscar por nombre, email..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-ring outline-none"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-muted/50 text-muted-foreground font-medium text-sm">
                            <tr>
                                <th className="px-6 py-4">Empleado</th>
                                <th className="px-6 py-4">Rol</th>
                                <th className="px-6 py-4">Pin Access</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Cargando...</td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No se encontraron usuarios.</td></tr>
                            ) : (
                                filteredUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                    {user.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-foreground">{user.name}</div>
                                                    <div className="text-xs text-muted-foreground">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                <Shield size={12} className="mr-1" />
                                                {user.role?.name || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                             <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Key size={14} />
                                                ******
                                             </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => openEdit(user)}
                                                className="text-muted-foreground hover:text-primary mx-1 p-1 hover:bg-muted rounded"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(user.id)}
                                                className="text-muted-foreground hover:text-destructive mx-1 p-1 hover:bg-muted rounded"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-background rounded-xl w-full max-w-md shadow-2xl border border-border overflow-hidden">
                        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20">
                            <h2 className="font-bold text-lg text-foreground">
                                {formData.id ? 'Editar Usuario' : 'Nuevo Empleado'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)}><Plus className="rotate-45 text-muted-foreground hover:text-foreground" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Nombre Completo *</label>
                                <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">💡 Usá el nombre real de la persona</p>
                                <div className="relative">
                                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                    <input 
                                        required 
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        className="w-full pl-9 pr-3 py-2 border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/20 outline-none border-input"
                                        placeholder="Ej. Lucía González, Juan Pérez"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Rol *</label>
                                <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">💡 Define los permisos del empleado</p>
                                <select
                                    value={formData.roleId}
                                    onChange={e => setFormData({...formData, roleId: Number(e.target.value)})}
                                    className="w-full p-2 border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/20 outline-none border-input"
                                >
                                    {roles.map(role => (
                                        <option key={role.id} value={role.id}>{role.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">PIN (6 dígitos) {formData.id && '*'}</label>
                                    <input 
                                        type="text"
                                        pattern="\d{4,6}"
                                        maxLength={6}
                                        value={formData.pin}
                                        onChange={e => setFormData({...formData, pin: e.target.value.replace(/\D/g, '')})}
                                        className="w-full p-2 border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/20 outline-none border-input font-mono"
                                        placeholder={formData.id ? '******' : '123456'}
                                        required={!formData.id}
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">Min 4, Max 6 números</p>
                                </div>
                                <div>
                                     <label className="block text-sm font-medium text-muted-foreground mb-1">Email <span className="text-xs text-muted-foreground">(Opcional)</span></label>
                                    <input 
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({...formData, email: e.target.value})}
                                        className="w-full p-2 border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/20 outline-none border-input"
                                        placeholder="user@email.com"
                                    />
                                </div>
                            </div>
                            
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg">Cancelar</button>
                                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium" data-testid="btn-save-user">
                                    {formData.id ? 'Guardar Cambios' : 'Crear Usuario'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Role Management Modal */}
            {isRoleModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-background rounded-xl w-full max-w-md shadow-2xl border border-border overflow-hidden">
                        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20">
                            <h2 className="font-bold text-lg text-foreground flex items-center gap-2">
                                <Shield size={20} />
                                Gestionar Roles
                            </h2>
                            <button onClick={() => setIsRoleModalOpen(false)}>
                                <Plus className="rotate-45 text-muted-foreground hover:text-foreground" />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            {/* Create Role Form */}
                            <form onSubmit={handleCreateRole} className="flex gap-2">
                                <input 
                                    type="text"
                                    value={newRoleName}
                                    onChange={(e) => setNewRoleName(e.target.value.toUpperCase())}
                                    placeholder="Nuevo rol (ej. MESERO TEMPORADA)"
                                    className="flex-1 px-3 py-2 border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/20 outline-none border-input uppercase"
                                />
                                <button 
                                    type="submit"
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium"
                                >
                                    Crear
                                </button>
                            </form>

                            {/* Roles List */}
                            <div className="border border-border rounded-lg max-h-64 overflow-y-auto">
                                {roles.map(role => (
                                    <div 
                                        key={role.id} 
                                        className="flex items-center justify-between p-3 border-b border-border last:border-b-0 hover:bg-muted/30"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Shield size={14} className="text-muted-foreground" />
                                            <span className="font-medium">{role.name}</span>
                                            {role.id <= 5 && (
                                                <span className="text-xs bg-muted px-2 py-0.5 rounded">Sistema</span>
                                            )}
                                        </div>
                                        {role.id > 5 && (
                                            <button 
                                                onClick={() => handleDeleteRole(role.id)}
                                                className="text-muted-foreground hover:text-destructive p-1 hover:bg-muted rounded"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <p className="text-xs text-muted-foreground">
                                💡 Los roles del sistema (ADMIN, WAITER, etc.) no se pueden eliminar.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
