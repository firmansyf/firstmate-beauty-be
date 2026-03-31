// src/routes/notifications.routes.ts
import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../controllers/notifications.controller';

const router = Router();

// All notification routes are admin-only
router.use(authenticateToken, authorizeRole('admin'));

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

export default router;
