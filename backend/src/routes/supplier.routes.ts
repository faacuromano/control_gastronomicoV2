/**
 * @fileoverview Rutas de Gestión de Proveedores
 *
 * CRUD de proveedores del restaurante. Los proveedores se vinculan a las
 * órdenes de compra (PurchaseOrder) para llevar registro de a quién se
 * le compra cada ingrediente, precios negociados y datos de contacto.
 *
 * FIX-001 (SEC-001): Todas las rutas requieren autenticación. Las operaciones
 * de escritura (POST/PUT/DELETE) requieren rol ADMIN.
 *
 * @module routes/supplier.routes
 */

import { Router } from 'express';
import { validateId } from '../middleware/validateId';
import { authenticate, requirePermission } from '../middleware/auth';
import * as SupplierController from '../controllers/supplier.controller';

const router = Router();

// Listar todos los proveedores del tenant - requiere permiso suppliers:read
router.get('/suppliers', authenticate, requirePermission('suppliers', 'read'), SupplierController.getSuppliers);
// Obtener detalle de un proveedor por ID - requiere permiso suppliers:read
router.get('/suppliers/:id', authenticate, validateId(), requirePermission('suppliers', 'read'), SupplierController.getSupplierById);
// Crear nuevo proveedor - requiere permiso suppliers:create
router.post('/suppliers', authenticate, requirePermission('suppliers', 'create'), SupplierController.createSupplier);
// Actualizar datos de un proveedor existente - requiere permiso suppliers:update
router.put('/suppliers/:id', authenticate, validateId(), requirePermission('suppliers', 'update'), SupplierController.updateSupplier);
// Eliminar un proveedor - requiere permiso suppliers:delete
router.delete('/suppliers/:id', authenticate, validateId(), requirePermission('suppliers', 'delete'), SupplierController.deleteSupplier);

export default router;
