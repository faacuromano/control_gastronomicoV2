/**
 * @fileoverview Rutas del Menú (Categorías y Productos)
 *
 * Define los endpoints CRUD para categorías y productos del restaurante.
 * Las operaciones de lectura (GET) requieren permiso products:read y son
 * usadas por el POS para mostrar el menú. Las operaciones de escritura
 * (POST, PUT, DELETE) requieren permisos de administración (create/update/delete)
 * y son usadas desde el módulo de administración.
 *
 * Cada producto pertenece a una categoría. Las categorías pueden tener una
 * impresora asociada para el enrutamiento automático de tickets a cocina/bar.
 *
 * @module routes/menu.routes
 */

import { Router } from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { validateId } from '../middleware/validateId';
import * as categoryController from '../controllers/category.controller';
import * as productController from '../controllers/product.controller';

const router = Router();

// Todas las rutas del menú requieren autenticación
router.use(authenticateToken);

// --- Categorías ---
// Lectura: accesible para cualquier usuario con permiso de lectura de productos (POS, cocina)
router.get('/categories', requirePermission('products', 'read'), categoryController.listCategories);
router.get('/categories/:id', validateId(), requirePermission('products', 'read'), categoryController.getCategory);

// Escritura: operaciones administrativas que requieren permisos específicos de gestión
router.post('/categories', requirePermission('products', 'create'), categoryController.createCategory);
router.put('/categories/:id', validateId(), requirePermission('products', 'update'), categoryController.updateCategory);
router.delete('/categories/:id', validateId(), requirePermission('products', 'delete'), categoryController.deleteCategory);

// --- Productos ---
// Lectura: accesible desde el POS para armar órdenes
router.get('/products', requirePermission('products', 'read'), productController.listProducts);
router.get('/products/:id', validateId(), requirePermission('products', 'read'), productController.getProduct);

// Escritura: operaciones administrativas de gestión de productos
router.post('/products', requirePermission('products', 'create'), productController.createProduct);
router.put('/products/:id', validateId(), requirePermission('products', 'update'), productController.updateProduct);
router.delete('/products/:id', validateId(), requirePermission('products', 'delete'), productController.deleteProduct);
// Activar/desactivar un producto sin eliminarlo (para ocultarlo temporalmente del menú)
router.patch('/products/:id/toggle', validateId(), requirePermission('products', 'update'), productController.toggleActive);

export default router;
