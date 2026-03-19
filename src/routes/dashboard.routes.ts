// src/routes/dashboard.routes.ts
import { Router } from 'express';
import {
  getDashboardStats,
  getRecentOrders,
  getTopProducts,
  getLowStockProducts,
  getSalesChart,
} from '../controllers/dashboard.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth';

const router = Router();

// All dashboard routes require admin authentication
router.use(authenticateToken, authorizeRole('admin'));

// GET /api/dashboard/stats - Get overall dashboard statistics
router.get('/stats', getDashboardStats);

// GET /api/dashboard/recent-orders - Get recent orders
router.get('/recent-orders', getRecentOrders);

// GET /api/dashboard/top-products - Get top selling products
router.get('/top-products', getTopProducts);

// GET /api/dashboard/low-stock - Get low stock products
router.get('/low-stock', getLowStockProducts);

// GET /api/dashboard/sales-chart - Get sales chart data
router.get('/sales-chart', getSalesChart);

export default router;
