import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export const sendOTPEmail = async (email: string, otpCode: string): Promise<void> => {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.SMTP_FROM || 'noreply@firstmate-beauty.com';

  if (!apiKey) {
    throw new Error('BREVO_API_KEY environment variable is not set');
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #db2777; font-size: 24px; margin: 0;">FirstMate Beauty</h1>
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
        Jika Anda tidak mendaftar di FirstMate Beauty, abaikan email ini.
      </p>
    </div>
  `;

  console.log(`📧 Sending OTP to ${email} via Brevo API...`);

  await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    {
      sender: { name: 'FirstMate Beauty', email: from },
      to: [{ email }],
      subject: 'Kode Verifikasi OTP - FirstMate Beauty',
      htmlContent: html,
    },
    {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
    }
  );

  console.log(`✅ OTP email sent to ${email}`);
};

export const sendPasswordResetEmail = async (email: string, otpCode: string): Promise<void> => {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.SMTP_FROM || 'noreply@alfath-skin.com';

  if (!apiKey) {
    throw new Error('BREVO_API_KEY environment variable is not set');
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #db2777; font-size: 24px; margin: 0;">FirstMate Beauty</h1>
      </div>
      <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; text-align: center;">
        <h2 style="color: #111827; font-size: 18px; margin: 0 0 8px;">Reset Password</h2>
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">
          Masukkan kode OTP berikut untuk mereset password Anda:
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
        Jika Anda tidak meminta reset password, abaikan email ini.
      </p>
    </div>
  `;

  console.log(`📧 Sending password reset OTP to ${email} via Brevo API...`);

  await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    {
      sender: { name: 'FirstMate Beauty', email: from },
      to: [{ email }],
      subject: 'Reset Password - FirstMate Beauty',
      htmlContent: html,
    },
    {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
    }
  );

  console.log(`✅ Password reset email sent to ${email}`);
};
