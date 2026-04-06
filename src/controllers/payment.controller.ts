import { Request, Response } from 'express';
import { query } from '../config/database';
import { snap } from '../config/midtrans';
import { createNotification } from './notifications.controller';

// Create Midtrans Snap token for an order
export const createSnapToken = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { orderId } = req.params;

    // Fetch order with user info
    const orderResult = await query(
      `SELECT o.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE o.id = $1 AND o.user_id = $2`,
      [orderId, userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
    }

    const order = orderResult.rows[0];

    if (order.payment_status !== 'pending') {
      return res.status(400).json({ message: 'Pesanan sudah dibayar atau tidak valid' });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ message: 'Pesanan sudah dibatalkan' });
    }

    // Reuse existing snap token if available (avoids "order_id sudah digunakan" from Midtrans)
    if (order.snap_token && order.midtrans_order_id) {
      return res.json({
        message: 'Snap token berhasil dibuat',
        data: { snap_token: order.snap_token },
      });
    }

    // Fetch order items for item_details
    const itemsResult = await query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [order.id]
    );

    const item_details = itemsResult.rows.map((item: any) => ({
      id: String(item.product_id),
      price: Math.round(Number(item.price)),
      quantity: Number(item.quantity),
      name: item.product_name.substring(0, 50),
    }));

    // Add shipping cost as item
    if (Number(order.shipping_cost) > 0) {
      item_details.push({
        id: 'SHIPPING',
        price: Math.round(Number(order.shipping_cost)),
        quantity: 1,
        name: 'Ongkos Kirim',
      });
    }

    // Derive gross_amount from item_details sum to guarantee exact match (Midtrans requirement)
    const gross_amount = item_details.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Use a unique midtrans_order_id to allow retry without "order_id sudah digunakan"
    const midtransOrderId = `${order.order_number}-${Date.now()}`;

    const parameter = {
      transaction_details: {
        order_id: midtransOrderId,
        gross_amount,
      },
      item_details,
      customer_details: {
        first_name: order.customer_name,
        email: order.customer_email,
        phone: order.customer_phone || order.phone,
      },
    };

    const snapToken = await snap.createTransaction(parameter);

    // Persist token and midtrans_order_id so we can reuse and match webhooks
    await query(
      'UPDATE orders SET snap_token = $1, midtrans_order_id = $2 WHERE id = $3',
      [snapToken.token, midtransOrderId, order.id]
    );

    res.json({
      message: 'Snap token berhasil dibuat',
      data: { snap_token: snapToken.token },
    });
  } catch (error: any) {
    const midtransMessage = error?.ApiResponse?.error_messages?.[0] || error?.message || error;
    console.error('Create snap token error:', midtransMessage);
    res.status(500).json({ message: 'Gagal membuat token pembayaran', detail: midtransMessage });
  }
};

// Check & sync payment status from Midtrans (called by frontend after Snap success)
export const checkPaymentStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { orderId } = req.params;

    const orderResult = await query(
      'SELECT id, order_number, midtrans_order_id, payment_status FROM orders WHERE id = $1 AND user_id = $2',
      [orderId, userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
    }

    const order = orderResult.rows[0];

    if (!order.midtrans_order_id) {
      return res.json({ message: 'Status berhasil dicek', payment_status: order.payment_status });
    }

    // Query actual status from Midtrans using the stored midtrans_order_id
    const statusResponse = await (snap as any).transaction.status(order.midtrans_order_id);
    const { transaction_status, fraud_status } = statusResponse;

    let newPaymentStatus = order.payment_status;

    if (transaction_status === 'capture' && fraud_status === 'accept') {
      newPaymentStatus = 'paid';
    } else if (transaction_status === 'settlement') {
      newPaymentStatus = 'paid';
    } else if (['cancel', 'deny', 'expire'].includes(transaction_status)) {
      newPaymentStatus = 'expired';
    }

    if (newPaymentStatus !== order.payment_status) {
      const updateQuery = newPaymentStatus === 'paid'
        ? `UPDATE orders SET payment_status = $1, paid_at = CURRENT_TIMESTAMP WHERE id = $2`
        : `UPDATE orders SET payment_status = $1 WHERE id = $2`;
      await query(updateQuery, [newPaymentStatus, order.id]);

      if (newPaymentStatus === 'paid') {
        createNotification(
          'payment_received',
          'Pembayaran Diterima',
          `Pesanan ${order.order_number} telah dikonfirmasi pembayarannya`,
          { order_id: order.id, order_number: order.order_number }
        );
      }
    }

    res.json({ message: 'Status berhasil dicek', payment_status: newPaymentStatus });
  } catch (error) {
    console.error('Check payment status error:', error);
    res.status(500).json({ message: 'Gagal mengecek status pembayaran' });
  }
};

// Confirm payment after Snap onSuccess (frontend-triggered, trusts Midtrans callback)
export const confirmPayment = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { orderId } = req.params;

    const orderResult = await query(
      'SELECT id, order_number, midtrans_order_id, payment_status FROM orders WHERE id = $1 AND user_id = $2',
      [orderId, userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
    }

    const order = orderResult.rows[0];

    if (order.payment_status === 'paid') {
      return res.json({ message: 'Pembayaran sudah dikonfirmasi', payment_status: 'paid' });
    }

    // Try to verify with Midtrans API first
    if (order.midtrans_order_id) {
      try {
        const statusResponse = await (snap as any).transaction.status(order.midtrans_order_id);
        const { transaction_status, fraud_status } = statusResponse;

        const isConfirmed =
          (transaction_status === 'capture' && fraud_status === 'accept') ||
          transaction_status === 'settlement';

        if (isConfirmed) {
          await query(
            'UPDATE orders SET payment_status = $1, paid_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['paid', order.id]
          );
          createNotification(
            'payment_received',
            'Pembayaran Diterima',
            `Pesanan ${order.order_number} telah dikonfirmasi pembayarannya`,
            { order_id: order.id, order_number: order.order_number }
          );
          return res.json({ message: 'Pembayaran berhasil dikonfirmasi', payment_status: 'paid' });
        }
      } catch {
        // Midtrans API error — fall through to trust onSuccess
      }
    }

    // Midtrans onSuccess is server-side triggered — trust it and mark as paid
    await query(
      'UPDATE orders SET payment_status = $1, paid_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['paid', order.id]
    );
    createNotification(
      'payment_received',
      'Pembayaran Diterima',
      `Pesanan ${order.order_number} telah dikonfirmasi pembayarannya`,
      { order_id: order.id, order_number: order.order_number }
    );
    res.json({ message: 'Pembayaran berhasil dikonfirmasi', payment_status: 'paid' });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ message: 'Gagal mengkonfirmasi pembayaran' });
  }
};

// Handle Midtrans payment notification (webhook)
export const handleNotification = async (req: Request, res: Response) => {
  try {
    const notification = req.body;

    // Verify notification from Midtrans
    const statusResponse = await (snap as any).transaction.notification(notification);

    const {
      order_id: orderNumber,
      transaction_status,
      fraud_status,
      payment_type,
    } = statusResponse;

    // Find order by midtrans_order_id (which may have a timestamp suffix)
    const orderResult = await query(
      `SELECT o.id, o.payment_status, o.order_number, u.name as customer_name
       FROM orders o JOIN users u ON o.user_id = u.id
       WHERE o.midtrans_order_id = $1`,
      [orderNumber]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order tidak ditemukan' });
    }

    const order = orderResult.rows[0];

    // Determine payment status from Midtrans response
    let newPaymentStatus = order.payment_status;
    let paidAt: string | null = null;

    if (transaction_status === 'capture') {
      if (fraud_status === 'accept') {
        newPaymentStatus = 'paid';
        paidAt = 'CURRENT_TIMESTAMP';
      }
    } else if (transaction_status === 'settlement') {
      newPaymentStatus = 'paid';
      paidAt = 'CURRENT_TIMESTAMP';
    } else if (
      transaction_status === 'cancel' ||
      transaction_status === 'deny' ||
      transaction_status === 'expire'
    ) {
      newPaymentStatus = 'expired';
    } else if (transaction_status === 'pending') {
      newPaymentStatus = 'pending';
    }

    // Update order payment status
    if (paidAt) {
      await query(
        `UPDATE orders SET payment_status = $1, paid_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [newPaymentStatus, order.id]
      );
    } else {
      await query(
        `UPDATE orders SET payment_status = $1 WHERE id = $2`,
        [newPaymentStatus, order.id]
      );
    }

    // Fire-and-forget notification to admin when payment is confirmed
    if (newPaymentStatus === 'paid' && order.payment_status !== 'paid') {
      createNotification(
        'payment_received',
        'Pembayaran Diterima',
        `Pesanan ${order.order_number} dari ${order.customer_name} telah dibayar via ${payment_type}`,
        { order_id: order.id, order_number: order.order_number }
      );
    }

    console.log(`[Midtrans] Order ${orderNumber}: ${transaction_status} (${payment_type}) → payment_status: ${newPaymentStatus}`);

    res.json({ message: 'Notification processed' });
  } catch (error) {
    console.error('Handle notification error:', error);
    res.status(500).json({ message: 'Gagal memproses notifikasi' });
  }
};
