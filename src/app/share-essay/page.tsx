import { headers } from 'next/headers';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import ShareEssayClient from './ShareEssayClient';

type PageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ShareEssayPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') || 'unknown';

  // ── 1. Token tidak ada ──────────────────────────────────────────────────
  if (!token) {
    return <ErrorPage message="Link tidak valid! Token tidak ditemukan." />;
  }

  // ── 2. Cek token di database ────────────────────────────────────────────
  // Tidak filter token_type karena kolom ini mungkin belum ada di DB
  const { data: tokenData, error } = await supabase
    .from('share_tokens')
    .select('*, matkul:matkul_id(nama_matkul, pdf_url)')
    .eq('token', token)
    .single();

  if (error || !tokenData) {
    return <ErrorPage message="Link tidak valid! Token tidak ditemukan di database." />;
  }

  // ── 3. Pastikan token ini punya pdf_url (penanda token essay) ───────────
  const matkul = tokenData.matkul as { nama_matkul: string; pdf_url: string | null } | null;
  if (!matkul?.pdf_url) {
    return <ErrorPage message="PDF belum diupload untuk mata kuliah ini. Hubungi Riki." />;
  }

  // ── 4. First time buka → kunci ke User-Agent browser ini ───────────────
  if (!tokenData.is_used) {
    await supabase
      .from('share_tokens')
      .update({ is_used: true, saved_device_agent: userAgent })
      .eq('id', tokenData.id);

  } else {
    // ── 5. Sudah terkunci → cocokkan User-Agent ───────────────────────────
    if (tokenData.saved_device_agent !== userAgent) {
      return (
        <ErrorPage
          message="Akses Ditolak! Link ini sudah terkunci pada browser lain. Hubungi Riki untuk membuka blokir."
          locked
        />
      );
    }
  }

  // ── 6. Lolos → render PDF viewer ───────────────────────────────────────
  return (
    <ShareEssayClient
      pdfUrl={matkul.pdf_url}
      matkulNama={matkul.nama_matkul}
      penerimaName={tokenData.penerima_nama}
    />
  );
}

// ── Error Page ──────────────────────────────────────────────────────────────
function ErrorPage({ message, locked = false }: { message: string; locked?: boolean }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#0f0f13',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center', padding: '2rem', maxWidth: 480 }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>{locked ? '🔒' : '❌'}</div>
        <h1 style={{ color: locked ? '#ff5c5c' : '#ffb347', fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          {locked ? 'Akses Ditolak' : 'Link Tidak Valid'}
        </h1>
        <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: 1.6 }}>{message}</p>
      </div>
    </div>
  );
}
