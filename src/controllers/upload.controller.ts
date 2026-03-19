import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure uploads directories exist
const uploadsDir = path.join(__dirname, '../../uploads/products');
const uploadsRootDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(uploadsRootDir)) {
  fs.mkdirSync(uploadsRootDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-randomstring.extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `product-${uniqueSuffix}${ext}`);
  },
});

// File filter - only allow images
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Hanya file gambar yang diperbolehkan (JPEG, PNG, GIF, WebP)'));
  }
};

// Configure multer upload
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

// Upload single image
export const uploadProductImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Tidak ada file yang diupload' });
    }

    // Generate the URL for the uploaded file
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    const imageUrl = `${baseUrl}/uploads/products/${req.file.filename}`;

    res.json({
      message: 'Gambar berhasil diupload',
      data: {
        filename: req.file.filename,
        url: imageUrl,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Gagal mengupload gambar' });
  }
};

// Delete image
export const deleteProductImage = async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;

    if (!filename) {
      return res.status(400).json({ message: 'Nama file tidak diberikan' });
    }

    const filePath = path.join(uploadsDir, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File tidak ditemukan' });
    }

    // Delete file
    fs.unlinkSync(filePath);

    res.json({ message: 'Gambar berhasil dihapus' });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ message: 'Gagal menghapus gambar' });
  }
};

// QRIS Image Storage Configuration
const qrisStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsRootDir);
  },
  filename: (req, file, cb) => {
    // Always use qris-code.png as filename
    cb(null, 'qris-code.png');
  },
});

export const uploadQris = multer({
  storage: qrisStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

// Upload QRIS image
export const uploadQrisImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Tidak ada file yang diupload' });
    }

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    const imageUrl = `${baseUrl}/uploads/qris-code.png`;

    res.json({
      message: 'QRIS berhasil diupload',
      data: {
        filename: 'qris-code.png',
        url: imageUrl,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (error) {
    console.error('Upload QRIS error:', error);
    res.status(500).json({ message: 'Gagal mengupload QRIS' });
  }
};

// Delete QRIS image
export const deleteQrisImage = async (req: Request, res: Response) => {
  try {
    const filePath = path.join(uploadsRootDir, 'qris-code.png');

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'QRIS tidak ditemukan' });
    }

    // Delete file
    fs.unlinkSync(filePath);

    res.json({ message: 'QRIS berhasil dihapus' });
  } catch (error) {
    console.error('Delete QRIS error:', error);
    res.status(500).json({ message: 'Gagal menghapus QRIS' });
  }
};
