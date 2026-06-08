import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// POST: Generate token baru
export async function POST(req: NextRequest) {
  try {
    const { matkul_id, penerima_nama } = await req.json();

    if (!matkul_id || !penerima_nama?.trim()) {
      return NextResponse.json({ error: 'matkul_id dan penerima_nama wajib diisi.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('share_tokens')
      .insert([{ matkul_id, penerima_nama: penerima_nama.trim() }])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ token: data.token });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// GET: Ambil semua token (dengan JOIN nama matkul)
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
        matkul:matkul_id ( nama_matkul )
      `)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ tokens: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// PATCH: Reset perangkat (buka blokir)
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

// DELETE: Hapus token permanen
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
