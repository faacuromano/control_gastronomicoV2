/**
 * @fileoverview Rutas de Gestión de Usuarios
 *
 * CRUD de usuarios del tenant. Los usuarios representan al personal del
 * restaurante (administradores, managers, meseros, cajeros, cocineros).
 * Cada usuario tiene un rol asignado que define sus permisos en el sistema.
 *
 * @regla_de_negocio
 * - GET /users: Cualquier usuario autenticado puede listar (necesario para
 *   dropdowns como "asignar mesero a mesa" o "filtrar por cajero").
 * - POST/PUT/DELETE: Solo el rol ADMIN puede crear, modificar o eliminar usuarios.
 * - Las operaciones de escritura tienen rate limiting adicional para prevenir
 *   enumeración de PINes por fuerza bruta (fix P1-010).
 *
 * @module routes/user.routes
 */

import { Router } from 'express';
import { getRoles, createRole, deleteRole } from '../controllers/role.controller';
import { listUsers, getUserById, createUser, updateUser, deleteUser, getUsersWithCapability } from '../controllers/user.controller';
import { authenticate, requirePermission } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimit';
import { validateId } from '../middleware/validateId';

const router = Router();

// Buscar usuarios por capacidad/permiso específico (ej: usuarios con permiso de delivery)
router.get('/with-capability', authenticate, getUsersWithCapability);

// Listar usuarios - cualquier usuario autenticado (para dropdowns de asignación)
router.get('/', authenticate, listUsers);

// Obtener detalle de un usuario - requiere permiso users:read
router.get('/:id', authenticate, validateId(), requirePermission('users', 'read'), getUserById);

// Crear usuario - requiere permiso users:create (con rate limiting P1-010)
router.post('/', authenticate, requirePermission('users', 'create'), apiRateLimiter, createUser);

// Actualizar usuario - requiere permiso users:update (con rate limiting P1-010)
router.put('/:id', authenticate, validateId(), requirePermission('users', 'update'), apiRateLimiter, updateUser);

// Eliminar (desactivar) usuario - requiere permiso users:delete (soft delete)
router.delete('/:id', authenticate, validateId(), requirePermission('users', 'delete'), deleteUser);

export default router;
