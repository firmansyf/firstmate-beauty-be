import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export const sendOTPEmail = async (email: string, otpCode: string): Promise<void> => {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailAppPassword) {
    throw new Error('GMAIL_USER or GMAIL_APP_PASSWORD environment variable is not set');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });

  const from = process.env.SMTP_FROM || gmailUser;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #db2777; font-size: 24px; margin: 0;">Alfath Skin</h1>
      </div>
      <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; text-align: center;">
        <h2 style="color: #111827; font-size: 18px; margin: 0 0 8px;">Verifikasi Email Anda</h2>
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">
          Masukkan kode OTP berikut untuk menyelesaikan registrasi:
        </p>
        <div style="background: #fdf2f8; border: 2px dashed #db2777; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #db2777;">${otpCode}</span>
        </div>
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          Kode ini berlaku selama <strong>5 menit</strong>.<br/>
          Jangan bagikan kode ini kepada siapapun.
        </p>
      </div>
      <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 24px;">
        Jika Anda tidak mendaftar di Alfath Skin, abaikan email ini.
      </p>
    </div>
  `;

  console.log(`📧 Sending OTP to ${email} via Gmail...`);

  await transporter.sendMail({
    from: `Alfath Skin <${from}>`,
    to: email,
    subject: 'Kode Verifikasi OTP - Al-fath Skin',
    html,
  });

  console.log(`✅ OTP email sent to ${email}`);
};
