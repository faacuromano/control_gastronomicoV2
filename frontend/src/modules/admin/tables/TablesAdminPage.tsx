
import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save } from 'lucide-react';
import { DndContext, type DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { tableService, type Area } from '../../../services/tableService';
import { DraggableTable } from './components/DraggableTable';

interface TableFormData {
    name: string;
    x: number;
    y: number;
}

export const TablesAdminPage = () => {
    const [areas, setAreas] = useState<Area[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    
    // Modals state
    const [editingArea, setEditingArea] = useState<{ id?: number; name: string } | null>(null);
    const [editingTable, setEditingTable] = useState<{ id?: number; areaId: number; data: TableFormData } | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Prevent drag on simple clicks
            },
        })
    );

    useEffect(() => {
        loadAreas();
    }, []);

    const loadAreas = async () => {
        setLoading(true);
        try {
            const data = await tableService.getAreas();
            setAreas(data || []);
            // Select first area by default if none selected and areas exist
            if (!selectedAreaId && data && data.length > 0) {
                setSelectedAreaId(data[0].id);
            }
        } catch (error) {
            console.error('Error loading areas:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateArea = async () => {
        if (!editingArea) return;
        try {
            await tableService.createArea({ name: editingArea.name });
            await loadAreas();
            setEditingArea(null);
        } catch (error) {
            console.error('Error creating area:', error);
        }
    };

    const handleUpdateArea = async () => {
        if (!editingArea || !editingArea.id) return;
        try {
            await tableService.updateArea(editingArea.id, { name: editingArea.name });
            await loadAreas();
            setEditingArea(null);
        } catch (error) {
            console.error('Error updating area:', error);
        }
    };

    const [deletingAreaId, setDeletingAreaId] = useState<number | null>(null);
    const [confirmDeleteCheck, setConfirmDeleteCheck] = useState(false);

    const handleDeleteArea = (areaId: number) => {
        setDeletingAreaId(areaId);
        setConfirmDeleteCheck(false);
    };

    const executeDeleteArea = async () => {
        if (!deletingAreaId) return;
        try {
            await tableService.deleteArea(deletingAreaId);
            const newAreas = await tableService.getAreas();
            setAreas(newAreas);
            if (selectedAreaId === deletingAreaId) {
                setSelectedAreaId(newAreas.length > 0 ? newAreas[0].id : null);
            }
            setDeletingAreaId(null);
        } catch (error) {
            console.error('Error deleting area:', error);
            alert('No se pudo eliminar el área. Verifique que no haya mesas ocupadas.');
        }
    };

    const handleCreateTable = async () => {
        if (!editingTable) return;
        try {
            await tableService.createTable({
                areaId: editingTable.areaId,
                ...editingTable.data
            });
            await loadAreas();
            setEditingTable(null);
        } catch (error) {
            console.error('Error creating table:', error);
        }
    };

    const handleUpdateTable = async () => {
        if (!editingTable || !editingTable.id) return;
        try {
            await tableService.updateTable(editingTable.id, editingTable.data);
            await loadAreas();
            setEditingTable(null);
        } catch (error) {
            console.error('Error updating table:', error);
        }
    };

    const handleDeleteTable = async (tableId: number) => {
        if (!confirm('¿Eliminar esta mesa?')) return;
        try {
            await tableService.deleteTable(tableId);
            await loadAreas();
        } catch (error) {
            console.error('Error deleting table:', error);
        }
    };

    // --- Drag & Drop Logic ---

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, delta } = event;
        const tableId = Number(active.id);
        
        if (!selectedAreaId) return;

        const areaIndex = areas.findIndex(a => a.id === selectedAreaId);
        if (areaIndex === -1) return;
        
        const area = areas[areaIndex];
        const tableIndex = area.tables.findIndex(t => t.id === tableId);
        if (tableIndex === -1) return;
        
        const table = area.tables[tableIndex];
        
        // Calculate new position
        const newX = Math.round((table.x || 0) + delta.x);
        const newY = Math.round((table.y || 0) + delta.y);
        
        // Optimistic Update
        const newAreas = [...areas];
        newAreas[areaIndex] = {
            ...area,
            tables: [...area.tables]
        };
        newAreas[areaIndex].tables[tableIndex] = {
            ...table,
            x: Math.max(0, newX),
            y: Math.max(0, newY)
        };
        
        setAreas(newAreas);
        setHasUnsavedChanges(true);
    };

    const handleSaveChanges = async () => {
        if (!selectedAreaId) return;
        const area = areas.find(a => a.id === selectedAreaId);
        if (!area) return;

        try {
            const updates = area.tables.map(t => ({
                id: t.id,
                x: t.x || 0,
                y: t.y || 0
            }));
            
            await tableService.updatePositions(updates);
            setHasUnsavedChanges(false);
            // alert('Cambios guardados'); // Optional feedback
        } catch (error) {
            console.error('Error saving positions:', error);
            alert('Error al guardar cambios');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    const selectedArea = areas.find(a => a.id === selectedAreaId);

    return (
        <div className="h-[calc(100vh-4rem)] flex overflow-hidden">
            {/* Sidebar - Areas List */}
            <div className="w-64 bg-background border-r border-border flex flex-col">
                <div className="p-4 border-b border-border">
                    <h2 className="font-bold flex items-center justify-between">
                        Áreas
                        <button 
                            onClick={() => setEditingArea({ name: '' })}
                            className="p-1 hover:bg-muted rounded text-primary"
                            title="Nueva Área"
                            data-testid="btn-add-area"
                        >
                            <Plus size={20} />
                        </button>
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {areas.map(area => (
                        <div 
                            key={area.id}
                            className={`
                                flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors
                                ${selectedAreaId === area.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}
                            `}
                            onClick={() => setSelectedAreaId(area.id)}
                        >
                            <span>{area.name}</span>
                            <div className="flex gap-1">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setEditingArea({ id: area.id, name: area.name }); }}
                                    className="p-1 hover:bg-background rounded"
                                >
                                    <Edit size={14} />
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteArea(area.id); }}
                                    className="p-1 hover:bg-background rounded text-red-500"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {areas.length === 0 && (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            No hay áreas. Crea una para comenzar.
                        </div>
                    )}
                </div>
            </div>

            {/* Main Canvas - Map Editor */}
            <div className="flex-1 bg-slate-50 relative flex flex-col">
                {selectedArea ? (
                    <>
                        {/* Toolbar */}
                        <div className="bg-white border-b border-border p-3 flex justify-between items-center z-10 shadow-sm">
                            <h2 className="font-semibold text-lg">{selectedArea.name}</h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setEditingTable({
                                        areaId: selectedArea.id,
                                        data: { name: '', x: 50, y: 50 }
                                    })}
                                    data-testid="btn-add-table"
                                    className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md text-sm hover:bg-secondary/90"
                                >
                                    <Plus size={16} />
                                    Agregar Mesa
                                </button>
                                {hasUnsavedChanges && (
                                    <button
                                        onClick={handleSaveChanges}
                                        data-testid="btn-save-changes"
                                        className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 animate-pulse"
                                    >
                                        <Save size={16} />
                                        Guardar Cambios
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Drop Zone / Canvas */}
                        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                            <div className="flex-1 relative overflow-hidden bg-[url('/grid-pattern.svg')] bg-[length:20px_20px]">
                                {selectedArea.tables?.map(table => (
                                    <DraggableTable 
                                        key={table.id} 
                                        table={table} 
                                        onEdit={(t) => setEditingTable({ id: t.id, areaId: t.areaId, data: { name: t.name, x: t.x || 0, y: t.y || 0 } })}
                                        onDelete={handleDeleteTable}
                                    />
                                ))}
                                
                                {(!selectedArea.tables || selectedArea.tables.length === 0) && (
                                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50 pointer-events-none">
                                        Arrastra mesas aquí o crea nuevas
                                    </div>
                                )}
                            </div>
                        </DndContext>
                        
                        {/* Help Text */}
                        <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur px-3 py-2 rounded-lg text-xs text-muted-foreground border border-border">
                            Tip: Arrastra las mesas para organizar el salón
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        Select an area to edit
                    </div>
                )}
            </div>

            {/* Modals reuse (Area Form / Table Form) implementation as before... */}
            {/* Area Form Modal logic reused */}
            {editingArea && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                        <h3 className="text-lg font-bold mb-4">
                            {editingArea.id ? 'Editar Área' : 'Nueva Área'}
                        </h3>
                        <input
                            type="text"
                            value={editingArea.name}
                            onChange={(e) => setEditingArea({ ...editingArea, name: e.target.value })}
                            placeholder="Nombre del salón (ej. Patio, PB)"
                            className="w-full border rounded-lg p-2 mb-4"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => setEditingArea(null)}
                                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={editingArea.id ? handleUpdateArea : handleCreateArea}
                                disabled={!editingArea.name.trim()}
                                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Table Form Modal logic reused */}
            {editingTable && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                        <h3 className="text-lg font-bold mb-4">
                            {editingTable.id ? 'Editar Mesa' : 'Nueva Mesa'}
                        </h3>
                        <div className="space-y-4 mb-4">
                            <div>
                                <label className="text-sm font-medium">Nombre / Número</label>
                                <input
                                    type="text"
                                    value={editingTable.data.name}
                                    onChange={(e) => setEditingTable({
                                        ...editingTable,
                                        data: { ...editingTable.data, name: e.target.value }
                                    })}
                                    placeholder="Ej. Mesa 1"
                                    className="w-full border rounded-lg p-2 mt-1"
                                    autoFocus
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">X</label>
                                    <input
                                        type="number"
                                        placeholder="Posición X"
                                        value={editingTable.data.x}
                                        onChange={(e) => setEditingTable({
                                            ...editingTable,
                                            data: { ...editingTable.data, x: parseInt(e.target.value) || 0 }
                                        })}
                                        className="w-full border rounded-lg p-2 mt-1 bg-slate-50"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Y</label>
                                    <input
                                        type="number"
                                        placeholder="Posición Y"
                                        value={editingTable.data.y}
                                        onChange={(e) => setEditingTable({
                                            ...editingTable,
                                            data: { ...editingTable.data, y: parseInt(e.target.value) || 0 }
                                        })}
                                        className="w-full border rounded-lg p-2 mt-1 bg-slate-50"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <button
                                onClick={() => setEditingTable(null)}
                                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={editingTable.id ? handleUpdateTable : handleCreateTable}
                                disabled={!editingTable.data.name.trim()}
                                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletingAreaId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-background rounded-xl p-6 w-full max-w-md shadow-xl border border-destructive/20 text-foreground">
                        <div className="flex items-center gap-3 mb-4 text-destructive">
                            <Trash2 size={24} />
                            <h3 className="text-lg font-bold">Eliminar Área</h3>
                        </div>
                        
                        <p className="text-muted-foreground mb-4">
                            ¿Estás seguro de que deseas eliminar esta área? 
                            Esta acción no se puede deshacer.
                        </p>

                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-6">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="mt-1 w-4 h-4 rounded border-destructive text-destructive focus:ring-destructive"
                                    checked={confirmDeleteCheck}
                                    onChange={(e) => setConfirmDeleteCheck(e.target.checked)}
                                />
                                <span className="text-sm text-destructive-foreground font-medium">
                                    Entiendo que se eliminarán todas las mesas asociadas a esta área permanentemente.
                                </span>
                            </label>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => { setDeletingAreaId(null); setConfirmDeleteCheck(false); }}
                                className="flex-1 px-4 py-2 border rounded-lg hover:bg-accent"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={executeDeleteArea}
                                disabled={!confirmDeleteCheck}
                                className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Eliminar definitivo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
