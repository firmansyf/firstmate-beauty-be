// src/routes/categories.routes.ts
import { Router } from 'express';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categories.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/', getCategories);
router.get('/:id', getCategoryById);

// Admin routes
router.post('/', authenticateToken, authorizeRole('admin'), createCategory);
router.put('/:id', authenticateToken, authorizeRole('admin'), updateCategory);
router.delete('/:id', authenticateToken, authorizeRole('admin'), deleteCategory);

export default router;
