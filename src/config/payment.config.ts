// src/config/payment.config.ts
import dotenv from 'dotenv';

dotenv.config();

const MINIO_PUBLIC_ENDPOINT = process.env.MINIO_PUBLIC_ENDPOINT || process.env.MINIO_PRIVATE_ENDPOINT || 'http://localhost:9000';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'alfath-skin';

export const paymentConfig = {
  qris: {
    merchantName: 'Alfath Skin',
    imageUrl: `${MINIO_PUBLIC_ENDPOINT}/${MINIO_BUCKET}/qris-code.png`,
    instructions: [
      'Buka aplikasi e-wallet atau mobile banking Anda',
      'Pilih menu Scan QR atau QRIS',
      'Scan kode QR di bawah ini',
      'Pastikan nominal sesuai total pesanan',
      'Konfirmasi dan selesaikan pembayaran'
    ],
    expirationHours: 24
  }
};

export const getPaymentDeadline = (createdAt: Date | string): Date => {
  const created = new Date(createdAt);
  return new Date(created.getTime() + paymentConfig.qris.expirationHours * 60 * 60 * 1000);
};

export const getPaymentInstructions = (orderTotal: number, orderNumber: string, createdAt: Date | string) => {
  const deadline = getPaymentDeadline(createdAt);

  return {
    method: 'qris' as const,
    merchant_name: paymentConfig.qris.merchantName,
    qris_image_url: paymentConfig.qris.imageUrl,
    instructions: paymentConfig.qris.instructions,
    total_amount: orderTotal,
    order_number: orderNumber,
    deadline: deadline.toISOString(),
    expiration_hours: paymentConfig.qris.expirationHours
  };
};
