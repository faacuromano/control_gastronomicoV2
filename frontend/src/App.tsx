import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import LoginPage from './pages/auth/LoginPage';
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
import { SettingsPage } from './modules/admin/pages/SettingsPage';
import { CashPage } from './pages/CashPage';
import { CashShiftHistoryPage } from './modules/admin/cash/CashShiftHistoryPage';
import { RouteGuard } from './components/auth/RouteGuard';
import AdminLayout from './modules/admin/AdminLayout';
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
                    
                    <Route element={<ProtectedRoute />}>
                        <Route element={<Layout />}>
                            <Route path="/" element={
                                <div className="p-8">
                                    <h1 className="text-3xl font-bold mb-4">Welcome to PentiumPOS</h1>
                                </div>
                            } />
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
                                <Route path="categories" element={<CategoryList />} />
                                <Route path="products" element={<ProductList />} />
                                <Route path="tables" element={<TablesAdminPage />} />
                                <Route path="users" element={
                                    <RouteGuard permission={{ resource: 'users', action: 'read' }}>
                                        <UsersPage />
                                    </RouteGuard>
                                } />
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
                                <Route path="settings" element={<SettingsPage />} />
                            </Route>
                        </Route>
                    </Route>
                </Routes>
            </BrowserRouter>
        </SocketProvider>
    );
}

export default App;
