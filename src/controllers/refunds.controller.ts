import { Request, Response } from 'express';
import { query } from '../config/database';
import { createNotification } from './notifications.controller';

// Generate refund number
const generateRefundNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `REF-${year}${month}${day}-${random}`;
};

// Customer: Create refund request
export const createRefundRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { order_id, reason, ewallet_phone } = req.body;

    // Validation
    if (!order_id || !reason || !ewallet_phone) {
      return res.status(400).json({
        message: 'Order ID, alasan, dan nomor e-wallet wajib diisi'
      });
    }

    // Validate e-wallet phone
    if (ewallet_phone.trim().length < 10) {
      return res.status(400).json({
        message: 'Nomor e-wallet tidak valid (minimal 10 digit)'
      });
    }

    // Check order exists and belongs to user
    const orderResult = await query(
      `SELECT id, user_id, status, payment_status, total
       FROM orders WHERE id = $1 AND user_id = $2`,
      [order_id, userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
    }

    const order = orderResult.rows[0];

    // Check order status is 'shipped'
    if (order.status !== 'shipped') {
      return res.status(400).json({
        message: 'Refund hanya dapat diajukan untuk pesanan yang sudah dikirim'
      });
    }

    // Check payment is 'paid'
    if (order.payment_status !== 'paid') {
      return res.status(400).json({
        message: 'Refund hanya dapat diajukan untuk pesanan yang sudah dibayar'
      });
    }

    // Check no existing pending/approved refund
    const existingRefund = await query(
      `SELECT id FROM refunds
       WHERE order_id = $1 AND status IN ('pending', 'approved')`,
      [order_id]
    );

    if (existingRefund.rows.length > 0) {
      return res.status(400).json({
        message: 'Sudah ada permintaan refund untuk pesanan ini'
      });
    }

    // Create refund request
    const refundNumber = generateRefundNumber();
    const result = await query(
      `INSERT INTO refunds
       (order_id, user_id, refund_number, reason, refund_amount, ewallet_phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [order_id, userId, refundNumber, reason, order.total, ewallet_phone]
    );

    // Fire-and-forget notification
    createNotification(
      'new_refund',
      'Permintaan Refund Baru',
      `Refund ${refundNumber} untuk pesanan #${order_id} telah diajukan`,
      { refund_id: result.rows[0].id, refund_number: refundNumber, order_id }
    );

    res.status(201).json({
      message: 'Permintaan refund berhasil diajukan',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create refund request error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Customer: Get user's refund requests
export const getUserRefunds = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    const result = await query(
      `SELECT r.*, o.order_number, o.total as order_total
       FROM refunds r
       JOIN orders o ON r.order_id = o.id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );

    res.json({
      message: 'Data refund berhasil diambil',
      data: result.rows,
    });
  } catch (error) {
    console.error('Get user refunds error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Customer: Get refund detail
export const getRefundDetail = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const result = await query(
      `SELECT r.*, o.order_number, o.total as order_total,
              o.recipient_name, o.shipping_address
       FROM refunds r
       JOIN orders o ON r.order_id = o.id
       WHERE r.id = $1 AND r.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Refund tidak ditemukan' });
    }

    res.json({
      message: 'Detail refund berhasil diambil',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get refund detail error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Admin: Get all refund requests
export const getAllRefunds = async (req: Request, res: Response) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let queryText = `
      SELECT r.*, o.order_number, o.total as order_total,
             u.name as customer_name, u.email as customer_email, u.phone as customer_phone
      FROM refunds r
      JOIN orders o ON r.order_id = o.id
      JOIN users u ON r.user_id = u.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      queryText += ` AND r.status = $${paramCount}`;
      params.push(status);
    }

    if (search) {
      paramCount++;
      queryText += ` AND (r.refund_number ILIKE $${paramCount} OR o.order_number ILIKE $${paramCount} OR u.name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    queryText += ` ORDER BY r.created_at DESC`;

    paramCount++;
    queryText += ` LIMIT $${paramCount}`;
    params.push(limit);

    paramCount++;
    queryText += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await query(queryText, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM refunds r
      JOIN orders o ON r.order_id = o.id
      JOIN users u ON r.user_id = u.id
      WHERE 1=1
    `;
    const countParams: any[] = [];
    let countParamNum = 0;

    if (status) {
      countParamNum++;
      countQuery += ` AND r.status = $${countParamNum}`;
      countParams.push(status);
    }

    if (search) {
      countParamNum++;
      countQuery += ` AND (r.refund_number ILIKE $${countParamNum} OR o.order_number ILIKE $${countParamNum} OR u.name ILIKE $${countParamNum})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      message: 'Data refund berhasil diambil',
      data: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get all refunds error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Admin: Get refund detail
export const getRefundDetailAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT r.*, o.order_number, o.total as order_total,
              o.recipient_name, o.phone as order_phone, o.shipping_address,
              u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
              a.name as approved_by_name
       FROM refunds r
       JOIN orders o ON r.order_id = o.id
       JOIN users u ON r.user_id = u.id
       LEFT JOIN users a ON r.approved_by = a.id
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Refund tidak ditemukan' });
    }

    res.json({
      message: 'Detail refund berhasil diambil',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get refund detail admin error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Admin: Approve refund
export const approveRefund = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId;
    const { id } = req.params;
    const { admin_notes } = req.body;

    const refundResult = await query(
      'SELECT * FROM refunds WHERE id = $1',
      [id]
    );

    if (refundResult.rows.length === 0) {
      return res.status(404).json({ message: 'Refund tidak ditemukan' });
    }

    const refund = refundResult.rows[0];

    if (refund.status !== 'pending') {
      return res.status(400).json({
        message: 'Hanya refund dengan status pending yang bisa disetujui'
      });
    }

    const result = await query(
      `UPDATE refunds
       SET status = 'approved',
           admin_notes = $1,
           approved_by = $2,
           approved_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [admin_notes, adminId, id]
    );

    res.json({
      message: 'Refund berhasil disetujui',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Approve refund error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Admin: Reject refund
export const rejectRefund = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId;
    const { id } = req.params;
    const { admin_notes } = req.body;

    if (!admin_notes) {
      return res.status(400).json({
        message: 'Alasan penolakan wajib diisi'
      });
    }

    const refundResult = await query(
      'SELECT * FROM refunds WHERE id = $1',
      [id]
    );

    if (refundResult.rows.length === 0) {
      return res.status(404).json({ message: 'Refund tidak ditemukan' });
    }

    const refund = refundResult.rows[0];

    if (refund.status !== 'pending') {
      return res.status(400).json({
        message: 'Hanya refund dengan status pending yang bisa ditolak'
      });
    }

    const result = await query(
      `UPDATE refunds
       SET status = 'rejected',
           admin_notes = $1,
           approved_by = $2,
           rejected_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [admin_notes, adminId, id]
    );

    res.json({
      message: 'Refund ditolak',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Reject refund error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Admin: Complete refund (after manual transfer)
export const completeRefund = async (req: Request, res: Response) => {
  try {
    await query('BEGIN');

    const { id } = req.params;
    const { transfer_proof_url } = req.body;

    const refundResult = await query(
      'SELECT r.*, o.id as order_id FROM refunds r JOIN orders o ON r.order_id = o.id WHERE r.id = $1',
      [id]
    );

    if (refundResult.rows.length === 0) {
      await query('ROLLBACK');
      return res.status(404).json({ message: 'Refund tidak ditemukan' });
    }

    const refund = refundResult.rows[0];

    if (refund.status !== 'approved') {
      await query('ROLLBACK');
      return res.status(400).json({
        message: 'Hanya refund yang sudah disetujui yang bisa diselesaikan'
      });
    }

    // Update refund status to completed
    const result = await query(
      `UPDATE refunds
       SET status = 'completed',
           transfer_proof_url = $1,
           completed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [transfer_proof_url, id]
    );

    // Update order payment_status to 'refunded'
    await query(
      `UPDATE orders SET payment_status = 'refunded' WHERE id = $1`,
      [refund.order_id]
    );

    await query('COMMIT');

    res.json({
      message: 'Refund berhasil diselesaikan',
      data: result.rows[0],
    });
  } catch (error) {
    await query('ROLLBACK');
    console.error('Complete refund error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};
