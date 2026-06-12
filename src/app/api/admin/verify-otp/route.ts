import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { otp_input } = await request.json();

    if (!otp_input) {
      return NextResponse.json({ error: 'Permintaan OTP tidak valid.' }, { status: 400 });
    }

    // Ambil state dari Supabase
    const { data: stateRow, error: fetchError } = await supabaseAdmin
      .from('otp_state')
      .select('code, expires_at')
      .eq('id', 1)
      .single();

    if (fetchError || !stateRow || !stateRow.code) {
      return NextResponse.json({ error: 'Permintaan OTP tidak valid.' }, { status: 400 });
    }

    // Cek kedaluwarsa
    if (Date.now() > (stateRow.expires_at ?? 0)) {
      return NextResponse.json({ error: 'Kode OTP sudah kedaluwarsa. Silakan minta kode baru.' }, { status: 400 });
    }

    // Validasi kode
    if (otp_input !== stateRow.code) {
      return NextResponse.json({ error: 'Kode OTP yang Anda masukkan salah.' }, { status: 400 });
    }

    // Hapus kode setelah berhasil (set null, biarkan rate limit fields tetap)
    await supabaseAdmin
      .from('otp_state')
      .update({ code: null, expires_at: null })
      .eq('id', 1);

    // Generate JWT token (aktif 7 hari)
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET as string, { expiresIn: '7d' });

    return NextResponse.json({ success: true, token });

  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada verifikasi internal.' }, { status: 500 });
  }
}
