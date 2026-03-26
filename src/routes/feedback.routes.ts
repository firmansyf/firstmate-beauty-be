import { Router } from 'express';
import {
  submitFeedback,
  getAllFeedbacks,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteFeedback,
} from '../controllers/feedback.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth';

const router = Router();

// Public — optional auth (token attached if logged in, ignored if not)
router.post('/', submitFeedback);

// Admin only
router.get('/admin/all', authenticateToken, authorizeRole('admin'), getAllFeedbacks);
router.get('/admin/unread-count', authenticateToken, authorizeRole('admin'), getUnreadCount);
router.patch('/admin/:id/read', authenticateToken, authorizeRole('admin'), markAsRead);
router.patch('/admin/mark-all-read', authenticateToken, authorizeRole('admin'), markAllAsRead);
router.delete('/admin/:id', authenticateToken, authorizeRole('admin'), deleteFeedback);

export default router;
