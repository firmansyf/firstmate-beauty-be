import { Router } from 'express';
import {
  createRefundRequest,
  getUserRefunds,
  getRefundDetail,
  getAllRefunds,
  getRefundDetailAdmin,
  approveRefund,
  rejectRefund,
  completeRefund,
} from '../controllers/refunds.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth';

const router = Router();

// Customer routes
router.post('/', authenticateToken, createRefundRequest);
router.get('/my-refunds', authenticateToken, getUserRefunds);
router.get('/:id', authenticateToken, getRefundDetail);

// Admin routes
router.get('/admin/all', authenticateToken, authorizeRole('admin'), getAllRefunds);
router.get('/admin/:id', authenticateToken, authorizeRole('admin'), getRefundDetailAdmin);
router.post('/admin/:id/approve', authenticateToken, authorizeRole('admin'), approveRefund);
router.post('/admin/:id/reject', authenticateToken, authorizeRole('admin'), rejectRefund);
router.post('/admin/:id/complete', authenticateToken, authorizeRole('admin'), completeRefund);

export default router;
