import { Router } from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { validateId } from '../middleware/validateId';
import * as categoryController from '../controllers/category.controller';
import * as productController from '../controllers/product.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Categories
// GET - Read access for anyone with products:read (for POS)
router.get('/categories', requirePermission('products', 'read'), categoryController.listCategories);
router.get('/categories/:id', validateId(), requirePermission('products', 'read'), categoryController.getCategory);

// CUD - Admin operations require products:create/update/delete
router.post('/categories', requirePermission('products', 'create'), categoryController.createCategory);
router.put('/categories/:id', validateId(), requirePermission('products', 'update'), categoryController.updateCategory);
router.delete('/categories/:id', validateId(), requirePermission('products', 'delete'), categoryController.deleteCategory);

// Products
// GET - Read access for anyone with products:read (for POS)
router.get('/products', requirePermission('products', 'read'), productController.listProducts);
router.get('/products/:id', validateId(), requirePermission('products', 'read'), productController.getProduct);

// CUD - Admin operations require products:create/update/delete
router.post('/products', requirePermission('products', 'create'), productController.createProduct);
router.put('/products/:id', validateId(), requirePermission('products', 'update'), productController.updateProduct);
router.delete('/products/:id', validateId(), requirePermission('products', 'delete'), productController.deleteProduct);
router.patch('/products/:id/toggle', validateId(), requirePermission('products', 'update'), productController.toggleActive);

export default router;
