import { Request, Response } from 'express';
import { query } from '../config/database';

// Keys that are safe to expose publicly (customer-facing)
const PUBLIC_KEYS = ['qris_image_url'] as const;

// GET /settings/payment — public; returns payment-related settings (QRIS image)
export const getPaymentSettings = async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT key, value FROM settings WHERE key = ANY($1::text[])`,
      [PUBLIC_KEYS as unknown as string[]]
    );

    const settings: Record<string, string | null> = { qris_image_url: null };
    result.rows.forEach((row: any) => {
      settings[row.key] = row.value;
    });

    res.json({
      message: 'Pengaturan pembayaran berhasil diambil',
      data: settings,
    });
  } catch (error) {
    console.error('Get payment settings error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// PUT /settings/payment — admin; upsert the QRIS image URL
export const updatePaymentSettings = async (req: Request, res: Response) => {
  try {
    const { qris_image_url } = req.body;

    if (qris_image_url === undefined) {
      return res.status(400).json({ message: 'qris_image_url wajib diisi' });
    }

    await query(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ('qris_image_url', $1, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
      [qris_image_url || null]
    );

    res.json({
      message: 'Pengaturan pembayaran berhasil disimpan',
      data: { qris_image_url: qris_image_url || null },
    });
  } catch (error) {
    console.error('Update payment settings error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};
