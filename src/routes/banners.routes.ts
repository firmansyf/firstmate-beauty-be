import { Router } from 'express';
import {
  getActiveBanners,
  getAllBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerStatus,
} from '../controllers/banners.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth';

const router = Router();

// Public route
router.get('/', getActiveBanners);

// Admin routes
router.get('/admin/all', authenticateToken, authorizeRole('admin'), getAllBanners);
router.get('/admin/:id', authenticateToken, authorizeRole('admin'), getBannerById);
router.post('/', authenticateToken, authorizeRole('admin'), createBanner);
router.put('/:id', authenticateToken, authorizeRole('admin'), updateBanner);
router.patch('/:id/toggle', authenticateToken, authorizeRole('admin'), toggleBannerStatus);
router.delete('/:id', authenticateToken, authorizeRole('admin'), deleteBanner);

export default router;
