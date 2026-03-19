// src/routes/users.routes.ts
import { Router } from 'express';
import {
  getUsers,
  getUserById,
  getUserStats,
} from '../controllers/users.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth';

const router = Router();

// All routes require admin authentication
router.use(authenticateToken, authorizeRole('admin'));

router.get('/', getUsers);
router.get('/stats', getUserStats);
router.get('/:id', getUserById);

export default router;
