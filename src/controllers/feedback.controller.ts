import { Request, Response } from 'express';
import { query } from '../config/database';

// Submit feedback (public — works for guests and logged-in users)
export const submitFeedback = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId || null;
    const { name, email, rating, category = 'general', message } = req.body;

    if (!name || !message) {
      return res.status(400).json({ message: 'Nama dan pesan wajib diisi' });
    }

    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ message: 'Rating harus antara 1-5' });
    }

    const validCategories = ['general', 'bug', 'suggestion', 'praise'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ message: 'Kategori tidak valid' });
    }

    const result = await query(
      `INSERT INTO feedbacks (user_id, name, email, rating, category, message)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, name, email, rating || null, category, message]
    );

    res.status(201).json({
      message: 'Feedback berhasil dikirim. Terima kasih!',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Admin: Get all feedbacks with pagination & filters
export const getAllFeedbacks = async (req: Request, res: Response) => {
  try {
    const { rating, category, is_read, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let queryText = `
      SELECT f.*, u.name as user_name
      FROM feedbacks f
      LEFT JOIN users u ON f.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (rating) {
      paramCount++;
      queryText += ` AND f.rating = $${paramCount}`;
      params.push(rating);
    }

    if (category) {
      paramCount++;
      queryText += ` AND f.category = $${paramCount}`;
      params.push(category);
    }

    if (is_read !== undefined && is_read !== '') {
      queryText += ` AND f.is_read = ${is_read === 'true'}`;
    }

    queryText = `SELECT *, COUNT(*) OVER() AS total_count FROM (${queryText} ORDER BY f.created_at DESC) sub`;

    paramCount++;
    queryText += ` LIMIT $${paramCount}`;
    params.push(limit);

    paramCount++;
    queryText += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await query(queryText, params);
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

    res.json({
      message: 'Data feedback berhasil diambil',
      data: result.rows,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error('Get feedbacks error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Admin: Get unread count
export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT COUNT(*) as count FROM feedbacks WHERE is_read = false'
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Admin: Mark feedback as read
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'UPDATE feedbacks SET is_read = true WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Feedback tidak ditemukan' });
    }

    res.json({ message: 'Feedback ditandai sudah dibaca', data: result.rows[0] });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Admin: Mark all as read
export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    await query('UPDATE feedbacks SET is_read = true WHERE is_read = false');
    res.json({ message: 'Semua feedback ditandai sudah dibaca' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Admin: Delete feedback
export const deleteFeedback = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM feedbacks WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Feedback tidak ditemukan' });
    }

    res.json({ message: 'Feedback berhasil dihapus' });
  } catch (error) {
    console.error('Delete feedback error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};
