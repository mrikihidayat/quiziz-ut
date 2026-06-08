import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

declare global {
  var adminOtpCache: { code: string | null; expiresAt: number | null };
}

export async function POST(request: Request) {
  try {
    const { otp_input } = await request.json();
    const cache = global.adminOtpCache;

    if (!otp_input || !cache || !cache.code) {
      return NextResponse.json({ error: 'Permintaan OTP tidak valid.' }, { status: 400 });
    }

    // 1. Cek kedaluwarsa
    if (Date.now() > (cache.expiresAt ?? 0)) {
      return NextResponse.json({ error: 'Kode OTP sudah kedaluwarsa. Silakan minta kode baru.' }, { status: 400 });
    }

    // 2. Validasi kode
    if (otp_input !== cache.code) {
      return NextResponse.json({ error: 'Kode OTP yang Anda masukkan salah.' }, { status: 400 });
    }

    // 3. Bersihkan cache setelah berhasil
    global.adminOtpCache = { code: null, expiresAt: null };

    // 4. Generate JWT token (aktif 7 hari)
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET as string, { expiresIn: '7d' });

    return NextResponse.json({ success: true, token });

  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada verifikasi internal.' }, { status: 500 });
  }
}
