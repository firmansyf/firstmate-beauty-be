import { Request, Response } from 'express';
import { query } from '../config/database';
import { getPaymentInstructions, getPaymentDeadline } from '../config/payment.config';

// Helper function to auto-expire order if payment deadline has passed
const autoExpireOrder = async (order: any): Promise<boolean> => {
  // Only process if order is pending and payment is pending
  if (order.status !== 'pending' || order.payment_status !== 'pending') {
    return false;
  }

  const deadline = getPaymentDeadline(order.created_at);
  if (new Date() <= deadline) {
    return false; // Not expired yet
  }

  // Auto-cancel order and set payment_status to expired
  await query(
    `UPDATE orders
     SET status = 'cancelled',
         payment_status = 'expired',
         cancelled_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [order.id]
  );

  // Restore product stock
  const orderItems = await query(
    'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
    [order.id]
  );

  for (const item of orderItems.rows) {
    await query(
      'UPDATE products SET stock = stock + $1 WHERE id = $2',
      [item.quantity, item.product_id]
    );
  }

  return true;
};

// Generate order number
const generateOrderNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `AFS-${year}${month}${day}-${random}`;
};

// Create order from cart
export const createOrder = async (req: Request, res: Response) => {
  const client = await query('BEGIN');
  
  try {
    const userId = req.user?.userId;
    const { 
      recipient_name, 
      phone, 
      shipping_address,
      shipping_cost = 0,
      customer_notes,
      whatsapp_number 
    } = req.body;

    // Validasi
    if (!recipient_name || !phone || !shipping_address) {
      await query('ROLLBACK');
      return res.status(400).json({ 
        message: 'Data pengiriman wajib diisi' 
      });
    }

    // Get cart items
    const cart = await query(
      'SELECT id FROM carts WHERE user_id = $1',
      [userId]
    );

    if (cart.rows.length === 0) {
      await query('ROLLBACK');
      return res.status(400).json({ message: 'Keranjang kosong' });
    }

    const cartId = cart.rows[0].id;

    const cartItems = await query(
      `SELECT ci.*, p.name, p.price, p.discount_price, p.image_url, p.stock, p.is_available
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = $1`,
      [cartId]
    );

    if (cartItems.rows.length === 0) {
      await query('ROLLBACK');
      return res.status(400).json({ message: 'Keranjang kosong' });
    }

    // Validate stock and availability
    for (const item of cartItems.rows) {
      if (!item.is_available) {
        await query('ROLLBACK');
        return res.status(400).json({ 
          message: `Produk ${item.name} tidak tersedia` 
        });
      }
      
      if (item.stock < item.quantity) {
        await query('ROLLBACK');
        return res.status(400).json({ 
          message: `Stok ${item.name} tidak cukup. Stok tersedia: ${item.stock}` 
        });
      }
    }

    // Calculate subtotal
    let subtotal = 0;
    cartItems.rows.forEach(item => {
      const itemPrice = item.discount_price || item.price;
      subtotal += itemPrice * item.quantity;
    });

    const total = subtotal + Number(shipping_cost);
    const orderNumber = generateOrderNumber();

    // Create order
    const orderResult = await query(
      `INSERT INTO orders 
       (user_id, order_number, recipient_name, phone, shipping_address, 
        subtotal, shipping_cost, total, customer_notes, whatsapp_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [userId, orderNumber, recipient_name, phone, shipping_address, 
       subtotal, shipping_cost, total, customer_notes, whatsapp_number]
    );

    const order = orderResult.rows[0];

    // Create order items and update stock
    for (const item of cartItems.rows) {
      const itemPrice = item.discount_price || item.price;
      const itemSubtotal = itemPrice * item.quantity;

      await query(
        `INSERT INTO order_items 
         (order_id, product_id, product_name, product_image, price, quantity, subtotal, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [order.id, item.product_id, item.name, item.image_url, itemPrice, item.quantity, itemSubtotal, item.notes]
      );

      // Update product stock
      await query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    // Clear cart
    await query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);

    await query('COMMIT');

    // Generate payment instructions
    const paymentInfo = getPaymentInstructions(
      order.total,
      order.order_number,
      order.created_at
    );

    res.status(201).json({
      message: 'Pesanan berhasil dibuat',
      data: {
        ...order,
        payment_info: paymentInfo
      },
    });
  } catch (error) {
    await query('ROLLBACK');
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Get user orders
export const getUserOrders = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { status } = req.query;

    let queryText = `
      SELECT o.*, 
             COUNT(oi.id) as total_items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.user_id = $1
    `;

    const params: any[] = [userId];

    if (status) {
      queryText += ` AND o.status = $2`;
      params.push(status);
    }

    queryText += ` GROUP BY o.id ORDER BY o.created_at DESC`;

    const result = await query(queryText, params);

    res.json({
      message: 'Data pesanan berhasil diambil',
      data: result.rows,
    });
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Get order detail
export const getOrderDetail = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    let orderResult = await query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
    }

    let order = orderResult.rows[0];

    // Check and auto-expire if needed
    const wasExpired = await autoExpireOrder(order);
    if (wasExpired) {
      // Re-fetch order to get updated status
      orderResult = await query(
        'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      order = orderResult.rows[0];
    }

    const itemsResult = await query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [id]
    );

    res.json({
      message: 'Detail pesanan berhasil diambil',
      data: {
        ...order,
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    console.error('Get order detail error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Get payment info for an order
export const getPaymentInfo = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const orderResult = await query(
      'SELECT id, order_number, total, status, payment_status, created_at FROM orders WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
    }

    const order = orderResult.rows[0];

    // Check if order is cancelled
    if (order.status === 'cancelled') {
      return res.status(400).json({ message: 'Order telah dibatalkan' });
    }

    // Check if payment is expired
    if (order.payment_status === 'expired') {
      return res.status(400).json({ message: 'Waktu pembayaran telah habis' });
    }

    // Only return payment info for pending payments
    if (order.payment_status !== 'pending') {
      return res.status(400).json({
        message: 'Pembayaran sudah diproses',
        payment_status: order.payment_status
      });
    }

    const paymentInfo = getPaymentInstructions(
      order.total,
      order.order_number,
      order.created_at
    );

    res.json({
      message: 'Informasi pembayaran berhasil diambil',
      data: paymentInfo
    });
  } catch (error) {
    console.error('Get payment info error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Cancel order (customer)
export const cancelOrder = async (req: Request, res: Response) => {
  const client = await query('BEGIN');

  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const orderResult = await query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (orderResult.rows.length === 0) {
      await query('ROLLBACK');
      return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
    }

    const order = orderResult.rows[0];

    // Only pending orders can be cancelled
    if (order.status !== 'pending') {
      await query('ROLLBACK');
      return res.status(400).json({ 
        message: 'Hanya pesanan dengan status pending yang bisa dibatalkan' 
      });
    }

    // Restore product stock
    const items = await query(
      'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
      [id]
    );

    for (const item of items.rows) {
      await query(
        'UPDATE products SET stock = stock + $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    // Update order status
    await query(
      `UPDATE orders 
       SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    await query('COMMIT');

    res.json({ message: 'Pesanan berhasil dibatalkan' });
  } catch (error) {
    await query('ROLLBACK');
    console.error('Cancel order error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Admin: Get all orders
export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const { status, payment_status, search, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let queryText = `
      SELECT o.*, u.name as customer_name, u.email as customer_email,
             COUNT(oi.id) as total_items
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      queryText += ` AND o.status = $${paramCount}`;
      params.push(status);
    }

    if (payment_status) {
      paramCount++;
      queryText += ` AND o.payment_status = $${paramCount}`;
      params.push(payment_status);
    }

    if (search) {
      paramCount++;
      queryText += ` AND (o.order_number ILIKE $${paramCount} OR u.name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    queryText += ` GROUP BY o.id, u.name, u.email ORDER BY o.created_at DESC`;

    paramCount++;
    queryText += ` LIMIT $${paramCount}`;
    params.push(limit);

    paramCount++;
    queryText += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await query(queryText, params);

    res.json({
      message: 'Data pesanan berhasil diambil',
      data: result.rows,
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Admin: Get order detail
export const getOrderDetailAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const orderResult = await query(
      `SELECT o.*, u.name as customer_name, u.email as customer_email
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = $1`,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
    }

    const order = orderResult.rows[0];

    const itemsResult = await query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [id]
    );

    res.json({
      message: 'Detail pesanan berhasil diambil',
      data: {
        ...order,
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    console.error('Get order detail admin error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Admin: Update order status
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, payment_status, admin_notes } = req.body;

    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      updates.push(`status = $${paramCount}`);
      params.push(status);

      // Update timestamp based on status
      if (status === 'confirmed') {
        updates.push(`confirmed_at = CURRENT_TIMESTAMP`);
      } else if (status === 'shipped') {
        updates.push(`shipped_at = CURRENT_TIMESTAMP`);
      } else if (status === 'delivered') {
        updates.push(`delivered_at = CURRENT_TIMESTAMP`);
      } else if (status === 'cancelled') {
        updates.push(`cancelled_at = CURRENT_TIMESTAMP`);
      }
    }

    if (payment_status) {
      paramCount++;
      updates.push(`payment_status = $${paramCount}`);
      params.push(payment_status);

      if (payment_status === 'paid') {
        updates.push(`paid_at = CURRENT_TIMESTAMP`);
      }
    }

    if (admin_notes !== undefined) {
      paramCount++;
      updates.push(`admin_notes = $${paramCount}`);
      params.push(admin_notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'Tidak ada data yang diupdate' });
    }

    paramCount++;
    params.push(id);

    const result = await query(
      `UPDATE orders SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
    }

    res.json({
      message: 'Status pesanan berhasil diupdate',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};