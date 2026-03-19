import { Router } from 'express';
import { sendOTP, verifyOTP } from '../controllers/otp.controller';

const router = Router();

// Public routes
router.post('/send', sendOTP);
router.post('/verify', verifyOTP);

export default router;
