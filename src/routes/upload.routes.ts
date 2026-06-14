import { Router } from 'express';
import {
  upload,
  uploadProductImage,
  uploadPaymentProof,
  deleteProductImage,
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

// Upload QRIS payment proof (any authenticated customer)
router.post(
  '/payment-proof',
  authenticateToken,
  upload.single('image'),
  uploadPaymentProof
);

// Delete product image (admin only)
router.delete(
  '/product/:filename',
  authenticateToken,
  authorizeRole('admin'),
  deleteProductImage
);

export default router;
