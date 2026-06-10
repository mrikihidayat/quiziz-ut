import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// POST: Generate token essay baru
export async function POST(req: NextRequest) {
  try {
    const { matkul_id, penerima_nama } = await req.json();

    if (!matkul_id || !penerima_nama?.trim()) {
      return NextResponse.json({ error: 'matkul_id dan penerima_nama wajib diisi.' }, { status: 400 });
    }

    // Ambil pdf_url dari matkul untuk validasi
    const { data: matkul, error: matkulError } = await supabaseAdmin
      .from('matkul')
      .select('pdf_url')
      .eq('id', matkul_id)
      .single();

    if (matkulError || !matkul?.pdf_url) {
      return NextResponse.json({ error: 'PDF belum diupload untuk mata kuliah ini.' }, { status: 400 });
    }

    // Gunakan tabel share_tokens yang sama, tapi kita tandai tipe essay
    const { data, error } = await supabaseAdmin
      .from('share_tokens')
      .insert([{ matkul_id, penerima_nama: penerima_nama.trim(), token_type: 'essay' }])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ token: data.token });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// GET: Ambil semua token essay (dengan JOIN nama matkul)
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('share_tokens')
      .select(`
        id,
        token,
        penerima_nama,
        is_used,
        saved_device_agent,
        created_at,
        matkul:matkul_id ( nama_matkul, pdf_url )
      `)
      .eq('token_type', 'essay')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ tokens: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// PATCH: Reset perangkat
export async function PATCH(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id wajib diisi.' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('share_tokens')
      .update({ saved_device_agent: null, is_used: false })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// DELETE: Hapus token
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id wajib diisi.' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('share_tokens')
      .delete()
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
