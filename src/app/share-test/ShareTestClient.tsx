'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, CheckCircle2, XCircle, BookOpen,
  Shuffle, ListOrdered, Play, Clock, BellOff, Bell, Timer,
} from 'lucide-react';
import Swal from 'sweetalert2';

type Soal = {
  id: string;
  pertanyaan: string;
  pilihan_a: string;
  pilihan_b: string;
  pilihan_c: string;
  pilihan_d: string;
  jawaban_benar: 'A' | 'B' | 'C' | 'D';
  gambar_url?: string | null;
};

type Props = {
  matkulName: string;
  penerimaName: string;
  soalList: Soal[];
};

type Fase = 'setup' | 'ujian' | 'hasil';

const OPTS = ['A', 'B', 'C', 'D'] as const;

function formatTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const swalDark = { background: '#1a1a24', color: '#e8e8f0' };

export default function ShareTestClient({ matkulName, penerimaName, soalList }: Props) {
  const [fase, setFase] = useState<Fase>('setup');

  // Setup options
  const [acak, setAcak] = useState(false);
  const [jumlahSoal, setJumlahSoal] = useState(Math.min(10, soalList.length));
  const [pakaiWaktu, setPakaiWaktu] = useState(false);
  const [menitWaktu, setMenitWaktu] = useState(30);
  const [alertPerSoal, setAlertPerSoal] = useState(false);

  // Ujian state
  const [soalUjian, setSoalUjian] = useState<Soal[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [jawaban, setJawaban] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAlertOpenRef = useRef(false);

  // ── Anti-Cheat ──
  useEffect(() => {
    const handleContext = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) ||
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('contextmenu', handleContext);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('contextmenu', handleContext);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  if (soalList.length === 0) {
    return (
      <div style={centerStyle}>
        <BookOpen size={40} color="#7c6bff" style={{ marginBottom: '1rem' }} />
        <p style={{ color: '#888', fontSize: '0.95rem' }}>Belum ada soal untuk mata kuliah ini.</p>
      </div>
    );
  }

  function mulaiUjian() {
    let pool = [...soalList];
    if (acak) pool = pool.sort(() => Math.random() - 0.5);
    const selected = pool.slice(0, jumlahSoal);
    setSoalUjian(selected);
    setCurrentIdx(0);
    setJawaban({});
    setFase('ujian');
    if (pakaiWaktu) startTimer(menitWaktu * 60);
  }

  function startTimer(totalSecs: number) {
    setTimeLeft(totalSecs);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleTimeUp() {
    await Swal.fire({
      icon: 'warning', title: '⏰ Waktu Habis!',
      text: 'Waktu ujian sudah habis. Jawaban akan langsung diperiksa.',
      confirmButtonColor: '#7c6bff', ...swalDark,
    });
    finishUjian();
  }

  async function pilihJawaban(soalId: string, opt: string, soal: Soal) {
    if (isAlertOpenRef.current) return;
    setJawaban(prev => ({ ...prev, [soalId]: opt }));

    if (alertPerSoal) {
      isAlertOpenRef.current = true;
      const benar = opt === soal.jawaban_benar;
      const pilihanBenarTeks = soal[`pilihan_${soal.jawaban_benar.toLowerCase()}` as keyof Soal] as string;
      await Swal.fire({
        icon: benar ? 'success' : 'error',
        title: benar ? '✅ Benar!' : '❌ Salah!',
        html: benar
          ? `<p style="color:#00d4a1;font-weight:600">Jawaban kamu tepat!</p>`
          : `<p>Jawaban benar: <b style="color:#00d4a1">${soal.jawaban_benar}. ${pilihanBenarTeks}</b></p>`,
        timer: benar ? 1200 : 3000,
        timerProgressBar: true,
        showConfirmButton: !benar,
        confirmButtonText: 'Lanjut',
        confirmButtonColor: '#7c6bff',
        ...swalDark,
      });
      isAlertOpenRef.current = false;
      if (currentIdx < soalUjian.length - 1) setCurrentIdx(i => i + 1);
    }
  }

  async function selesaikan() {
    const belum = soalUjian.filter(s => !jawaban[s.id]).length;
    if (belum > 0) {
      const r = await Swal.fire({
        icon: 'question', title: 'Ada Soal Belum Dijawab',
        html: `<b>${belum} soal</b> belum dijawab. Yakin ingin selesai?`,
        showCancelButton: true, confirmButtonText: 'Selesaikan',
        cancelButtonText: 'Kembali', confirmButtonColor: '#7c6bff',
        cancelButtonColor: '#ff5c5c', ...swalDark,
      });
      if (!r.isConfirmed) return;
    }
    finishUjian();
  }

  function finishUjian() {
    if (timerRef.current) clearInterval(timerRef.current);
    const snap = { ...jawaban };
    const benar = soalUjian.filter(s => snap[s.id] === s.jawaban_benar).length;
    const persen = Math.round((benar / soalUjian.length) * 100);
    let icon: 'success' | 'warning' | 'error' = 'success';
    if (persen < 75) icon = 'warning';
    if (persen < 50) icon = 'error';

    Swal.fire({
      icon,
      title: persen >= 75 ? '🎉 Luar Biasa!' : persen >= 50 ? '📚 Terus Belajar!' : '😅 Perlu Latihan Lagi!',
      html: `
        <div style="text-align:center;line-height:2">
          <p style="font-size:2.5rem;font-weight:800;color:${persen >= 75 ? '#00d4a1' : persen >= 50 ? '#ffb347' : '#ff5c5c'}">${persen}%</p>
          <p>Benar: <b style="color:#00d4a1">${benar}</b> &nbsp;|&nbsp; Salah: <b style="color:#ff5c5c">${soalUjian.length - benar}</b></p>
          <p style="font-size:0.82rem;color:#888">dari ${soalUjian.length} soal</p>
        </div>
      `,
      confirmButtonText: 'Lihat Detail', confirmButtonColor: '#7c6bff', ...swalDark,
    });
    setFase('hasil');
  }

  /* ══════════════════════════════════════
     FASE: SETUP
  ══════════════════════════════════════ */
  if (fase === 'setup') {
    const jumlahOptions = [5, 10, 15, 20, soalList.length]
      .filter((v, i, a) => a.indexOf(v) === i && v <= soalList.length && v > 0);

    return (
      <div style={{ minHeight: '100vh', background: '#0f0f17', fontFamily: 'system-ui, sans-serif' }}>
        <header style={{ background: '#1a1a24', borderBottom: '1px solid #2a2a3a', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #7c6bff, #ff6b9d)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={16} color="#fff" />
            </div>
            <div>
              <p style={{ fontSize: '0.68rem', color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ujian Latihan</p>
              <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#e8e8f0' }}>{matkulName}</p>
            </div>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#888', background: '#12121c', border: '1px solid #2a2a3a', borderRadius: 6, padding: '0.25rem 0.6rem' }}>
            👤 {penerimaName}
          </span>
        </header>

        <main style={{ maxWidth: 520, margin: '0 auto', padding: '2.5rem 1.25rem' }}>
          <div style={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 20, padding: '2rem' }}>

            {/* Hero */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, margin: '0 auto 1rem', background: 'linear-gradient(135deg, #ff6b9d, #7c6bff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookOpen size={28} color="#fff" />
              </div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#e8e8f0', marginBottom: '0.35rem' }}>{matkulName}</h2>
              <p style={{ fontSize: '0.82rem', color: '#666' }}>{soalList.length} soal tersedia</p>
            </div>

            {/* Jumlah Soal */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Jumlah Soal</label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {jumlahOptions.map(n => (
                  <button key={n} onClick={() => setJumlahSoal(n)} style={{
                    padding: '0.5rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700,
                    background: jumlahSoal === n ? '#7c6bff' : '#12121c',
                    color: jumlahSoal === n ? '#fff' : '#666', transition: 'all 0.15s',
                  }}>
                    {n === soalList.length ? `Semua (${n})` : n}
                  </button>
                ))}
              </div>
            </div>

            {/* Urutan */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Urutan Soal</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setAcak(false)} style={{ ...toggleBtn, border: `2px solid ${!acak ? '#00d4a1' : '#2a2a3a'}`, background: !acak ? 'rgba(0,212,161,0.08)' : '#12121c', color: !acak ? '#00d4a1' : '#666' }}>
                  <ListOrdered size={15} /> Berurutan
                </button>
                <button onClick={() => setAcak(true)} style={{ ...toggleBtn, border: `2px solid ${acak ? '#ff6b9d' : '#2a2a3a'}`, background: acak ? 'rgba(255,107,157,0.08)' : '#12121c', color: acak ? '#ff6b9d' : '#666' }}>
                  <Shuffle size={15} /> Acak
                </button>
              </div>
            </div>

            {/* Batas Waktu */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Batas Waktu</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: pakaiWaktu ? '0.75rem' : 0 }}>
                <button onClick={() => setPakaiWaktu(false)} style={{ ...toggleBtn, border: `2px solid ${!pakaiWaktu ? '#00d4a1' : '#2a2a3a'}`, background: !pakaiWaktu ? 'rgba(0,212,161,0.08)' : '#12121c', color: !pakaiWaktu ? '#00d4a1' : '#666' }}>
                  <BellOff size={15} /> Tanpa Waktu
                </button>
                <button onClick={() => setPakaiWaktu(true)} style={{ ...toggleBtn, border: `2px solid ${pakaiWaktu ? '#ffb347' : '#2a2a3a'}`, background: pakaiWaktu ? 'rgba(255,179,71,0.08)' : '#12121c', color: pakaiWaktu ? '#ffb347' : '#666' }}>
                  <Timer size={15} /> Pakai Waktu
                </button>
              </div>
              {pakaiWaktu && (
                <div style={{ padding: '1rem', borderRadius: 10, background: 'rgba(255,179,71,0.07)', border: '1px solid rgba(255,179,71,0.2)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <Clock size={15} color="#ffb347" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.75rem', color: '#ffb347', fontWeight: 700, marginBottom: '0.4rem' }}>Durasi Ujian</p>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {[5, 10, 15, 20, 30, 45, 60].map(m => (
                        <button key={m} onClick={() => setMenitWaktu(m)} style={{
                          padding: '0.3rem 0.65rem', borderRadius: 7, border: 'none', cursor: 'pointer',
                          fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 700,
                          background: menitWaktu === m ? '#ffb347' : '#12121c',
                          color: menitWaktu === m ? '#1a1a1a' : '#666',
                        }}>
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Feedback */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={labelStyle}>Feedback Jawaban</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setAlertPerSoal(false)} style={{ ...toggleBtn, border: `2px solid ${!alertPerSoal ? '#7c6bff' : '#2a2a3a'}`, background: !alertPerSoal ? 'rgba(124,107,255,0.08)' : '#12121c', color: !alertPerSoal ? '#7c6bff' : '#666' }}>
                  <BellOff size={15} /> Setelah Selesai
                </button>
                <button onClick={() => setAlertPerSoal(true)} style={{ ...toggleBtn, border: `2px solid ${alertPerSoal ? '#ff6b9d' : '#2a2a3a'}`, background: alertPerSoal ? 'rgba(255,107,157,0.08)' : '#12121c', color: alertPerSoal ? '#ff6b9d' : '#666' }}>
                  <Bell size={15} /> Alert Per Soal
                </button>
              </div>
              {alertPerSoal && (
                <p style={{ fontSize: '0.73rem', color: '#555', marginTop: '0.5rem' }}>
                  Setiap menjawab akan muncul notifikasi benar/salah, lalu otomatis lanjut ke soal berikutnya.
                </p>
              )}
            </div>

            <button onClick={mulaiUjian} style={{
              width: '100%', padding: '1rem',
              background: 'linear-gradient(135deg, #ff6b9d, #7c6bff)',
              color: '#fff', border: 'none', borderRadius: 12,
              fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              boxShadow: '0 4px 20px rgba(124,107,255,0.3)',
            }}>
              <Play size={18} /> Mulai Ujian
            </button>
          </div>
        </main>
      </div>
    );
  }

  /* ══════════════════════════════════════
     FASE: HASIL
  ══════════════════════════════════════ */
  if (fase === 'hasil') {
    const snap = { ...jawaban };
    const benar = soalUjian.filter(s => snap[s.id] === s.jawaban_benar).length;
    const salah = soalUjian.length - benar;
    const persen = Math.round((benar / soalUjian.length) * 100);
    const soalSalah = soalUjian.filter(s => snap[s.id] !== s.jawaban_benar);

    return (
      <div style={{ minHeight: '100vh', background: '#0f0f17', padding: '0 0 4rem', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.25rem' }}>
          <div style={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 18, padding: '2rem', textAlign: 'center', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.72rem', color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
              Hasil Ujian — {penerimaName}
            </p>
            <p style={{ fontSize: '3.5rem', fontWeight: 800, color: persen >= 75 ? '#00d4a1' : persen >= 50 ? '#ffb347' : '#ff5c5c', lineHeight: 1, fontFamily: 'monospace' }}>
              {persen}%
            </p>
            <p style={{ color: '#555', fontSize: '0.82rem', marginTop: '0.35rem' }}>{matkulName}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1.5rem' }}>
              <span style={{ color: '#00d4a1', fontWeight: 700 }}>✓ {benar} Benar</span>
              <span style={{ color: '#333' }}>|</span>
              <span style={{ color: '#ff5c5c', fontWeight: 700 }}>✗ {salah} Salah</span>
              <span style={{ color: '#333' }}>|</span>
              <span style={{ color: '#666' }}>{soalUjian.length} Soal</span>
            </div>
            <button onClick={() => setFase('setup')} style={{ marginTop: '1.5rem', padding: '0.7rem 1.5rem', background: 'linear-gradient(135deg, #7c6bff, #ff6b9d)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, fontFamily: 'inherit' }}>
              🔁 Ulangi / Setting Ulang
            </button>
          </div>

          {soalSalah.length > 0 ? (
            <>
              <h3 style={{ color: '#ff5c5c', fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <XCircle size={16} /> Soal Salah ({soalSalah.length})
              </h3>
              {soalSalah.map((soal, i) => (
                <div key={soal.id} style={{ background: '#1a1a24', border: '1px solid rgba(255,92,92,0.2)', borderRadius: 14, padding: '1.25rem', marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.7rem', color: '#ff5c5c', fontWeight: 700, marginBottom: '0.5rem', fontFamily: 'monospace' }}>SOAL {i + 1}</p>
                  <p style={{ fontSize: '0.875rem', color: '#e0e0f0', lineHeight: 1.6, marginBottom: '1rem' }}>{soal.pertanyaan}</p>
                  {soal.gambar_url && <img src={soal.gambar_url} alt="" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, border: '1px solid #2a2a3a', marginBottom: '0.85rem', display: 'block' }} />}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    {OPTS.map(opt => {
                      const teks = soal[`pilihan_${opt.toLowerCase()}` as keyof Soal] as string;
                      const isBenar = opt === soal.jawaban_benar;
                      const isUser = opt === (snap[soal.id] || '');
                      let bg = '#12121c', border = 'transparent', color = '#555';
                      if (isBenar) { bg = 'rgba(0,212,161,0.08)'; border = 'rgba(0,212,161,0.3)'; color = '#00d4a1'; }
                      if (isUser && !isBenar) { bg = 'rgba(255,92,92,0.08)'; border = 'rgba(255,92,92,0.3)'; color = '#ff5c5c'; }
                      return (
                        <div key={opt} style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 8, background: bg, border: `1px solid ${border}` }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 700, color, flexShrink: 0 }}>{opt}.</span>
                          <span style={{ fontSize: '0.78rem', color, fontWeight: isBenar ? 700 : 400 }}>{teks}</span>
                          {isBenar && <CheckCircle2 size={12} color="#00d4a1" style={{ flexShrink: 0, marginLeft: 'auto' }} />}
                          {isUser && !isBenar && <XCircle size={12} color="#ff5c5c" style={{ flexShrink: 0, marginLeft: 'auto' }} />}
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#555', marginTop: '0.75rem' }}>
                    Jawabanmu: <span style={{ color: '#ff5c5c', fontWeight: 700 }}>{snap[soal.id] || '—'}</span>
                    {' '}— Benar: <span style={{ color: '#00d4a1', fontWeight: 700 }}>{soal.jawaban_benar}</span>
                  </p>
                </div>
              ))}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(0,212,161,0.06)', border: '1px solid rgba(0,212,161,0.2)', borderRadius: 14 }}>
              <CheckCircle2 size={36} color="#00d4a1" style={{ marginBottom: '0.75rem' }} />
              <p style={{ color: '#00d4a1', fontWeight: 700 }}>Sempurna! Semua jawaban benar! 🎉</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════
     FASE: UJIAN
  ══════════════════════════════════════ */
  const soal = soalUjian[currentIdx];
  const answered = jawaban[soal.id];
  const progress = ((currentIdx + 1) / soalUjian.length) * 100;
  const answeredCount = Object.keys(jawaban).length;
  const isWarning = pakaiWaktu && timeLeft <= 60 && timeLeft > 0;
  const isDanger = pakaiWaktu && timeLeft <= 30 && timeLeft > 0;

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f17', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ background: '#1a1a24', borderBottom: '1px solid #2a2a3a', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '0.68rem', color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ujian Latihan</p>
          <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#e8e8f0' }}>{matkulName}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {pakaiWaktu && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', borderRadius: 8, background: isDanger ? 'rgba(255,92,92,0.15)' : isWarning ? 'rgba(255,179,71,0.15)' : '#12121c', border: `1px solid ${isDanger ? 'rgba(255,92,92,0.4)' : isWarning ? 'rgba(255,179,71,0.4)' : '#2a2a3a'}` }}>
              <Clock size={13} color={isDanger ? '#ff5c5c' : isWarning ? '#ffb347' : '#555'} />
              <span style={{ fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 700, color: isDanger ? '#ff5c5c' : isWarning ? '#ffb347' : '#888' }}>
                {formatTime(timeLeft)}
              </span>
            </div>
          )}
          <span style={{ fontSize: '0.72rem', color: '#888', background: '#12121c', border: '1px solid #2a2a3a', borderRadius: 6, padding: '0.25rem 0.6rem' }}>
            👤 {penerimaName}
          </span>
          <span style={{ fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 700, color: '#7c6bff' }}>
            {currentIdx + 1}/{soalUjian.length}
          </span>
        </div>
      </header>

      <div style={{ height: 4, background: '#2a2a3a' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #7c6bff, #ff6b9d)', transition: 'width 0.3s' }} />
      </div>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.25rem' }}>
        <div style={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 18, padding: '2rem', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#7c6bff', background: 'rgba(124,107,255,0.12)', border: '1px solid rgba(124,107,255,0.25)', borderRadius: 6, padding: '0.2rem 0.6rem', fontFamily: 'monospace', display: 'inline-block', marginBottom: '1rem' }}>
            Soal {currentIdx + 1}
          </span>
          {alertPerSoal && (
            <span style={{ marginLeft: '0.5rem', fontSize: '0.68rem', fontWeight: 600, color: '#ff6b9d', background: 'rgba(255,107,157,0.1)', border: '1px solid rgba(255,107,157,0.25)', borderRadius: 6, padding: '0.2rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <Bell size={10} /> Mode Alert
            </span>
          )}
          <p style={{ fontSize: '1rem', fontWeight: 600, color: '#e8e8f0', lineHeight: 1.7, marginTop: '0.25rem' }}>{soal.pertanyaan}</p>
          {soal.gambar_url && <img src={soal.gambar_url} alt="" style={{ marginTop: '1rem', maxWidth: '100%', maxHeight: 280, borderRadius: 10, border: '1px solid #2a2a3a', display: 'block', margin: '1rem auto 0' }} />}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
          {OPTS.map(opt => {
            const teks = soal[`pilihan_${opt.toLowerCase()}` as keyof Soal] as string;
            const isSelected = answered === opt;
            return (
              <button key={opt} onClick={() => pilihJawaban(soal.id, opt, soal)} style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '1rem 1.25rem',
                background: isSelected ? 'rgba(124,107,255,0.12)' : '#1a1a24',
                border: `2px solid ${isSelected ? '#7c6bff' : '#2a2a3a'}`,
                borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.15s', boxShadow: isSelected ? '0 0 16px rgba(124,107,255,0.2)' : 'none',
                fontFamily: 'inherit',
              }}>
                <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: isSelected ? '#7c6bff' : '#12121c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700, color: isSelected ? '#fff' : '#666', transition: 'all 0.15s' }}>
                  {opt}
                </span>
                <span style={{ fontSize: '0.9rem', color: isSelected ? '#e8e8f0' : '#aaa', fontWeight: isSelected ? 600 : 400, flex: 1 }}>
                  {teks}
                </span>
                {isSelected && (
                  <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', background: '#7c6bff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0} style={{ ...navBtn, opacity: currentIdx === 0 ? 0.4 : 1, cursor: currentIdx === 0 ? 'not-allowed' : 'pointer' }}>
            <ChevronLeft size={16} /> Sebelumnya
          </button>

          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'center', flex: 1, maxWidth: 280 }}>
            {soalUjian.slice(0, 20).map((s, i) => (
              <button key={i} onClick={() => setCurrentIdx(i)} style={{
                width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
                fontFamily: 'monospace', fontSize: '0.65rem', fontWeight: 700,
                background: i === currentIdx ? '#7c6bff' : jawaban[s.id] ? 'rgba(0,212,161,0.2)' : '#12121c',
                color: i === currentIdx ? '#fff' : jawaban[s.id] ? '#00d4a1' : '#444',
                outline: i === currentIdx ? '2px solid #7c6bff' : 'none', outlineOffset: 2,
              }}>
                {i + 1}
              </button>
            ))}
            {soalUjian.length > 20 && <span style={{ fontSize: '0.68rem', color: '#444', alignSelf: 'center' }}>+{soalUjian.length - 20}</span>}
          </div>

          {currentIdx < soalUjian.length - 1 ? (
            <button onClick={() => setCurrentIdx(i => i + 1)} style={{ ...navBtn, background: '#7c6bff', borderColor: '#7c6bff', color: '#fff' }}>
              Berikutnya <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={selesaikan} style={{ ...navBtn, background: 'linear-gradient(135deg, #00d4a1, #00b386)', border: 'none', color: '#fff', fontWeight: 700 }}>
              Selesai ✓
            </button>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.73rem', color: '#444' }}>
          {answeredCount} dari {soalUjian.length} soal dijawab
        </p>
      </main>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}

// ── Shared styles ──
const labelStyle: React.CSSProperties = {
  fontSize: '0.72rem', color: '#666', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.07em',
  display: 'block', marginBottom: '0.5rem',
};

const toggleBtn: React.CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
  padding: '0.75rem', borderRadius: 10, fontWeight: 600, fontFamily: 'inherit', fontSize: '0.85rem',
  cursor: 'pointer', transition: 'all 0.15s',
};

const navBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.4rem',
  padding: '0.75rem 1.25rem', borderRadius: 10,
  background: '#1a1a24', border: '1px solid #2a2a3a', color: '#aaa',
  cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit',
  flexShrink: 0, transition: 'all 0.15s',
};

const centerStyle: React.CSSProperties = {
  minHeight: '100vh', background: '#0f0f17',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'system-ui, sans-serif',
};
