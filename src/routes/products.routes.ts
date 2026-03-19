// src/routes/products.routes.ts
import { Router } from 'express';
import {
  getProducts,
  getProductBySlug,
  getProductById,
  getProductsAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
} from '../controllers/products.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/', getProducts);
router.get('/categories', getCategories);
router.get('/id/:id', getProductById); // Get by ID for admin edit
router.get('/:slug', getProductBySlug);

// Admin routes
router.get('/admin/all', authenticateToken, authorizeRole('admin'), getProductsAdmin);
router.post('/', authenticateToken, authorizeRole('admin'), createProduct);
router.put('/:id', authenticateToken, authorizeRole('admin'), updateProduct);
router.delete('/:id', authenticateToken, authorizeRole('admin'), deleteProduct);

export default router;