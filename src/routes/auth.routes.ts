// src/routes/auth.routes.ts
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, getProfile, forgotPassword, resetPassword, googleAuth } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Terlalu banyak permintaan reset password. Coba lagi dalam 1 jam.' },
});

// Public routes
router.post('/register', register);
router.post('/login', loginLimiter, login);
router.post('/google', loginLimiter, googleAuth);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', forgotPasswordLimiter, resetPassword);

// Protected routes
router.get('/profile', authenticateToken, getProfile);

export default router;