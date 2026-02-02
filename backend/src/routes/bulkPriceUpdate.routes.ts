/**
 * @fileoverview Rutas de Actualización Masiva de Precios
 *
 * Permite a los administradores modificar precios de múltiples productos
 * de forma simultánea. El flujo es: consultar productos en grilla, previsualizar
 * cambios (para verificar antes de aplicar), y finalmente aplicar los ajustes.
 * También soporta actualización por categoría completa (ej: subir 10% a "Bebidas").
 *
 * @module routes/bulkPriceUpdate.routes
 */

import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import * as bulkPriceController from '../controllers/bulkPriceUpdate.controller';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Obtener productos formateados para la grilla de edición de precios
router.get('/products',
    requirePermission('products', 'browse'),
    bulkPriceController.getProductsForGrid
);

// Obtener categorías para el dropdown de filtrado en la UI
router.get('/categories',
    requirePermission('products', 'browse'),
    bulkPriceController.getCategories
);

// Previsualizar cambios de precio antes de aplicarlos (muestra precio actual vs nuevo)
router.post('/preview',
    requirePermission('products', 'update'),
    bulkPriceController.previewChanges
);

// Aplicar actualizaciones masivas de precio (requiere permiso de actualización de productos)
router.post('/apply',
    requirePermission('products', 'update'),
    bulkPriceController.applyUpdates
);

// Actualizar precios de todos los productos de una categoría específica
router.post('/category/:categoryId',
    requirePermission('products', 'update'),
    bulkPriceController.updateByCategory
);

export default router;
