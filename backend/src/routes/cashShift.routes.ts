/**
 * @fileoverview Rutas de Turnos de Caja
 *
 * Gestiona el ciclo de vida de los turnos de caja: apertura, cierre, consulta
 * del turno actual y generación de reportes. El turno de caja es fundamental
 * para el control financiero del restaurante: cada pago se asocia al turno
 * activo del cajero.
 *
 * Existen dos modalidades de cierre:
 * - Cierre simple (legacy): el sistema calcula el total automáticamente.
 * - Cierre con arqueo ciego: el cajero declara cuánto dinero tiene sin ver
 *   el total esperado, y el sistema calcula la diferencia.
 *
 * @module routes/cashShift.routes
 */

import { Router } from 'express';
import { openShift, closeShift, closeShiftWithCount, getShiftReport, getCurrentShift, getAllShifts } from '../controllers/cashShift.controller';
import { authenticateToken as authenticate, requirePermission } from '../middleware/auth';

const router = Router();

// Todas las rutas de caja requieren autenticación
router.use(authenticate);

// SEC-005: Listar todos los turnos requiere permiso de lectura de caja
router.get('/', requirePermission('cash_shifts', 'read'), getAllShifts);

// Abrir un nuevo turno de caja con monto inicial
router.post('/open', requirePermission('cash_shifts', 'create'), openShift);
// Cierre simple (legacy): cierra el turno calculando totales automáticamente
router.post('/close', requirePermission('cash_shifts', 'update'), closeShift);
// Cierre con arqueo ciego: el cajero reporta el conteo físico del dinero
router.post('/close-with-count', requirePermission('cash_shifts', 'update'), closeShiftWithCount);
// Obtener el turno activo del usuario autenticado
router.get('/current', requirePermission('cash_shifts', 'read'), getCurrentShift);
// Reporte detallado de un turno específico (ventas, pagos, diferencias)
router.get('/:id/report', requirePermission('cash_shifts', 'read'), getShiftReport);

export default router;
