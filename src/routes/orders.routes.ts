// src/routes/orders.routes.ts
import { Router } from 'express';
import {
  createOrder,
  getUserOrders,
  getOrderDetail,
  cancelOrder,
  confirmOrderReceived,
  getAllOrders,
  getOrderDetailAdmin,
  updateOrderStatus,
  uploadPaymentProof,
} from '../controllers/orders.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth';

const router = Router();

// Customer routes
router.post('/', authenticateToken, createOrder);
router.get('/my-orders', authenticateToken, getUserOrders);
router.get('/:id', authenticateToken, getOrderDetail);
router.post('/:id/cancel', authenticateToken, cancelOrder);
router.post('/:id/received', authenticateToken, confirmOrderReceived);
router.post('/:id/payment-proof', authenticateToken, uploadPaymentProof);

// Admin routes
router.get('/admin/all', authenticateToken, authorizeRole('admin'), getAllOrders);
router.get('/admin/:id', authenticateToken, authorizeRole('admin'), getOrderDetailAdmin);
router.put('/admin/:id/status', authenticateToken, authorizeRole('admin'), updateOrderStatus);

export default router;