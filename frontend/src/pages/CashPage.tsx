import { useState, useEffect } from 'react';
import { Wallet, DollarSign, TrendingUp, Clock, CreditCard } from 'lucide-react';
import { cashShiftService, type ShiftReport } from '../services/cashShiftService';
import { OpenShiftModal } from '../components/cash/OpenShiftModal';
import { CloseShiftModal } from '../components/cash/CloseShiftModal';

export const CashPage = () => {
    const [shiftReport, setShiftReport] = useState<ShiftReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [showOpenModal, setShowOpenModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);

    useEffect(() => {
        loadCurrentShift();
    }, []);

    const loadCurrentShift = async () => {
        try {
            setLoading(true);
            const shift = await cashShiftService.getCurrentShift();
            
            if (shift) {
                // Shift exists, load its report
                const report = await cashShiftService.getShiftReport(shift.id);
                setShiftReport(report);
                setShowOpenModal(false);
            } else {
                // No shift open
                setShiftReport(null);
                setShowOpenModal(true);
            }
        } catch (error) {
            console.error('Error loading shift:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleShiftOpened = () => {
        setShowOpenModal(false);
        loadCurrentShift();
    };

    const handleShiftClosed = () => {
        setShowCloseModal(false);
        loadCurrentShift();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!shiftReport) {
        return (
            <>
                <div className="flex flex-col items-center justify-center h-screen p-8">
                    <div className="text-center mb-8">
                        <Wallet className="w-24 h-24 text-muted-foreground mx-auto mb-4" />
                        <h1 className="text-3xl font-bold mb-2">No hay turno abierto</h1>
                        <p className="text-muted-foreground mb-6">
                            Debes abrir un turno de caja para comenzar a trabajar
                        </p>
                        <button 
                            onClick={() => setShowOpenModal(true)}
                            className="px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg font-medium transition-colors flex items-center gap-2"
                            data-testid="btn-open-shift"
                        >
                            <Wallet className="w-5 h-5" />
                            Abrir Caja
                        </button>
                    </div>
                </div>
                {showOpenModal && <OpenShiftModal onShiftOpened={handleShiftOpened} />}
            </>
        );
    }

    const { shift, sales, cash } = shiftReport;
    const duration = new Date().getTime() - new Date(shift.startTime).getTime();
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Wallet className="w-8 h-8 text-primary" />
                        Caja - Turno Activo
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Operador: {shift.userName} • Duración: {hours}h {minutes}m
                    </p>
                </div>
                <button
                    onClick={() => setShowCloseModal(true)}
                    className="px-6 py-3 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl font-semibold shadow-lg transition-all"
                >
                    Cerrar Turno
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Total Sales */}
                <div className="bg-card border border-border rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                            <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Ventas Totales</span>
                    </div>
                    <p className="text-3xl font-bold">${sales.totalSales.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground mt-1">{sales.totalOrders} órdenes</p>
                </div>

                {/* Expected Cash */}
                <div className="bg-card border border-border rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                            <Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Efectivo Esperado</span>
                    </div>
                    <p className="text-3xl font-bold">${cash.expectedCash.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Inicial: ${cash.startAmount.toFixed(2)}
                    </p>
                </div>

                {/* Cash Sales */}
                <div className="bg-card border border-border rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Ventas en Efectivo</span>
                    </div>
                    <p className="text-3xl font-bold">${cash.cashSales.toFixed(2)}</p>
                </div>

                {/* Shift Start */}
                <div className="bg-card border border-border rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                            <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Hora de Apertura</span>
                    </div>
                    <p className="text-2xl font-bold">
                        {new Date(shift.startTime).toLocaleTimeString('es-AR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        })}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                        {new Date(shift.startTime).toLocaleDateString('es-AR')}
                    </p>
                </div>
            </div>

            {/* Payment Methods Breakdown */}
            <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Desglose por Método de Pago
                </h2>
                <div className="space-y-3">
                    {sales.byPaymentMethod.map((method) => (
                        <div key={method.method} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <CreditCard className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <p className="font-semibold">{method.method}</p>
                                    <p className="text-sm text-muted-foreground">{method.count} transacciones</p>
                                </div>
                            </div>
                            <p className="text-xl font-bold">${method.total.toFixed(2)}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modals */}
            {showCloseModal && (
                <CloseShiftModal
                    isOpen={showCloseModal}
                    onClose={() => setShowCloseModal(false)}
                    onShiftClosed={handleShiftClosed}
                />
            )}
        </div>
    );
};
