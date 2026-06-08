import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Variabel global sementara untuk penyimpanan OTP di server
declare global {
  var adminOtpCache: { code: string | null; expiresAt: number | null };
}
global.adminOtpCache = global.adminOtpCache || { code: null, expiresAt: null };

export async function POST() {
  try {
    // 1. Generate 6 digit OTP acak
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // Aktif 5 menit

    global.adminOtpCache = { code: otpCode, expiresAt };

    // 2. Konfigurasi transport Nodemailer via SMTP Gmail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // 3. Konten email OTP
    const mailOptions = {
      from: `"Quizizz System Gatekeeper" <${process.env.SMTP_USER}>`,
      to: process.env.ADMIN_RECEIVER_EMAIL,
      subject: '🔑 KODE OTP AKSES DASHBOARD ADMIN',
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; max-width: 500px; margin: auto;">
          <h2 style="color: #4f46e5; text-align: center;">Verifikasi Keamanan Admin</h2>
          <p>Seseorang mencoba masuk ke Dashboard Utama Admin. Jika itu Anda, gunakan kode OTP di bawah ini untuk membuka akses:</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #1f2937; margin: 20px 0;">
            ${otpCode}
          </div>
          <p style="color: #ef4444; font-size: 12px; text-align: center;">*Kode ini hanya berlaku selama 5 menit.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true, message: 'OTP berhasil dikirim ke email.' });

  } catch (error: unknown) {
    console.error('Gagal Kirim OTP:', error);
    return NextResponse.json({ error: 'Gagal memproses pengiriman email OTP.' }, { status: 500 });
  }
}
