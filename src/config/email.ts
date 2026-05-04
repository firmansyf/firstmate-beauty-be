import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

interface OtpEmailParams {
  title: string;
  intro: string;
  otpCode: string;
  footer: string;
}

const buildOtpEmail = ({ title, intro, otpCode, footer }: OtpEmailParams): string => `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
<title>${title}</title>
<style>
  body { margin: 0; padding: 0; width: 100% !important; background: #f9fafb; }
  table { border-collapse: collapse; }
  img { border: 0; line-height: 100%; outline: none; text-decoration: none; }
  .otp-code { font-size: 32px; letter-spacing: 8px; }
  @media only screen and (max-width: 480px) {
    .container { width: 100% !important; padding: 16px !important; }
    .card { padding: 24px 16px !important; border-radius: 10px !important; }
    .brand { font-size: 22px !important; }
    .title { font-size: 17px !important; }
    .intro { font-size: 13px !important; }
    .otp-box { padding: 14px 8px !important; }
    .otp-code { font-size: 26px !important; letter-spacing: 6px !important; }
    .note { font-size: 12px !important; }
    .legal { font-size: 11px !important; padding: 0 8px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" class="container" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:20px;">
              <span class="brand" style="color:#db2777;font-size:24px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">FirstMate Beauty</span>
            </td>
          </tr>
          <tr>
            <td class="card" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px 24px;text-align:center;">
              <h2 class="title" style="color:#111827;font-size:18px;margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;">${title}</h2>
              <p class="intro" style="color:#6b7280;font-size:14px;line-height:1.5;margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;">${intro}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td class="otp-box" align="center" style="background:#fdf2f8;border:2px dashed #db2777;border-radius:8px;padding:16px;">
                    <span class="otp-code" style="font-weight:bold;color:#db2777;font-family:Arial,Helvetica,sans-serif;">${otpCode}</span>
                  </td>
                </tr>
              </table>
              <p class="note" style="color:#9ca3af;font-size:12px;line-height:1.5;margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;">
                Kode ini berlaku selama <strong>5 menit</strong>.<br/>
                Jangan bagikan kode ini kepada siapapun.
              </p>
            </td>
          </tr>
          <tr>
            <td class="legal" align="center" style="color:#9ca3af;font-size:11px;line-height:1.5;padding:20px 12px 0;font-family:Arial,Helvetica,sans-serif;">
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export const sendOTPEmail = async (email: string, otpCode: string): Promise<void> => {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.SMTP_FROM || 'noreply@firstmate-beauty.com';

  if (!apiKey) {
    throw new Error('BREVO_API_KEY environment variable is not set');
  }

  const html = buildOtpEmail({
    title: 'Verifikasi Email Anda',
    intro: 'Masukkan kode OTP berikut untuk menyelesaikan registrasi:',
    otpCode,
    footer: 'Jika Anda tidak mendaftar di FirstMate Beauty, abaikan email ini.',
  });

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

  const html = buildOtpEmail({
    title: 'Reset Password',
    intro: 'Masukkan kode OTP berikut untuk mereset password Anda:',
    otpCode,
    footer: 'Jika Anda tidak meminta reset password, abaikan email ini.',
  });

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
