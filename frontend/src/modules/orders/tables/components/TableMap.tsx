import { cn } from '@/lib/utils';

// Types (should eventually be in a shared types file)
export type TableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';

export interface Table {
    id: number;
    name: string;
    x: number;
    y: number;
    status: TableStatus;
    currentOrderId?: number;
    areaId: number;
}

interface TableMapProps {
    tables: Table[];
    onTableClick: (table: Table) => void;
}

export const TableMap: React.FC<TableMapProps> = ({ tables, onTableClick }) => {
    // Basic grid layout style
    // We assume a canvas of arguably 800x600 or responsive relative to container
    // For simplicity, let's use a relative container and percentage or absolute pixels depending on requirement.
    // Let's go with absolute pixels inside a scrollable container for "Floor Plan" feel.

    return (
        <div className="relative w-full h-[600px] bg-muted border rounded-lg overflow-hidden shadow-inner">
            {tables.map((table) => (
                <div
                    key={table.id}
                    onClick={() => onTableClick(table)}
                    style={{
                        position: 'absolute',
                        left: table.x,
                        top: table.y,
                        width: '120px',
                        height: '120px'
                    }}
                    className={cn(
                        "flex flex-col items-center justify-center p-2 rounded-xl cursor-pointer transition-all shadow-md active:scale-95 border-2",
                        table.status === 'FREE' && "bg-green-100 border-green-400 hover:bg-green-200 text-green-800",
                        table.status === 'OCCUPIED' && "bg-red-100 border-red-400 hover:bg-red-200 text-red-800",
                        table.status === 'RESERVED' && "bg-yellow-100 border-yellow-400 hover:bg-yellow-200 text-yellow-800",
                        table.status === 'CLEANING' && "bg-gray-200 border-gray-400 text-gray-600"
                    )}
                >
                    <div className="text-3xl mb-2">
                        {/* Icon based on status or type? Just generic table for now */}
                        🪑
                    </div>
                    <span className="font-bold text-lg">{table.name}</span>
                    <span className="text-xs uppercase font-semibold mt-1">
                        {table.status}
                    </span>
                    {table.currentOrderId && (
                        <span className="text-xs bg-black/10 px-1 rounded mt-1">
                            #{table.currentOrderId}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
};
