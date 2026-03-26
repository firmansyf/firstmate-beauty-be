import { Router } from 'express';
import { createSnapToken, handleNotification, checkPaymentStatus } from '../controllers/payment.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Create Snap token for an order (customer)
router.post('/:orderId/token', authenticateToken, createSnapToken);

// Check payment status from Midtrans (called by frontend after Snap success)
router.get('/:orderId/check-status', authenticateToken, checkPaymentStatus);

// Midtrans webhook notification (no auth - called by Midtrans server)
router.post('/notification', handleNotification);

export default router;
