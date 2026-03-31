// src/controllers/notifications.controller.ts
import { Request, Response } from 'express';
import { query } from '../config/database';

// Helper: create a notification (called internally by other controllers)
export const createNotification = async (
  type: string,
  title: string,
  message: string,
  data?: object
): Promise<void> => {
  try {
    await query(
      `INSERT INTO notifications (type, title, message, data) VALUES ($1, $2, $3, $4)`,
      [type, title, message, data ? JSON.stringify(data) : null]
    );
  } catch (error) {
    console.error('Create notification error:', error);
  }
};

// GET /api/notifications
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, is_read } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let baseQuery = `SELECT * FROM notifications WHERE 1=1`;

    if (is_read !== undefined && is_read !== '') {
      baseQuery += ` AND is_read = ${is_read === 'true'}`;
    }

    const params: any[] = [];
    let paramCount = 0;

    const paginatedQuery = `
      SELECT *, COUNT(*) OVER() AS total_count
      FROM (${baseQuery} ORDER BY created_at DESC) sub
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    params.push(limit, offset);

    const result = await query(paginatedQuery, params);
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

    res.json({
      message: 'Data notifikasi berhasil diambil',
      data: result.rows,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// GET /api/notifications/unread-count
export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE is_read = false'
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// PUT /api/notifications/:id/read
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      'UPDATE notifications SET is_read = true WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Notifikasi tidak ditemukan' });
    }
    res.json({ message: 'Notifikasi ditandai sudah dibaca', data: result.rows[0] });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// PUT /api/notifications/read-all
export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    await query('UPDATE notifications SET is_read = true WHERE is_read = false');
    res.json({ message: 'Semua notifikasi ditandai sudah dibaca' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// DELETE /api/notifications/:id
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      'DELETE FROM notifications WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Notifikasi tidak ditemukan' });
    }
    res.json({ message: 'Notifikasi berhasil dihapus' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};
