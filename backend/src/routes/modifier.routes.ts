/**
 * @fileoverview Rutas de Grupos de Modificadores y Opciones
 *
 * Los modificadores permiten personalizar productos (ej: "Término de cocción"
 * con opciones "Jugoso", "Medio", "Bien cocido"). Cada grupo define un rango
 * de selección (min/max) y sus opciones pueden tener precio adicional.
 *
 * La lectura de grupos es accesible para todos los usuarios autenticados
 * (necesario para el POS). Las operaciones de escritura están restringidas
 * a roles ADMIN y MANAGER mediante el middleware authorize().
 *
 * A diferencia de otras rutas, este archivo aplica autenticación por ruta
 * individual en vez de usar router.use(authenticate), porque los grupos
 * y las opciones son recursos con URLs diferentes (/groups vs /options).
 *
 * @module routes/modifier.routes
 */

import { Router } from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { validateId } from '../middleware/validateId';
import * as modifierController from '../controllers/modifier.controller';

const router = Router();

// --- Grupos de Modificadores ---
// Listar todos los grupos (para el POS y la admin)
router.get('/groups', authenticateToken, modifierController.getGroups);
// Obtener detalle de un grupo con sus opciones
router.get('/groups/:id', authenticateToken, validateId(), modifierController.getGroup);
// Crear nuevo grupo de modificadores - requiere permiso modifiers:create
router.post('/groups', authenticateToken, requirePermission('modifiers', 'create'), modifierController.createGroup);
// Actualizar grupo (nombre, selección mínima/máxima) - requiere permiso modifiers:update
router.put('/groups/:id', authenticateToken, validateId(), requirePermission('modifiers', 'update'), modifierController.updateGroup);
// Eliminar grupo y todas sus opciones asociadas - requiere permiso modifiers:delete
router.delete('/groups/:id', authenticateToken, validateId(), requirePermission('modifiers', 'delete'), modifierController.deleteGroup);

// --- Opciones de Modificadores ---
// Agregar opción a un grupo existente - requiere permiso modifiers:create
router.post('/groups/:groupId/options', authenticateToken, validateId('groupId'), requirePermission('modifiers', 'create'), modifierController.addOption);
// Actualizar una opción específica - requiere permiso modifiers:update
router.put('/options/:optionId', authenticateToken, validateId('optionId'), requirePermission('modifiers', 'update'), modifierController.updateOption);
// Eliminar una opción de modificador - requiere permiso modifiers:delete
router.delete('/options/:optionId', authenticateToken, validateId('optionId'), requirePermission('modifiers', 'delete'), modifierController.deleteOption);

export default router;
