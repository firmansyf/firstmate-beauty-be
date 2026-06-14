import { Request, Response } from 'express';
import multer from 'multer';
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  getPublicIdFromUrl,
} from '../config/cloudinary';

// Use memory storage - files are streamed to Cloudinary, not written to disk
const storage = multer.memoryStorage();

// File filter - only allow images
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Hanya file gambar yang diperbolehkan (JPEG, PNG, GIF, WebP)'));
  }
};

// Configure multer upload (memory storage for Cloudinary)
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

// Upload single product image to Cloudinary
export const uploadProductImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Tidak ada file yang diupload' });
    }

    const { url, publicId } = await uploadToCloudinary(
      req.file.buffer,
      req.file.mimetype,
      'products'
    );

    res.json({
      message: 'Gambar berhasil diupload',
      data: {
        filename: publicId,
        url,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Gagal mengupload gambar' });
  }
};

// Upload a QRIS payment proof to Cloudinary (any authenticated user)
export const uploadPaymentProof = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Tidak ada file yang diupload' });
    }

    const { url, publicId } = await uploadToCloudinary(
      req.file.buffer,
      req.file.mimetype,
      'payment-proofs'
    );

    res.json({
      message: 'Bukti pembayaran berhasil diupload',
      data: {
        filename: publicId,
        url,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (error) {
    console.error('Upload payment proof error:', error);
    res.status(500).json({ message: 'Gagal mengupload bukti pembayaran' });
  }
};

// Delete product image from Cloudinary
export const deleteProductImage = async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;

    if (!filename) {
      return res.status(400).json({ message: 'Nama file tidak diberikan' });
    }

    // Accept either a Cloudinary public_id or a full delivery URL
    const publicId = filename.startsWith('http')
      ? getPublicIdFromUrl(filename)
      : decodeURIComponent(filename);

    if (!publicId) {
      return res.status(400).json({ message: 'public_id tidak valid' });
    }

    await deleteFromCloudinary(publicId);

    res.json({ message: 'Gambar berhasil dihapus' });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ message: 'Gagal menghapus gambar' });
  }
};
