import React, { useState, useEffect } from 'react';
import { Plus, Loader2, Save, X, Trash2, Printer as PrinterIcon, TestTube, CheckCircle, XCircle, Wifi, Usb, RefreshCw } from 'lucide-react';
import { printerService, type Printer, type PrinterConnectionType } from '../../../services/printerService';

export const PrintersPage: React.FC = () => {
    const [printers, setPrinters] = useState<Printer[]>([]);
    const [systemPrinters, setSystemPrinters] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingSystemPrinters, setLoadingSystemPrinters] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
    const [testingId, setTestingId] = useState<number | null>(null);
    const [testResult, setTestResult] = useState<{id: number, success: boolean, message: string} | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [connectionType, setConnectionType] = useState<PrinterConnectionType>('USB');
    const [ipAddress, setIpAddress] = useState('');
    const [windowsName, setWindowsName] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await printerService.getAll();
            setPrinters(data);
        } catch (error) {
            console.error('Failed to load printers', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSystemPrinters = async () => {
        setLoadingSystemPrinters(true);
        try {
            const data = await printerService.getSystemPrinters();
            setSystemPrinters(data);
        } catch (error) {
            console.error('Failed to load system printers', error);
        } finally {
            setLoadingSystemPrinters(false);
        }
    };

    const resetForm = () => {
        setName('');
        setConnectionType('USB');
        setIpAddress('');
        setWindowsName('');
        setEditingPrinter(null);
    };

    const openModal = async (printer?: Printer) => {
        if (printer) {
            setEditingPrinter(printer);
            setName(printer.name);
            setConnectionType(printer.connectionType || 'NETWORK');
            setIpAddress(printer.ipAddress || '');
            setWindowsName(printer.windowsName || '');
        } else {
            resetForm();
        }
        setIsModalOpen(true);
        // Load system printers when opening modal for USB selection
        await loadSystemPrinters();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = {
                name,
                connectionType,
                ipAddress: connectionType === 'NETWORK' ? ipAddress : undefined,
                windowsName: connectionType === 'USB' ? windowsName : undefined
            };
            
            if (editingPrinter) {
                await printerService.update(editingPrinter.id, data);
            } else {
                await printerService.create(data);
            }
            setIsModalOpen(false);
            resetForm();
            loadData();
        } catch (error: any) {
            console.error('Failed to save', error);
            alert(error?.response?.data?.error?.message || 'Error al guardar');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Eliminar esta impresora?')) return;
        try {
            await printerService.delete(id);
            loadData();
        } catch (error: any) {
            alert(error?.response?.data?.error?.message || 'Error al eliminar');
        }
    };

    const handleTestPrint = async (id: number) => {
        setTestingId(id);
        setTestResult(null);
        try {
            await printerService.printTestPage(id);
            setTestResult({ id, success: true, message: 'Página de prueba enviada' });
        } catch (error: any) {
            setTestResult({ 
                id, 
                success: false, 
                message: error?.response?.data?.error?.message || 'Error de conexión' 
            });
        } finally {
            setTestingId(null);
            // Clear result after 5 seconds
            setTimeout(() => setTestResult(null), 5000);
        }
    };

    const getConnectionInfo = (printer: Printer) => {
        if (printer.connectionType === 'USB') {
            return printer.windowsName || 'No configurado';
        }
        return printer.ipAddress || 'No configurado';
    };

    const isFormValid = () => {
        if (!name.trim()) return false;
        if (connectionType === 'USB' && !windowsName) return false;
        if (connectionType === 'NETWORK' && !ipAddress.trim()) return false;
        return true;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800">Impresoras</h1>
                <button 
                    onClick={() => openModal()}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
                >
                    <Plus size={20} /> Nueva Impresora
                </button>
            </div>

            {/* Info Panel */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="font-semibold text-blue-800 mb-2">Configuración de Impresoras Térmicas</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                    <li className="flex items-center gap-2">
                        <Usb size={14} /> <strong>USB:</strong> Selecciona la impresora instalada en Windows
                    </li>
                    <li className="flex items-center gap-2">
                        <Wifi size={14} /> <strong>Red:</strong> Ingresa la IP de la impresora (puerto 9100 por defecto)
                    </li>
                    <li>• Usa el botón de prueba para verificar la conexión</li>
                </ul>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-100">
                {loading ? (
                    <div className="p-8 flex justify-center">
                        <Loader2 className="animate-spin text-indigo-600" size={32} />
                    </div>
                ) : printers.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        <PrinterIcon className="mx-auto mb-3 text-slate-300" size={48} />
                        <p>No hay impresoras configuradas</p>
                        <p className="text-sm">Agrega una impresora para habilitar la impresión de tickets</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="text-left p-4 font-semibold text-slate-600">Nombre</th>
                                <th className="text-left p-4 font-semibold text-slate-600">Tipo</th>
                                <th className="text-left p-4 font-semibold text-slate-600">Conexión</th>
                                <th className="text-left p-4 font-semibold text-slate-600">Categorías</th>
                                <th className="text-center p-4 font-semibold text-slate-600">Prueba</th>
                                <th className="text-right p-4 font-semibold text-slate-600">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {printers.map(printer => (
                                <tr key={printer.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-bold text-slate-800">{printer.name}</td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                            printer.connectionType === 'USB' 
                                                ? 'bg-purple-100 text-purple-700' 
                                                : 'bg-green-100 text-green-700'
                                        }`}>
                                            {printer.connectionType === 'USB' ? <Usb size={12} /> : <Wifi size={12} />}
                                            {printer.connectionType === 'USB' ? 'USB' : 'Red'}
                                        </span>
                                    </td>
                                    <td className="p-4 font-mono text-sm text-slate-600">
                                        {getConnectionInfo(printer)}
                                    </td>
                                    <td className="p-4 text-slate-500 text-sm">
                                        {printer.categories.length > 0 
                                            ? printer.categories.map(c => c.name).join(', ')
                                            : <span className="text-slate-400">Todas</span>
                                        }
                                    </td>
                                    <td className="p-4 text-center">
                                        {testResult?.id === printer.id ? (
                                            <span className={`flex items-center justify-center gap-1 text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                                                {testResult.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                                {testResult.success ? 'OK' : 'Error'}
                                            </span>
                                        ) : (
                                            <button 
                                                onClick={() => handleTestPrint(printer.id)}
                                                disabled={testingId !== null || (!printer.ipAddress && !printer.windowsName)}
                                                className="flex items-center justify-center gap-1 bg-amber-100 text-amber-700 px-3 py-1 rounded-lg text-sm font-bold hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed mx-auto"
                                            >
                                                {testingId === printer.id ? (
                                                    <Loader2 className="animate-spin" size={14} />
                                                ) : (
                                                    <TestTube size={14} />
                                                )}
                                                Probar
                                            </button>
                                        )}
                                    </td>
                                    <td className="p-4 text-right space-x-2">
                                        <button 
                                            onClick={() => openModal(printer)}
                                            className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-sm font-bold hover:bg-indigo-200"
                                        >
                                            Editar
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(printer.id)}
                                            className="bg-red-100 text-red-600 px-2 py-1 rounded-lg hover:bg-red-200"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <PrinterIcon size={24} />
                                {editingPrinter ? 'Editar Impresora' : 'Nueva Impresora'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Nombre *</label>
                                <input 
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg p-3"
                                    placeholder="Impresora Cocina, Barra, etc."
                                    required
                                />
                            </div>
                            
                            {/* Connection Type Selector */}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">Tipo de Conexión *</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setConnectionType('USB')}
                                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                            connectionType === 'USB'
                                                ? 'border-purple-500 bg-purple-50 text-purple-700'
                                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                        }`}
                                    >
                                        <Usb size={20} />
                                        <span className="font-semibold">USB</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConnectionType('NETWORK')}
                                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                            connectionType === 'NETWORK'
                                                ? 'border-green-500 bg-green-50 text-green-700'
                                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                        }`}
                                    >
                                        <Wifi size={20} />
                                        <span className="font-semibold">Red</span>
                                    </button>
                                </div>
                            </div>

                            {/* USB Printer Selector */}
                            {connectionType === 'USB' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">
                                        Impresora Windows *
                                        <button
                                            type="button"
                                            onClick={loadSystemPrinters}
                                            className="ml-2 text-indigo-600 hover:text-indigo-800"
                                            disabled={loadingSystemPrinters}
                                        >
                                            <RefreshCw size={14} className={loadingSystemPrinters ? 'animate-spin' : ''} />
                                        </button>
                                    </label>
                                    {loadingSystemPrinters ? (
                                        <div className="w-full border border-slate-300 rounded-lg p-3 flex items-center gap-2 text-slate-500">
                                            <Loader2 className="animate-spin" size={16} />
                                            Cargando impresoras...
                                        </div>
                                    ) : systemPrinters.length > 0 ? (
                                        <select
                                            value={windowsName}
                                            onChange={e => setWindowsName(e.target.value)}
                                            className="w-full border border-slate-300 rounded-lg p-3 bg-white"
                                            required
                                        >
                                            <option value="">Seleccionar impresora...</option>
                                            {systemPrinters.map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="w-full border border-amber-200 bg-amber-50 rounded-lg p-3 text-amber-700 text-sm">
                                            No se encontraron impresoras en el sistema.
                                            <br />Verifica que la impresora esté instalada en Windows.
                                        </div>
                                    )}
                                    <p className="text-xs text-slate-500 mt-1">
                                        Selecciona la impresora como aparece en Windows
                                    </p>
                                </div>
                            )}

                            {/* Network Printer IP */}
                            {connectionType === 'NETWORK' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Dirección IP *</label>
                                    <input 
                                        type="text"
                                        value={ipAddress}
                                        onChange={e => setIpAddress(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg p-3 font-mono"
                                        placeholder="192.168.1.100"
                                        required
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Puerto 9100 por defecto (ESC/POS)</p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    disabled={!isFormValid()}
                                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Save size={20} /> Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
