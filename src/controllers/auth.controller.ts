import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../config/database';
import { sendOTPEmail, sendPasswordResetEmail } from '../config/email';

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone } = req.body;

    // Validasi input
    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        message: 'Nama, email, password, dan nomor telepon wajib diisi'
      });
    }

    // Validasi password
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password minimal 8 karakter' });
    }

    // Validasi nomor telepon
    if (!phone || phone.toString().trim().length < 10) {
      return res.status(400).json({
        message: 'Nomor telepon tidak valid (minimal 10 digit)'
      });
    }

    // Check apakah email sudah terdaftar
    const existingUser = await query(
      'SELECT id, is_verified FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      // If user exists but not verified, allow re-registration (update data)
      if (!existingUser.rows[0].is_verified) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await query(
          `UPDATE users SET name = $1, password = $2, phone = $3 WHERE email = $4`,
          [name, hashedPassword, phone, email]
        );

        // Generate and send OTP
        const otpCode = crypto.randomInt(100000, 999999).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await query(
          'UPDATE otp_verifications SET is_used = TRUE WHERE email = $1 AND is_used = FALSE',
          [email]
        );
        await query(
          `INSERT INTO otp_verifications (email, otp_code, expires_at) VALUES ($1, $2, $3)`,
          [email, otpCode, expiresAt]
        );

        // Respond immediately, send email in background
        res.status(201).json({
          message: 'Kode OTP telah dikirim ke email Anda',
          data: { email, requiresVerification: true },
        });

        console.log(`📧 OTP Code for ${email}: ${otpCode}`);
        sendOTPEmail(email, otpCode).catch((emailErr: any) => {
          console.error(`❌ Failed to send OTP email to ${email}:`, emailErr.message);
        });
        return;
      }

      return res.status(400).json({
        message: 'Email sudah terdaftar'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user baru (unverified)
    await query(
      `INSERT INTO users (name, email, password, phone, role, is_verified)
       VALUES ($1, $2, $3, $4, 'customer', FALSE)`,
      [name, email, hashedPassword, phone]
    );

    // Generate and send OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await query(
      `INSERT INTO otp_verifications (email, otp_code, expires_at) VALUES ($1, $2, $3)`,
      [email, otpCode, expiresAt]
    );

    // Respond immediately, send email in background
    res.status(201).json({
      message: 'Kode OTP telah dikirim ke email Anda',
      data: { email, requiresVerification: true },
    });

    console.log(`📧 OTP Code for ${email}: ${otpCode}`);
    sendOTPEmail(email, otpCode).catch((emailErr: any) => {
      console.error(`❌ Failed to send OTP email to ${email}:`, emailErr.message);
    });
  } catch (error: any) {
    console.error('Register error:', error.message, error.stack);
    res.status(500).json({
      message: 'Terjadi kesalahan server',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email dan password wajib diisi'
      });
    }

    const result = await query(
      'SELECT id, name, email, phone, role, password, is_verified FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    const user = result.rows[0];

    if (!user.is_verified) {
      return res.status(403).json({
        message: 'Email belum diverifikasi. Silakan verifikasi email Anda terlebih dahulu.',
        code: 'EMAIL_NOT_VERIFIED',
        data: { email: user.email, requiresVerification: true },
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET as string,
      { algorithm: 'HS256', expiresIn: (process.env.JWT_EXPIRES_IN || '1d') as jwt.SignOptions['expiresIn'] }
    );

    res.json({
      message: 'Login berhasil',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email wajib diisi' });
    }

    const userResult = await query(
      'SELECT id FROM users WHERE email = $1 AND is_verified = TRUE',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Email tidak terdaftar' });
    }

    // Rate limit: reject if OTP sent within last minute
    const recentOTP = await query(
      `SELECT id FROM otp_verifications
       WHERE email = $1 AND created_at > NOW() - INTERVAL '1 minute' AND is_used = FALSE`,
      [email]
    );
    if (recentOTP.rows.length > 0) {
      return res.status(429).json({ message: 'Mohon tunggu 1 menit sebelum mengirim ulang kode' });
    }

    // Invalidate previous reset OTPs
    await query(
      "UPDATE otp_verifications SET is_used = TRUE WHERE email = $1 AND is_used = FALSE",
      [email]
    );

    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await query(
      'INSERT INTO otp_verifications (email, otp_code, expires_at) VALUES ($1, $2, $3)',
      [email, otpCode, expiresAt]
    );

    res.json({ message: 'Kode verifikasi telah dikirim ke email Anda' });

    sendPasswordResetEmail(email, otpCode).catch((err: any) => {
      console.error(`❌ Failed to send reset email to ${email}:`, err.message);
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, kode OTP, dan password baru wajib diisi' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password minimal 8 karakter' });
    }

    // Verify OTP
    const otpResult = await query(
      `SELECT id FROM otp_verifications
       WHERE email = $1 AND otp_code = $2 AND is_used = FALSE AND expires_at > NOW()`,
      [email, otp]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({ message: 'Kode OTP tidak valid atau sudah kedaluwarsa' });
    }

    // Mark OTP as used
    await query('UPDATE otp_verifications SET is_used = TRUE WHERE id = $1', [otpResult.rows[0].id]);

    const userResult = await query(
      'SELECT id FROM users WHERE email = $1 AND is_verified = TRUE',
      [email]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Email tidak ditemukan' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password = $1 WHERE email = $2', [hashedPassword, email]);

    res.json({ message: 'Password berhasil direset. Silakan login dengan password baru.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    const result = await query(
      'SELECT id, name, email, phone, role, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    res.json({
      message: 'Data profile berhasil diambil',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};