import api from '../lib/api';

export interface AuditLog {
    id: number;
    tenantId: number;
    userId: number | null;
    action: string;
    entity: string;
    entityId: number | null;
    details: Record<string, unknown> | null;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
}

export interface AuditFilters {
    userId?: number;
    entity?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
}

export const auditService = {
    async getAll(filters?: AuditFilters): Promise<AuditLog[]> {
        const params = new URLSearchParams();
        if (filters?.userId) params.set('userId', String(filters.userId));
        if (filters?.entity) params.set('entity', filters.entity);
        if (filters?.action) params.set('action', filters.action);
        if (filters?.startDate) params.set('startDate', filters.startDate);
        if (filters?.endDate) params.set('endDate', filters.endDate);
        if (filters?.limit) params.set('limit', String(filters.limit));
        if (filters?.offset) params.set('offset', String(filters.offset));

        const qs = params.toString();
        const { data } = await api.get(`/audit-logs${qs ? `?${qs}` : ''}`);
        return data.data;
    },
};
