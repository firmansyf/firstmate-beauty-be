import { Router } from 'express';
import { getPaymentSettings, updatePaymentSettings } from '../controllers/settings.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth';

const router = Router();

// Public — customers need the QRIS image to pay
router.get('/payment', getPaymentSettings);

// Admin — manage the QRIS image
router.put('/payment', authenticateToken, authorizeRole('admin'), updatePaymentSettings);

export default router;
