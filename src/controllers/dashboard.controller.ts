// src/controllers/dashboard.controller.ts
import { Request, Response } from 'express';
import { query } from '../config/database';

// Get dashboard statistics
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    // Get overall stats
    const statsResult = await query(`
      SELECT
        (SELECT COUNT(*) FROM products WHERE is_available = true) as total_products,
        (SELECT COUNT(*) FROM categories) as total_categories,
        (SELECT COUNT(*) FROM users WHERE role = 'customer') as total_customers,
        (SELECT COUNT(*) FROM orders) as total_orders,
        (SELECT COUNT(*) FROM orders WHERE status = 'pending') as pending_orders,
        (SELECT COUNT(*) FROM orders WHERE status = 'confirmed') as confirmed_orders,
        (SELECT COUNT(*) FROM orders WHERE status = 'processing') as processing_orders,
        (SELECT COUNT(*) FROM orders WHERE status = 'shipped') as shipped_orders,
        (SELECT COUNT(*) FROM orders WHERE status = 'delivered') as delivered_orders,
        (SELECT COUNT(*) FROM orders WHERE status = 'cancelled') as cancelled_orders,
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status = 'delivered') as total_revenue,
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status = 'delivered' AND created_at >= NOW() - INTERVAL '30 days') as revenue_30d,
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status = 'delivered' AND created_at >= NOW() - INTERVAL '7 days') as revenue_7d,
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status = 'delivered' AND DATE(created_at) = CURRENT_DATE) as revenue_today,
        (SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURRENT_DATE) as orders_today,
        (SELECT COUNT(*) FROM orders WHERE created_at >= NOW() - INTERVAL '7 days') as orders_7d
    `);

    res.json({
      message: 'Dashboard stats berhasil diambil',
      data: statsResult.rows[0],
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Get recent orders for dashboard
export const getRecentOrders = async (req: Request, res: Response) => {
  try {
    const { limit = 5 } = req.query;

    const result = await query(`
      SELECT o.*, u.name as customer_name, u.email as customer_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
      LIMIT $1
    `, [limit]);

    res.json({
      message: 'Recent orders berhasil diambil',
      data: result.rows,
    });
  } catch (error) {
    console.error('Get recent orders error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Get top selling products
export const getTopProducts = async (req: Request, res: Response) => {
  try {
    const { limit = 5 } = req.query;

    const result = await query(`
      SELECT
        p.id, p.name, p.slug, p.price, p.image_url,
        SUM(oi.quantity) as total_sold,
        SUM(oi.subtotal) as total_revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'delivered'
      GROUP BY p.id, p.name, p.slug, p.price, p.image_url
      ORDER BY total_sold DESC
      LIMIT $1
    `, [limit]);

    res.json({
      message: 'Top products berhasil diambil',
      data: result.rows,
    });
  } catch (error) {
    console.error('Get top products error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Get low stock products
export const getLowStockProducts = async (req: Request, res: Response) => {
  try {
    const { limit = 5, threshold = 10 } = req.query;

    const result = await query(`
      SELECT id, name, slug, stock, unit, image_url
      FROM products
      WHERE stock <= $1 AND is_available = true
      ORDER BY stock ASC
      LIMIT $2
    `, [threshold, limit]);

    res.json({
      message: 'Low stock products berhasil diambil',
      data: result.rows,
    });
  } catch (error) {
    console.error('Get low stock products error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Get sales chart data (last 7 days)
export const getSalesChart = async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as order_count,
        COALESCE(SUM(total), 0) as total_sales
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '7 days'
        AND status != 'cancelled'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    res.json({
      message: 'Sales chart data berhasil diambil',
      data: result.rows,
    });
  } catch (error) {
    console.error('Get sales chart error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};
