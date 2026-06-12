import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OTP_COOLDOWN_MS = 60 * 1000; // 60 detik cooldown
const OTP_DAILY_LIMIT = 2;         // maksimal 2x kirim per hari

/** Hitung timestamp awal hari berikutnya (midnight WIB = UTC+7) */
function nextMidnightWIB(): number {
  const now = new Date();
  const wibOffset = 7 * 60 * 60 * 1000;
  const wibNow = new Date(now.getTime() + wibOffset);
  const nextMidnight = new Date(Date.UTC(
    wibNow.getUTCFullYear(),
    wibNow.getUTCMonth(),
    wibNow.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return nextMidnight.getTime() - wibOffset;
}

export async function POST() {
  try {
    const now = Date.now();

    // Ambil state dari Supabase (1 baris, id = 1)
    const { data: stateRow, error: fetchError } = await supabaseAdmin
      .from('otp_state')
      .select('*')
      .eq('id', 1)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = row not found (belum ada baris, akan dibuat di bawah)
      console.error('Gagal baca otp_state:', fetchError);
      return NextResponse.json({ error: 'Gagal membaca state OTP.' }, { status: 500 });
    }

    // Gunakan nilai default jika baris belum ada
    let daily_count: number = stateRow?.daily_count ?? 0;
    let daily_reset_at: number | null = stateRow?.daily_reset_at ?? null;
    const last_sent_at: number | null = stateRow?.last_sent_at ?? null;

    // Reset kuota harian jika sudah melewati waktu reset
    if (daily_reset_at && now >= daily_reset_at) {
      daily_count = 0;
      daily_reset_at = null;
    }

    // Cek kuota harian
    if (daily_count >= OTP_DAILY_LIMIT) {
      const resetAt = daily_reset_at ?? nextMidnightWIB();
      const sisaMs = resetAt - now;
      const sisaJam = Math.floor(sisaMs / (1000 * 60 * 60));
      const sisaMenit = Math.floor((sisaMs % (1000 * 60 * 60)) / (1000 * 60));
      return NextResponse.json(
        {
          error: `Kuota harian OTP habis. Coba lagi dalam ${sisaJam}j ${sisaMenit}m.`,
          type: 'daily_limit',
          resetAt,
        },
        { status: 429 }
      );
    }

    // Cek cooldown 60 detik
    if (last_sent_at && now - last_sent_at < OTP_COOLDOWN_MS) {
      const sisaDetik = Math.ceil((OTP_COOLDOWN_MS - (now - last_sent_at)) / 1000);
      return NextResponse.json(
        { error: `Tunggu ${sisaDetik} detik sebelum meminta OTP baru.`, type: 'cooldown', cooldownRemaining: sisaDetik },
        { status: 429 }
      );
    }

    // Generate 6 digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = now + 5 * 60 * 1000; // aktif 5 menit
    const newCount = daily_count + 1;
    const newResetAt = daily_reset_at ?? nextMidnightWIB();

    // Simpan ke Supabase (upsert 1 baris)
    const { error: upsertError } = await supabaseAdmin
      .from('otp_state')
      .upsert({
        id: 1,
        code: otpCode,
        expires_at: expiresAt,
        last_sent_at: now,
        daily_count: newCount,
        daily_reset_at: newResetAt,
      });

    if (upsertError) {
      console.error('Gagal simpan otp_state:', upsertError);
      return NextResponse.json({ error: 'Gagal menyimpan state OTP.' }, { status: 500 });
    }

    // Kirim email via Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const sisaKuota = OTP_DAILY_LIMIT - newCount;
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
          <p style="color: #6b7280; font-size: 11px; text-align: center;">Sisa kuota OTP hari ini: ${sisaKuota} kali</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return NextResponse.json({
      success: true,
      message: 'OTP berhasil dikirim ke email.',
      remainingQuota: sisaKuota,
    });

  } catch (error: unknown) {
    console.error('Gagal Kirim OTP:', error);
    return NextResponse.json({ error: 'Gagal memproses pengiriman email OTP.' }, { status: 500 });
  }
}
