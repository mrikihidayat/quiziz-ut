import { headers } from 'next/headers';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import ShareTestClient from './ShareTestClient';

type PageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ShareTestPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') || 'unknown';

  // ── 1. Token tidak ada di URL ──
  if (!token) {
    return <ErrorPage message="Link tidak valid! Token tidak ditemukan." />;
  }

  // ── 2. Cek token di database ──
  const { data: tokenData, error } = await supabase
    .from('share_tokens')
    .select('*, matkul:matkul_id(nama_matkul)')
    .eq('token', token)
    .single();

  if (error || !tokenData) {
    return <ErrorPage message="Link tidak valid! Token tidak ditemukan di database." />;
  }

  // ── 3. Token belum pernah dipakai → kunci perangkat sekarang ──
  if (!tokenData.is_used) {
    await supabase
      .from('share_tokens')
      .update({ is_used: true, saved_device_agent: userAgent })
      .eq('id', tokenData.id);
  } else {
    // ── 4. Token sudah terkunci → cocokkan User-Agent ──
    if (tokenData.saved_device_agent !== userAgent) {
      return (
        <ErrorPage message="Akses Ditolak! Link ini sudah terkunci pada perangkat lain. Hubungi Riki untuk membuka blokir." locked />
      );
    }
  }

  // ── 5. Lolos validasi → ambil soal ──
  const { data: soalData } = await supabase
    .from('soal')
    .select('id, pertanyaan, pilihan_a, pilihan_b, pilihan_c, pilihan_d, jawaban_benar, gambar_url')
    .eq('matkul_id', tokenData.matkul_id)
    .order('created_at', { ascending: true });

  const matkulName = (tokenData.matkul as { nama_matkul: string })?.nama_matkul || 'Ujian';
  const soalList = soalData || [];

  return (
    <ShareTestClient
      matkulName={matkulName}
      penerimaName={tokenData.penerima_nama}
      soalList={soalList}
      ujianId={tokenData.matkul_id}
    />
  );
}

// ── Komponen Error ──
function ErrorPage({ message, locked = false }: { message: string; locked?: boolean }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#0f0f17',
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
