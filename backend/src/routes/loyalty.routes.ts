/**
 * @fileoverview Rutas del Programa de Fidelidad y Billetera
 *
 * Gestiona el sistema de puntos de fidelidad y billetera virtual de clientes.
 * Los clientes acumulan puntos por cada compra y pueden canjearlos por descuentos.
 * La billetera permite cargar saldo prepago que se descuenta al pagar.
 *
 * Endpoints disponibles:
 * - Configuración del programa (ratio de acumulación, valor del punto)
 * - Consulta de balance de puntos y saldo de billetera por cliente
 * - Canjear puntos acumulados por descuento
 * - Cargar y usar saldo de billetera virtual
 *
 * El :id en las rutas corresponde al ID del cliente.
 *
 * @module routes/loyalty.routes
 */

import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { validateId } from '../middleware/validateId';
import * as loyaltyController from '../controllers/loyalty.controller';

const router = Router();

// Todas las rutas de fidelidad requieren autenticación
router.use(authenticate);

// SEC-005: Obtener la configuración del programa de fidelidad del tenant
router.get('/config', requirePermission('loyalty', 'read'), loyaltyController.getConfig);

// Consultar balance de puntos y saldo de billetera de un cliente
router.get('/:id', validateId(), requirePermission('loyalty', 'read'), loyaltyController.getBalance);

// Canjear puntos acumulados por un descuento en la orden actual
router.post('/:id/redeem', validateId(), requirePermission('loyalty', 'update'), loyaltyController.redeemPoints);

// Operaciones de billetera virtual
// Cargar saldo a la billetera de un cliente (pago anticipado)
router.post('/:id/wallet/add', validateId(), requirePermission('loyalty', 'update'), loyaltyController.addWalletFunds);
// Descontar saldo de la billetera de un cliente al pagar una orden
router.post('/:id/wallet/use', validateId(), requirePermission('loyalty', 'update'), loyaltyController.useWalletFunds);

export default router;
