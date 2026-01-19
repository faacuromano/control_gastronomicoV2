import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import LoginPage from './pages/auth/LoginPage';
import { HomePage } from './pages/HomePage';
import Layout from './modules/core/ui/Layout';
import CategoryList from './modules/admin/products/CategoryList';
import ProductList from './modules/admin/products/ProductList';
import { SocketProvider } from './context/SocketContext';
import { KitchenPage } from './modules/kitchen/pages/KitchenPage';
import { POSPage } from './modules/orders/pos/pages/POSPage';
import { DeliveryDashboard } from './modules/orders/delivery/pages/DeliveryDashboard';
import { TablePage } from './modules/orders/tables/pages/TablePage';
import { TablesAdminPage } from './modules/admin/tables/TablesAdminPage';
import { ClientsPage } from './modules/admin/pages/ClientsPage';
import { UsersPage } from './modules/admin/users/UsersPage';
import { IngredientsPage } from './modules/admin/pages/IngredientsPage';
import ModifiersPage from './modules/admin/pages/ModifiersPage';
import { SettingsPage } from './modules/admin/pages/SettingsPage';
import { SuppliersPage } from './modules/admin/pages/SuppliersPage';
import { PurchaseOrdersPage } from './modules/admin/pages/PurchaseOrdersPage';
import { DashboardPage } from './modules/admin/pages/DashboardPage';
import { RolesPage } from './modules/admin/pages/RolesPage';
import { PaymentMethodsPage } from './modules/admin/pages/PaymentMethodsPage';
import { PrintersPage } from './modules/admin/pages/PrintersPage';
import { PrintRoutingPage } from './modules/admin/pages/PrintRoutingPage';
import { BulkPriceUpdatePage } from './modules/admin/pages/BulkPriceUpdatePage';
import { CashPage } from './pages/CashPage';
import { CashShiftHistoryPage } from './modules/admin/cash/CashShiftHistoryPage';
import { RouteGuard } from './components/auth/RouteGuard';
import AdminLayout from './modules/admin/AdminLayout';
import { QrAdminPage } from './pages/QrAdminPage';
import { MenuPublicPage } from './pages/MenuPublicPage';
import { DeliveryPlatformsPage } from './pages/DeliveryPlatformsPage';
import { DeliveryDriversPage } from './pages/DeliveryDriversPage';
import './App.css';

const ProtectedRoute = () => {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

function App() {
    return (
        <SocketProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    
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
                                <Route path="settings" element={<SettingsPage />} />
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
            </BrowserRouter>
        </SocketProvider>
    );
}

export default App;
