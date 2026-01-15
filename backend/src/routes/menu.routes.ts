import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import * as categoryController from '../controllers/category.controller';
import * as productController from '../controllers/product.controller';

const router = Router();

// Categories
router.get('/categories', authenticateToken, categoryController.listCategories);
router.get('/categories/:id', authenticateToken, categoryController.getCategory);
router.post('/categories', authenticateToken, categoryController.createCategory);
router.put('/categories/:id', authenticateToken, categoryController.updateCategory);
router.delete('/categories/:id', authenticateToken, categoryController.deleteCategory);

// Products
router.get('/products', authenticateToken, productController.listProducts);
router.get('/products/:id', authenticateToken, productController.getProduct);
router.post('/products', authenticateToken, productController.createProduct);
router.put('/products/:id', authenticateToken, productController.updateProduct);
router.delete('/products/:id', authenticateToken, productController.deleteProduct); // Soft Delete
router.patch('/products/:id/toggle', authenticateToken, productController.toggleActive);

export default router;
