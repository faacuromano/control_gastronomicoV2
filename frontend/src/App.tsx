import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import { HomePage } from './pages/HomePage';
import Layout from './modules/core/ui/Layout';
import CategoryList from './modules/admin/products/CategoryList';
import ProductList from './modules/admin/products/ProductList';
import { SocketProvider } from './context/SocketContext';
import { RouteGuard } from './components/auth/RouteGuard';
import AdminLayout from './modules/admin/AdminLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import './App.css';

// Lazy-loaded page components for code splitting
const KitchenPage = lazy(() => import('./modules/kitchen/pages/KitchenPage').then(m => ({ default: m.KitchenPage })));
const POSPage = lazy(() => import('./modules/orders/pos/pages/POSPage').then(m => ({ default: m.POSPage })));
const DeliveryDashboard = lazy(() => import('./modules/orders/delivery/pages/DeliveryDashboard').then(m => ({ default: m.DeliveryDashboard })));
const TablePage = lazy(() => import('./modules/orders/tables/pages/TablePage').then(m => ({ default: m.TablePage })));
const TablesAdminPage = lazy(() => import('./modules/admin/tables/TablesAdminPage').then(m => ({ default: m.TablesAdminPage })));
const ClientsPage = lazy(() => import('./modules/admin/pages/ClientsPage').then(m => ({ default: m.ClientsPage })));
const UsersPage = lazy(() => import('./modules/admin/users/UsersPage').then(m => ({ default: m.UsersPage })));
const IngredientsPage = lazy(() => import('./modules/admin/pages/IngredientsPage').then(m => ({ default: m.IngredientsPage })));
const ModifiersPage = lazy(() => import('./modules/admin/pages/ModifiersPage'));
const SettingsPage = lazy(() => import('./modules/admin/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const SuppliersPage = lazy(() => import('./modules/admin/pages/SuppliersPage').then(m => ({ default: m.SuppliersPage })));
const PurchaseOrdersPage = lazy(() => import('./modules/admin/pages/PurchaseOrdersPage').then(m => ({ default: m.PurchaseOrdersPage })));
const DashboardPage = lazy(() => import('./modules/admin/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const RolesPage = lazy(() => import('./modules/admin/pages/RolesPage').then(m => ({ default: m.RolesPage })));
const PaymentMethodsPage = lazy(() => import('./modules/admin/pages/PaymentMethodsPage').then(m => ({ default: m.PaymentMethodsPage })));
const PrintersPage = lazy(() => import('./modules/admin/pages/PrintersPage').then(m => ({ default: m.PrintersPage })));
const PrintRoutingPage = lazy(() => import('./modules/admin/pages/PrintRoutingPage').then(m => ({ default: m.PrintRoutingPage })));
const BulkPriceUpdatePage = lazy(() => import('./modules/admin/pages/BulkPriceUpdatePage').then(m => ({ default: m.BulkPriceUpdatePage })));
const CashPage = lazy(() => import('./pages/CashPage').then(m => ({ default: m.CashPage })));
const CashShiftHistoryPage = lazy(() => import('./modules/admin/cash/CashShiftHistoryPage').then(m => ({ default: m.CashShiftHistoryPage })));
const QrAdminPage = lazy(() => import('./pages/QrAdminPage').then(m => ({ default: m.QrAdminPage })));
const MenuPublicPage = lazy(() => import('./pages/MenuPublicPage').then(m => ({ default: m.MenuPublicPage })));
const DeliveryPlatformsPage = lazy(() => import('./pages/DeliveryPlatformsPage').then(m => ({ default: m.DeliveryPlatformsPage })));
const DeliveryDriversPage = lazy(() => import('./pages/DeliveryDriversPage').then(m => ({ default: m.DeliveryDriversPage })));

const ProtectedRoute = () => {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

function App() {
    return (
        <ErrorBoundary>
        <SocketProvider>
            <BrowserRouter>
                <Suspense fallback={<div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh'}}>Cargando...</div>}>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    
                    {/* Public QR Menu Route */}
                    <Route path="/menu/:code" element={<MenuPublicPage />} />
                    
                    <Route element={<ProtectedRoute />}>
                        <Route element={<Layout />}>
                            <Route path="/" element={<HomePage />} />
                            <Route path="/ventas" element={
                                <RouteGuard permission={{ resource: 'orders', action: 'create' }}>
                                    <POSPage />
                                </RouteGuard>
                            } />
                            <Route path="/cash" element={
                                <RouteGuard permission={{ resource: 'cash', action: 'read' }}>
                                    <CashPage />
                                </RouteGuard>
                            } />
                            <Route path="/delivery-dashboard" element={
                                <RouteGuard flag="enableDelivery" permission={{ resource: 'orders', action: 'read' }}>
                                    <DeliveryDashboard />
                                </RouteGuard>
                            } />
                            <Route path="/tables" element={
                                <RouteGuard permission={{ resource: 'tables', action: 'read' }}>
                                    <TablePage />
                                </RouteGuard>
                            } />
                            <Route path="/kitchen" element={
                                <RouteGuard flag="enableKDS">
                                    <KitchenPage />
                                </RouteGuard>
                            } />
                            
                            {/* Admin Section with Sidebar */}
                            <Route path="/admin" element={<AdminLayout />}>
                                <Route index element={<DashboardPage />} />
                                <Route path="dashboard" element={<DashboardPage />} />
                                <Route path="categories" element={<CategoryList />} />
                                <Route path="products" element={<ProductList />} />
                                <Route path="bulk-prices" element={
                                    <RouteGuard permission={{ resource: 'products', action: 'update' }}>
                                        <BulkPriceUpdatePage />
                                    </RouteGuard>
                                } />
                                <Route path="modifiers" element={<ModifiersPage />} />
                                <Route path="tables" element={<TablesAdminPage />} />
                                <Route path="users" element={
                                    <RouteGuard permission={{ resource: 'users', action: 'read' }}>
                                        <UsersPage />
                                    </RouteGuard>
                                } />
                                <Route path="roles" element={
                                    <RouteGuard permission={{ resource: 'users', action: 'update' }}>
                                        <RolesPage />
                                    </RouteGuard>
                                } />
                                <Route path="payment-methods" element={<PaymentMethodsPage />} />
                                <Route path="printers" element={<PrintersPage />} />
                                <Route path="print-routing" element={<PrintRoutingPage />} />
                                <Route path="clients" element={<ClientsPage />} />
                                <Route path="cash-shifts" element={
                                    <RouteGuard permission={{ resource: 'cash', action: 'read' }}>
                                        <CashShiftHistoryPage />
                                    </RouteGuard>
                                } />
                                <Route path="ingredients" element={
                                    <RouteGuard flag="enableStock">
                                        <IngredientsPage />
                                    </RouteGuard>
                                } />
                                <Route path="suppliers" element={
                                    <RouteGuard flag="enableStock">
                                        <SuppliersPage />
                                    </RouteGuard>
                                } />
                                <Route path="purchase-orders" element={
                                    <RouteGuard flag="enableStock">
                                        <PurchaseOrdersPage />
                                    </RouteGuard>
                                } />
                                <Route path="settings" element={
                                    <RouteGuard permission={{ resource: 'settings', action: 'update' }}>
                                        <SettingsPage />
                                    </RouteGuard>
                                } />
                                <Route path="qr" element={
                                    <RouteGuard permission={{ resource: 'settings', action: 'read' }}>
                                        <QrAdminPage />
                                    </RouteGuard>
                                } />
                                <Route path="delivery-platforms" element={
                                    <RouteGuard flag="enableDelivery">
                                        <DeliveryPlatformsPage />
                                    </RouteGuard>
                                } />
                                <Route path="delivery-drivers" element={
                                    <RouteGuard flag="enableDelivery">
                                        <DeliveryDriversPage />
                                    </RouteGuard>
                                } />
                            </Route>
                        </Route>
                    </Route>
                </Routes>
                </Suspense>
            </BrowserRouter>
        </SocketProvider>
        </ErrorBoundary>
    );
}

export default App;
