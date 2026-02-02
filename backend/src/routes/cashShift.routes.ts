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
import { authenticateToken as authenticate } from '../middleware/auth';

const router = Router();

// Todas las rutas de caja requieren autenticación
router.use(authenticate);

// Listar todos los turnos con filtros opcionales (fecha, usuario, estado)
router.get('/', getAllShifts);

// Abrir un nuevo turno de caja con monto inicial
router.post('/open', openShift);
// Cierre simple (legacy): cierra el turno calculando totales automáticamente
router.post('/close', closeShift);
// Cierre con arqueo ciego: el cajero reporta el conteo físico del dinero
router.post('/close-with-count', closeShiftWithCount);
// Obtener el turno activo del usuario autenticado
router.get('/current', getCurrentShift);
// Reporte detallado de un turno específico (ventas, pagos, diferencias)
router.get('/:id/report', getShiftReport);

export default router;
