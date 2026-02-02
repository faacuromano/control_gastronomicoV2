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
import { authenticate, authorize } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimit';
import { validateId } from '../middleware/validateId';

const router = Router();

// Buscar usuarios por capacidad/permiso específico (ej: usuarios con permiso de delivery)
router.get('/with-capability', authenticate, getUsersWithCapability);

// Listar usuarios - cualquier usuario autenticado (para dropdowns de asignación)
router.get('/', authenticate, listUsers);

// Obtener detalle de un usuario - solo ADMIN
router.get('/:id', authenticate, validateId(), authorize(['ADMIN']), getUserById);

// Crear usuario - solo ADMIN (con rate limiting para prevenir enumeración de PINes P1-010)
router.post('/', authenticate, authorize(['ADMIN']), apiRateLimiter, createUser);

// Actualizar usuario - solo ADMIN (con rate limiting para prevenir enumeración de PINes P1-010)
router.put('/:id', authenticate, validateId(), authorize(['ADMIN']), apiRateLimiter, updateUser);

// Eliminar (desactivar) usuario - solo ADMIN (soft delete, no se borra de la BD)
router.delete('/:id', authenticate, validateId(), authorize(['ADMIN']), deleteUser);

export default router;
