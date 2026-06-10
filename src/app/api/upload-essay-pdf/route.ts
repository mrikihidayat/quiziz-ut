import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const matkulId = formData.get('matkul_id') as string;
    const file = formData.get('file') as File;

    if (!matkulId) {
      return NextResponse.json({ error: 'Mata Kuliah belum dipilih.' }, { status: 400 });
    }
    if (!file || file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File PDF tidak valid.' }, { status: 400 });
    }

    // ─── Upload ke Supabase Storage ────────────────────────────────────────
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = `${matkulId}_${Date.now()}.pdf`;
    const storagePath = `essay-pdf/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('essay-pdf')
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase Storage error:', uploadError);
      return NextResponse.json({ error: 'Gagal upload ke Supabase Storage: ' + uploadError.message }, { status: 502 });
    }

    // ─── Ambil public URL ──────────────────────────────────────────────────
    const { data: urlData } = supabase.storage
      .from('essay-pdf')
      .getPublicUrl(storagePath);

    const pdfUrl = urlData.publicUrl;

    // ─── Simpan URL ke kolom pdf_url di tabel matkul ───────────────────────
    const { error: dbError } = await supabase
      .from('matkul')
      .update({ pdf_url: pdfUrl })
      .eq('id', matkulId);

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, pdf_url: pdfUrl });
  } catch (error: any) {
    console.error('Error upload-essay-pdf:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan sistem.' }, { status: 500 });
  }
}
