/**
 * @fileoverview Servicio frontend para gestionar estaciones KDS
 *
 * Proporciona CRUD de estaciones KDS y funcionalidad para obtener
 * ordenes filtradas por estacion para las pantallas de cocina.
 *
 * @module services/kdsStationService
 */

import api from '../lib/api';

/** Estacion KDS */
export interface KdsStation {
    id: number;
    name: string;
    code: string;
    sortOrder: number;
    isActive: boolean;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
    _count?: {
        products: number;
        categories: number;
    };
}

/** Datos para crear/actualizar estacion */
export interface KdsStationInput {
    name: string;
    code: string;
    sortOrder?: number;
    isActive?: boolean;
    isDefault?: boolean;
}

/** Respuesta de la API con estaciones */
interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}

/**
 * Obtiene todas las estaciones KDS del tenant.
 */
export async function getStations(): Promise<KdsStation[]> {
    const response = await api.get<ApiResponse<KdsStation[]>>('/kds-stations');
    return response.data.data;
}

/**
 * Obtiene una estacion por ID.
 */
export async function getStation(id: number): Promise<KdsStation> {
    const response = await api.get<ApiResponse<KdsStation>>(`/kds-stations/${id}`);
    return response.data.data;
}

/**
 * Crea una nueva estacion KDS.
 */
export async function createStation(data: KdsStationInput): Promise<KdsStation> {
    const response = await api.post<ApiResponse<KdsStation>>('/kds-stations', data);
    return response.data.data;
}

/**
 * Actualiza una estacion existente.
 */
export async function updateStation(id: number, data: Partial<KdsStationInput>): Promise<KdsStation> {
    const response = await api.patch<ApiResponse<KdsStation>>(`/kds-stations/${id}`, data);
    return response.data.data;
}

/**
 * Elimina una estacion KDS.
 * Solo se puede eliminar si no tiene productos o categorias asignados.
 */
export async function deleteStation(id: number): Promise<void> {
    await api.delete(`/kds-stations/${id}`);
}

/**
 * Establece una estacion como la estacion por defecto.
 */
export async function setDefaultStation(id: number): Promise<KdsStation> {
    const response = await api.post<ApiResponse<KdsStation>>(`/kds-stations/${id}/set-default`);
    return response.data.data;
}

/**
 * Crea las estaciones por defecto (Cocina, Barra, Fria, Postres).
 * Util para tenants nuevos o migracion.
 */
export async function seedDefaultStations(): Promise<KdsStation[]> {
    const response = await api.post<ApiResponse<KdsStation[]>>('/kds-stations/seed');
    return response.data.data;
}
