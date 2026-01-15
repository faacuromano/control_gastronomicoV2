import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { useFeatureFlags, type FeatureFlags } from '../../hooks/useFeatureFlags';
import { Loader2 } from 'lucide-react';

interface RouteGuardProps {
    permission?: {
        resource: string;
        action: 'create' | 'read' | 'update' | 'delete';
    };
    flag?: keyof FeatureFlags;
    children?: React.ReactNode;
}

export const RouteGuard = ({ permission, flag, children }: RouteGuardProps) => {
    const { hasPermission, isAuthenticated } = useAuthStore();
    const { features, loading } = useFeatureFlags();

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Check Feature Flag
    if (flag && !features?.[flag]) {
        return <Navigate to="/" replace />;
    }

    // Check RBAC Permission
    if (permission && !hasPermission(permission.resource, permission.action)) {
        return <Navigate to="/" replace />;
    }

    return children ? <>{children}</> : <Outlet />;
};
