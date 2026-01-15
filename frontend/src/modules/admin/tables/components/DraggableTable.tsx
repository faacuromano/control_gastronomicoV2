import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Table } from '../../../../services/tableService';
import { Edit, Trash2 } from 'lucide-react';

interface DraggableTableProps {
    table: Table;
    onEdit: (table: Table) => void;
    onDelete: (id: number) => void;
}

export const DraggableTable = ({ table, onEdit, onDelete }: DraggableTableProps) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: table.id,
        data: table
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        left: `${table.x}px`,
        top: `${table.y}px`,
        position: 'absolute' as const,
        touchAction: 'none',
        zIndex: isDragging ? 100 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`
                w-24 h-24 rounded-full flex flex-col items-center justify-center 
                shadow-md border-2 transition-colors cursor-move group
                ${isDragging ? 'bg-primary/20 border-primary scale-105' : 'bg-white border-gray-200'}
                ${table.status === 'OCCUPIED' ? 'bg-red-50 border-red-200' : ''}
            `}
        >
            <span className="font-bold text-sm truncate max-w-[80px] pointer-events-none select-none">
                {table.name}
            </span>
            
            {/* Action Buttons (visible on hover) */}
            <div className={`
                absolute -top-8 left-1/2 -translate-x-1/2 flex gap-1 bg-white shadow-lg rounded-md p-1
                opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-auto
                ${isDragging ? 'hidden' : ''}
            `}>
                <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(table); }}
                    className="p-1 hover:bg-slate-100 text-blue-600 rounded"
                >
                    <Edit size={14} />
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(table.id); }}
                    className="p-1 hover:bg-red-50 text-red-600 rounded"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
};
