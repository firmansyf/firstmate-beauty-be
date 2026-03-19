// src/routes/auth.routes.ts
import { Router } from 'express';
import { register, login, getProfile } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/profile', authenticateToken, getProfile);

export default router;