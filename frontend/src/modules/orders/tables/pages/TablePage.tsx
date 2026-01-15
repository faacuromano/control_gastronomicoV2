import { useState, useEffect } from 'react';
import { TableMap, type Table } from '../components/TableMap';
import { TableDetailModal } from '../components/TableDetailModal';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { tableService, type Area } from '../../../../services/tableService';
import { AlertCircle } from 'lucide-react';

// Mock data for fallback or when DB is empty
const MOCK_AREAS: Area[] = [
    { 
        id: 1, 
        name: 'Salón Principal', 
        tables: [
            { id: 1, name: 'Mesa 1', areaId: 1, x: 50, y: 50, status: 'FREE' },
            { id: 2, name: 'Mesa 2', areaId: 1, x: 200, y: 50, status: 'OCCUPIED', currentOrderId: 1001 },
            { id: 3, name: 'Mesa 3', areaId: 1, x: 350, y: 50, status: 'FREE' },
            { id: 4, name: 'Mesa 4', areaId: 1, x: 50, y: 200, status: 'FREE' },
        ]
    },
    { 
        id: 2, 
        name: 'Terraza',
        tables: [
            { id: 5, name: 'Terraza 1', areaId: 2, x: 100, y: 100, status: 'FREE' },
            { id: 6, name: 'Terraza 2', areaId: 2, x: 250, y: 100, status: 'FREE' },
        ]
    },
    { 
        id: 3, 
        name: 'Barra',
        tables: [
            { id: 7, name: 'Barra 1', areaId: 3, x: 150, y: 150, status: 'FREE' },
        ]
    },
];

export const TablePage = () => {
    const [currentArea, setCurrentArea] = useState<string>("1");
    const [areas, setAreas] = useState<Area[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedTable, setSelectedTable] = useState<Table | null>(null);

    useEffect(() => {
        loadAreas();
    }, []);

    const loadAreas = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const data = await tableService.getAreas();
            
            // If API returns empty or no data, use mock
            if (!data || data.length === 0) {
                // Using mock data if API returns empty
                setAreas(MOCK_AREAS);
                setCurrentArea(MOCK_AREAS[0].id.toString());
            } else {
                setAreas(data);
                setCurrentArea(data[0].id.toString());
            }
        } catch (err) {
            console.error('Failed to load areas from API:', err);
            setError('No se pudo conectar con el servidor. Mostrando datos de ejemplo.');
            // Use mock data as fallback
            setAreas(MOCK_AREAS);
            setCurrentArea(MOCK_AREAS[0].id.toString());
        } finally {
            setLoading(false);
        }
    };

    const currentAreaData = areas.find(a => a.id === Number(currentArea));
    const tables = currentAreaData?.tables || [];

    const handleTableClick = (table: Table) => {
        setSelectedTable(table);
    };

    if (loading) {
        return (
            <div className="p-6">
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Cargando mesas...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Gestión de Mesas</h1>
            </div>

            {error && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">{error}</p>
                        <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                            Las mesas y áreas mostradas son ejemplos. Contacte al administrador para configurar áreas reales.
                        </p>
                    </div>
                </div>
            )}

            {areas.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center">
                        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No hay áreas configuradas</h3>
                        <p className="text-muted-foreground mb-4">
                            Contacte al administrador para crear áreas y mesas.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <Tabs value={currentArea} onValueChange={setCurrentArea} className="w-full">
                    <TabsList className="mb-4">
                        {areas.map(area => (
                            <TabsTrigger key={area.id} value={area.id.toString()}>
                                {area.name} ({area.tables?.length || 0})
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    <Card className="bg-card">
                        <CardContent className="p-4">
                            {tables.length === 0 ? (
                                <div className="flex items-center justify-center h-96 text-center">
                                    <div>
                                        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                        <p className="text-muted-foreground">
                                            No hay mesas en esta área.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <TableMap tables={tables} onTableClick={handleTableClick} />
                            )}
                        </CardContent>
                    </Card>
                </Tabs>
            )}
            {/* Modal for Table Actions */}
            <TableDetailModal 
                table={selectedTable} 
                onClose={() => setSelectedTable(null)}
                onTableUpdated={() => {
                    setSelectedTable(null);
                    loadAreas(); // Refresh table list
                }}
            />
        </div>
    );
};
