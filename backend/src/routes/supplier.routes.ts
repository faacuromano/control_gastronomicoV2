/**
 * @fileoverview Rutas de Gestión de Proveedores
 *
 * CRUD de proveedores del restaurante. Los proveedores se vinculan a las
 * órdenes de compra (PurchaseOrder) para llevar registro de a quién se
 * le compra cada ingrediente, precios negociados y datos de contacto.
 *
 * Nota: Este archivo no aplica middleware de autenticación a nivel de router.
 * La autenticación se debe gestionar en el punto de montaje (app.ts) o
 * agregarse aquí si se requiere protección directa.
 *
 * @module routes/supplier.routes
 */

import { Router } from 'express';
import { validateId } from '../middleware/validateId';
import * as SupplierController from '../controllers/supplier.controller';

const router = Router();

// Listar todos los proveedores del tenant
router.get('/suppliers', SupplierController.getSuppliers);
// Obtener detalle de un proveedor por ID
router.get('/suppliers/:id', validateId(), SupplierController.getSupplierById);
// Crear nuevo proveedor (nombre, teléfono, email, dirección)
router.post('/suppliers', SupplierController.createSupplier);
// Actualizar datos de un proveedor existente
router.put('/suppliers/:id', validateId(), SupplierController.updateSupplier);
// Eliminar un proveedor (falla si tiene órdenes de compra asociadas)
router.delete('/suppliers/:id', validateId(), SupplierController.deleteSupplier);

export default router;
