/**
 * @fileoverview Rutas de Gestión de Roles y Permisos
 *
 * Define los endpoints para administrar los roles del sistema (ADMIN, MANAGER,
 * WAITER, CASHIER, etc.) y sus permisos granulares. Los permisos se almacenan
 * como JSON en el campo permissions del modelo Role, siguiendo el formato:
 * { recurso: { acción: boolean } } (ej: { orders: { create: true, read: true } }).
 *
 * @regla_de_negocio
 * - GET /roles: Cualquier usuario autenticado puede listar roles (necesario
 *   para los dropdowns de asignación de rol en la UI de usuarios).
 * - POST/PUT/DELETE: Solo el rol ADMIN puede crear, modificar o eliminar roles.
 *
 * @module routes/role.routes
 */

import { Router } from 'express';
import {
    getRoles,
    getRoleById,
    createRole,
    deleteRole,
    updateRolePermissions,
    getPermissionOptions
} from '../controllers/role.controller';
import { authenticate, requirePermission } from '../middleware/auth';
import { validateId } from '../middleware/validateId';

const router = Router();

// Listar roles - cualquier usuario autenticado (para dropdowns de asignación)
router.get('/', authenticate, getRoles);

// Obtener catálogo de recursos y acciones disponibles para configurar permisos
router.get('/permission-options', authenticate, getPermissionOptions);

// Obtener detalle de un rol con sus permisos - requiere permiso roles:read
router.get('/:id', authenticate, validateId(), requirePermission('roles', 'read'), getRoleById);

// Crear nuevo rol con permisos iniciales - requiere permiso roles:create
router.post('/', authenticate, requirePermission('roles', 'create'), createRole);

// Actualizar los permisos de un rol existente - requiere permiso roles:update
router.put('/:id/permissions', authenticate, validateId(), requirePermission('roles', 'update'), updateRolePermissions);

// Eliminar un rol (falla si hay usuarios asignados) - requiere permiso roles:delete
router.delete('/:id', authenticate, validateId(), requirePermission('roles', 'delete'), deleteRole);

export default router;
