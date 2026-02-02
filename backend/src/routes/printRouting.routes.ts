/**
 * @fileoverview Rutas de Enrutamiento de Impresión (estilo Toast POS)
 *
 * Configura hacia qué impresora se envía cada ticket según la categoría
 * del producto y el área del restaurante. Por ejemplo:
 * - Categoría "Bebidas" -> Impresora de Barra
 * - Categoría "Platos Principales" -> Impresora de Cocina
 * - Override: En el área "Terraza", "Bebidas" -> Impresora de Terraza
 *
 * Esto permite que al crear una orden, el sistema determine automáticamente
 * a qué impresora enviar cada grupo de ítems sin intervención manual.
 *
 * @module routes/printRouting.routes
 */

import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import * as printRoutingController from '../controllers/printRouting.controller';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Obtener la configuración de enrutamiento actual (categorías, áreas, impresoras asignadas)
router.get(
    '/config',
    requirePermission('printers', 'browse'),
    printRoutingController.getConfiguration
);

// Previsualizar el enrutamiento para una orden específica (qué ítems van a qué impresora)
router.get(
    '/order/:orderId',
    requirePermission('orders', 'browse'),
    printRoutingController.getOrderRouting
);

// Asignar la impresora por defecto para una categoría de producto
router.patch(
    '/category/:categoryId/printer',
    requirePermission('printers', 'update'),
    printRoutingController.setCategoryPrinter
);

// Crear override de impresora por área (una categoría usa otra impresora en cierta área)
router.post(
    '/area/:areaId/override',
    requirePermission('printers', 'update'),
    printRoutingController.setAreaOverride
);

// Eliminar override de impresora por área (vuelve a usar la impresora por defecto de la categoría)
router.delete(
    '/area/:areaId/override',
    requirePermission('printers', 'delete'),
    printRoutingController.removeAreaOverride
);

export default router;
