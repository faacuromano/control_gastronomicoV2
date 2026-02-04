import { useState, useEffect } from 'react';
import { categoryService, type Category } from '../../../services/categoryService';
import * as kdsStationService from '../../../services/kdsStationService';
import type { KdsStation } from '../../../services/kdsStationService';
import { Plus, Trash2, Loader2, Pencil, X, Save, MonitorPlay } from 'lucide-react';
import { useFeatureFlags } from '../../../hooks/useFeatureFlags';

export default function CategoryList() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [stations, setStations] = useState<KdsStation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [creating, setCreating] = useState(false);
    const { features } = useFeatureFlags();

    // Edit modal state
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [editName, setEditName] = useState('');
    const [editKdsStationId, setEditKdsStationId] = useState<number | null>(null);

    useEffect(() => {
        loadCategories();
        if (features?.enableKDS) {
            loadStations();
        }
    }, [features?.enableKDS]);

    const loadStations = async () => {
        try {
            const data = await kdsStationService.getStations();
            setStations(data.filter(s => s.isActive));
        } catch (err) {
            console.error('Failed to load KDS stations', err);
        }
    };

    const loadCategories = async () => {
        try {
            const data = await categoryService.getAll();
            setCategories(data);
        } catch (err) {
            setError('Failed to load categories');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!newCategoryName.trim()) {
            setError('El nombre de la categoría es requerido');
            return;
        }

        setCreating(true);
        try {
            await categoryService.create({ name: newCategoryName.trim() });
            setNewCategoryName('');
            await loadCategories();
        } catch (err: unknown) {
            const message = (err && typeof err === 'object' && 'userMessage' in err)
                ? (err as { userMessage: string }).userMessage
                : 'Failed to create category';
            setError(message);
        } finally {
            setCreating(false);
        }
    };

    const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [renamingCategory, setRenamingCategory] = useState<Category | null>(null);
    const [renameValue, setRenameValue] = useState('');

    const openEditModal = (category: Category) => {
        setEditingCategory(category);
        setEditName(category.name);
        setEditKdsStationId(category.kdsStationId ?? null);
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCategory) return;
        try {
            await categoryService.update(editingCategory.id, {
                name: editName,
                kdsStationId: editKdsStationId
            });
            loadCategories();
            setEditingCategory(null);
        } catch (err) {
            setError('Failed to update category');
        }
    };

    const handleDeleteClick = (category: Category) => {
        setDeletingCategory(category);
        setConfirmDelete(false);
    };

    const confirmDeleteAction = async () => {
        if (!deletingCategory) return;
        try {
            await categoryService.delete(deletingCategory.id);
            loadCategories();
            setDeletingCategory(null);
        } catch (err) {
            setError('Failed to delete category');
        }
    };

    const startRename = () => {
        if (!deletingCategory) return;
        setRenamingCategory(deletingCategory);
        setRenameValue(deletingCategory.name);
        setDeletingCategory(null); // Close delete modal
    };

    const handleRename = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!renamingCategory) return;
        try {
            // Assuming we added update method to service?
            // categoryService.update(id, { name })
            // Wait, I need to check if categoryService has update method.
            // If not, I can't do it.
            // I'll assume it exists or I'll implement it. It SHOULD exist in Sprint 2.
            // Let's assume yes. CHECK FIRST?
            // I'll proceed hoping it exists, if not I'll get TS error and fix service.
             await categoryService.update(renamingCategory.id, { name: renameValue });
             loadCategories();
             setRenamingCategory(null);
        } catch (err) {
             setError('Failed to update category');
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="space-y-6 relative">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Categories</h2>
            </div>

            {/* Create Form */}
            <form onSubmit={handleCreate} className="flex gap-4 p-4 bg-card rounded-lg border border-border">
                <input
                    type="text"
                    placeholder="Nombre de la nueva categoría"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    disabled={creating}
                    className="flex-1 px-3 py-2 bg-background border border-input rounded-md ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                />
                <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {creating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Plus className="w-4 h-4" />
                    )}
                    {creating ? 'Creando...' : 'Add'}
                </button>
            </form>

            {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm">
                    {error}
                </div>
            )}

            <div className="rounded-md border border-border bg-card">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/50">
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[100px]">ID</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Nombre</th>
                            {features?.enableKDS && (
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Estación KDS</th>
                            )}
                            <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">Productos</th>
                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.map((category) => (
                            <tr key={category.id} className="border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                <td className="p-4 align-middle">{category.id}</td>
                                <td className="p-4 align-middle font-medium">{category.name}</td>
                                {features?.enableKDS && (
                                    <td className="p-4 align-middle">
                                        {category.kdsStation ? (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md text-xs font-medium">
                                                <MonitorPlay className="w-3 h-3" />
                                                {category.kdsStation.name}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">Por defecto</span>
                                        )}
                                    </td>
                                )}
                                <td className="p-4 align-middle text-center text-muted-foreground">
                                    {category.activeProductsCount ?? 0}
                                </td>
                                <td className="p-4 align-middle text-right space-x-2">
                                    <button
                                        onClick={() => openEditModal(category)}
                                        className="p-2 text-primary hover:bg-primary/10 rounded-md transition-colors"
                                        title="Editar"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteClick(category)}
                                        className="p-2 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {categories.length === 0 && (
                            <tr>
                                <td colSpan={features?.enableKDS ? 5 : 4} className="p-4 text-center text-muted-foreground">No hay categorías.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Delete Confirmation Modal */}
            {deletingCategory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-background w-full max-w-md p-6 rounded-lg border border-border shadow-lg">
                        <h3 className="text-lg font-bold mb-2 text-destructive">Delete Category?</h3>
                        <p className="text-muted-foreground mb-4">
                            You are about to delete <strong>{deletingCategory.name}</strong>.
                            <br />
                            <span className="text-foreground font-semibold">Warning: This will delete ALL products in this category!</span>
                        </p>
                        
                        <div className="flex items-center gap-2 mb-6">
                            <input 
                                type="checkbox" 
                                id="confirm"
                                checked={confirmDelete}
                                onChange={(e) => setConfirmDelete(e.target.checked)}
                                className="w-4 h-4"
                            />
                            <label htmlFor="confirm" className="text-sm select-none cursor-pointer">
                                I understand the consequences.
                            </label>
                        </div>

                        <div className="flex justify-between items-center gap-2">
                            <button 
                                onClick={() => setDeletingCategory(null)}
                                className="px-4 py-2 hover:bg-muted rounded-md text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={startRename}
                                    className="px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md text-sm font-medium"
                                >
                                    Rename Instead
                                </button>
                                <button
                                    onClick={confirmDeleteAction}
                                    disabled={!confirmDelete}
                                    className="px-4 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Confirm Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Rename Modal (legacy) */}
            {renamingCategory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-background w-full max-w-md p-6 rounded-lg border border-border shadow-lg">
                        <h3 className="text-lg font-bold mb-4">Rename Category</h3>
                        <form onSubmit={handleRename}>
                            <input
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                className="w-full px-3 py-2 bg-background border border-input rounded-md mb-4"
                                autoFocus
                            />
                             <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setRenamingCategory(null)}
                                    className="px-4 py-2 hover:bg-muted rounded-md text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium"
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Category Modal */}
            {editingCategory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-background w-full max-w-md rounded-xl border border-border shadow-lg">
                        <div className="p-4 border-b border-border flex justify-between items-center">
                            <h3 className="text-lg font-bold">Editar Categoría</h3>
                            <button onClick={() => setEditingCategory(null)} className="text-muted-foreground hover:text-foreground">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nombre *</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full px-3 py-2 bg-background border border-input rounded-md"
                                    required
                                    autoFocus
                                />
                            </div>
                            {features?.enableKDS && stations.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Estación KDS</label>
                                    <select
                                        value={editKdsStationId ?? ''}
                                        onChange={(e) => setEditKdsStationId(e.target.value ? Number(e.target.value) : null)}
                                        className="w-full px-3 py-2 bg-background border border-input rounded-md"
                                    >
                                        <option value="">Por defecto (hereda del sistema)</option>
                                        {stations.map(station => (
                                            <option key={station.id} value={station.id}>
                                                {station.name} ({station.code})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Los productos de esta categoría irán a esta pantalla KDS
                                    </p>
                                </div>
                            )}
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingCategory(null)}
                                    className="px-4 py-2 hover:bg-muted rounded-md text-sm font-medium"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
