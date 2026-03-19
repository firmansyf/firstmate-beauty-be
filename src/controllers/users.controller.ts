// src/controllers/users.controller.ts
import { Request, Response } from 'express';
import { query } from '../config/database';

// Get all users (admin only)
export const getUsers = async (req: Request, res: Response) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;

    let sql = `
      SELECT
        u.id, u.name, u.email, u.phone, u.role, u.created_at,
        (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) as order_count,
        (SELECT COALESCE(SUM(total), 0) FROM orders o WHERE o.user_id = u.id AND o.status = 'delivered') as total_spent
      FROM users u
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (role) {
      sql += ` AND u.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (search) {
      sql += ` AND (u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR u.phone ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sql += ` ORDER BY u.created_at DESC`;

    // Pagination
    const offset = (Number(page) - 1) * Number(limit);
    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), offset);

    const result = await query(sql, params);

    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) FROM users u WHERE 1=1';
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (role) {
      countSql += ` AND u.role = $${countParamIndex}`;
      countParams.push(role);
      countParamIndex++;
    }

    if (search) {
      countSql += ` AND (u.name ILIKE $${countParamIndex} OR u.email ILIKE $${countParamIndex} OR u.phone ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      message: 'Data pengguna berhasil diambil',
      data: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Get user by ID (admin only)
export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
        u.id, u.name, u.email, u.phone, u.role, u.created_at,
        (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) as order_count,
        (SELECT COALESCE(SUM(total), 0) FROM orders o WHERE o.user_id = u.id AND o.status = 'delivered') as total_spent
       FROM users u
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }

    // Get recent orders
    const ordersResult = await query(
      `SELECT id, order_number, status, payment_status, total, created_at
       FROM orders
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [id]
    );

    res.json({
      message: 'Data pengguna berhasil diambil',
      data: {
        ...result.rows[0],
        recent_orders: ordersResult.rows,
      },
    });
  } catch (error) {
    console.error('Get user by id error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Get user statistics (admin only)
export const getUserStats = async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) FILTER (WHERE role = 'customer') as total_customers,
        COUNT(*) FILTER (WHERE role = 'admin') as total_admins,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_users_30d,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as new_users_7d
      FROM users
    `);

    res.json({
      message: 'Statistik pengguna berhasil diambil',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};
