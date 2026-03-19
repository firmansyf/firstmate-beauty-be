import { Router } from 'express';
import {
  upload,
  uploadProductImage,
  deleteProductImage,
  uploadQris,
  uploadQrisImage,
  deleteQrisImage
} from '../controllers/upload.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth';

const router = Router();

// Upload product image (admin only)
router.post(
  '/product',
  authenticateToken,
  authorizeRole('admin'),
  upload.single('image'),
  uploadProductImage
);

// Delete product image (admin only)
router.delete(
  '/product/:filename',
  authenticateToken,
  authorizeRole('admin'),
  deleteProductImage
);

// Upload QRIS image (admin only)
router.post(
  '/qris',
  authenticateToken,
  authorizeRole('admin'),
  uploadQris.single('image'),
  uploadQrisImage
);

// Delete QRIS image (admin only)
router.delete(
  '/qris',
  authenticateToken,
  authorizeRole('admin'),
  deleteQrisImage
);

export default router;
