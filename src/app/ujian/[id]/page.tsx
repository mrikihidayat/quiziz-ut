'use client';

import { useState, useEffect, useRef, use } from 'react';
import { supabase } from '@/lib/supabase';
import { initTheme, setTheme } from '@/lib/theme';
import Link from 'next/link';
import {
  ArrowLeft, Shuffle, ListOrdered, Play, ChevronRight,
  ChevronLeft, BookOpen, Loader2, Sun, Moon, CheckCircle2, XCircle,
  Clock, Bell, BellOff, Timer, ChevronDown, ChevronUp,
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

type Fase = 'setup' | 'ujian' | 'hasil';

const OPTS = ['A', 'B', 'C', 'D'] as const;

// Single neutral accent color for all answer options — no color bias
const OPT_ACCENT = 'var(--accent)';
const OPT_ACCENT_RAW = '#7c6bff';

function formatTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── Soal Navigator: compact grid with pagination for large sets ──
function SoalNavigator({
  soalUjian,
  jawaban,
  currentIdx,
  setCurrentIdx,
}: {
  soalUjian: Soal[];
  jawaban: Record<string, string>;
  currentIdx: number;
  setCurrentIdx: (i: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const PAGE_SIZE = 20;
  const totalPages = Math.ceil(soalUjian.length / PAGE_SIZE);
  const currentPage = Math.floor(currentIdx / PAGE_SIZE);
  const [visiblePage, setVisiblePage] = useState(currentPage);

  // Sync visible page when navigating via prev/next
  useEffect(() => {
    setVisiblePage(Math.floor(currentIdx / PAGE_SIZE));
  }, [currentIdx]);

  const start = visiblePage * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, soalUjian.length);
  const pageItems = soalUjian.slice(start, end);

  const answeredCount = Object.keys(jawaban).length;
  const total = soalUjian.length;

  if (soalUjian.length <= 10) {
    // Original simple inline row for small sets
    return (
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center', flex: 1 }}>
        {soalUjian.map((s, i) => (
          <button key={i} onClick={() => setCurrentIdx(i)} style={{
            width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
            fontFamily: "'Space Mono', monospace", fontSize: '0.7rem', fontWeight: 700,
            background: i === currentIdx ? 'var(--accent)' : jawaban[s.id] ? 'rgba(0,212,161,0.2)' : 'var(--surface-2)',
            color: i === currentIdx ? '#fff' : jawaban[s.id] ? 'var(--accent-3)' : 'var(--text-muted)',
            outline: i === currentIdx ? '2px solid var(--accent)' : 'none',
            outlineOffset: 2, transition: 'all 0.15s',
          }}>
            {i + 1}
          </button>
        ))}
      </div>
    );
  }

  // Compact navigator for large sets (>10 soal)
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
      {/* Summary pill + toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.35rem 0.85rem', borderRadius: 20,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600,
          fontFamily: "'Space Mono', monospace",
        }}
      >
        <span style={{ color: 'var(--accent-3)', fontWeight: 700 }}>{answeredCount}</span>
        <span>/</span>
        <span>{total}</span>
        <span style={{ fontSize: '0.65rem', marginLeft: 2 }}>dijawab</span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {/* Expandable grid panel */}
      {expanded && (
        <div style={{
          position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
          zIndex: 50, marginTop: '0.5rem',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '1rem', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          minWidth: 280, maxWidth: 360,
        }}>
          {/* Page tabs if needed */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              {Array.from({ length: totalPages }, (_, p) => (
                <button key={p} onClick={() => setVisiblePage(p)} style={{
                  padding: '0.25rem 0.6rem', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontFamily: "'Space Mono', monospace", fontSize: '0.7rem', fontWeight: 700,
                  background: p === visiblePage ? 'var(--accent)' : 'var(--surface-2)',
                  color: p === visiblePage ? '#fff' : 'var(--text-muted)',
                }}>
                  {p * PAGE_SIZE + 1}–{Math.min((p + 1) * PAGE_SIZE, total)}
                </button>
              ))}
            </div>
          )}

          {/* Grid of numbers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '0.3rem' }}>
            {pageItems.map((s, localIdx) => {
              const globalIdx = start + localIdx;
              const isCurrent = globalIdx === currentIdx;
              const isAnswered = !!jawaban[s.id];
              return (
                <button key={globalIdx} onClick={() => { setCurrentIdx(globalIdx); setExpanded(false); }} style={{
                  width: '100%', aspectRatio: '1', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontFamily: "'Space Mono', monospace", fontSize: '0.65rem', fontWeight: 700,
                  background: isCurrent ? 'var(--accent)' : isAnswered ? 'rgba(0,212,161,0.2)' : 'var(--surface-2)',
                  color: isCurrent ? '#fff' : isAnswered ? 'var(--accent-3)' : 'var(--text-muted)',
                  outline: isCurrent ? '2px solid var(--accent)' : 'none',
                  outlineOffset: 1, transition: 'all 0.1s',
                }}>
                  {globalIdx + 1}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', justifyContent: 'center' }}>
            {[
              { bg: 'var(--accent)', label: 'Sekarang' },
              { bg: 'rgba(0,212,161,0.2)', label: 'Dijawab' },
              { bg: 'var(--surface-2)', label: 'Belum' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: l.bg }} />
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function UjianPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: matkulId } = use(params);

  const [fase, setFase] = useState<Fase>('setup');
  const [matkulName, setMatkulName] = useState('');
  const [soalAll, setSoalAll] = useState<Soal[]>([]);
  const [soalUjian, setSoalUjian] = useState<Soal[]>([]);
  const [loading, setLoading] = useState(true);

  const [acak, setAcak] = useState(false);
  const [jumlahSoal, setJumlahSoal] = useState(10);
  const [pakaiWaktu, setPakaiWaktu] = useState(false);
  const [menitWaktu, setMenitWaktu] = useState(30);
  const [alertPerSoal, setAlertPerSoal] = useState(false);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [jawaban, setJawaban] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [theme, setThemeState] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const t = initTheme();
    setThemeState(t);
    fetchData();
  }, [matkulId]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  async function fetchData() {
    const [{ data: matkul }, { data: soal }] = await Promise.all([
      supabase.from('matkul').select('nama_matkul').eq('id', matkulId).single(),
      supabase.from('soal').select('*').eq('matkul_id', matkulId).order('created_at', { ascending: true }),
    ]);
    if (matkul) setMatkulName(matkul.nama_matkul);
    if (soal) {
      setSoalAll(soal);
      setJumlahSoal(Math.min(10, soal.length));
    }
    setLoading(false);
  }

  function toggleThemeHandler() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  }

  const swalTheme = {
    background: theme === 'dark' ? '#1a1a24' : '#ffffff',
    color: theme === 'dark' ? '#e8e8f0' : '#1a1a2e',
  };

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
      icon: 'warning',
      title: '⏰ Waktu Habis!',
      text: 'Waktu ujian sudah habis. Jawaban akan langsung diperiksa.',
      confirmButtonColor: '#7c6bff',
      ...swalTheme,
    });
    finishUjian(true);
  }

  function mulaiUjian() {
    if (soalAll.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Belum Ada Soal', text: 'Tambahkan soal dulu via dashboard.', ...swalTheme });
      return;
    }
    let pool = [...soalAll];
    if (acak) pool = pool.sort(() => Math.random() - 0.5);
    const selected = pool.slice(0, jumlahSoal);
    setSoalUjian(selected);
    setCurrentIdx(0);
    setJawaban({});
    setFase('ujian');
    if (pakaiWaktu) startTimer(menitWaktu * 60);
  }

  async function pilihJawaban(soalId: string, opt: string, soal: Soal) {
    if (isAlertOpen) return;
    setJawaban(prev => ({ ...prev, [soalId]: opt }));

    if (alertPerSoal) {
      setIsAlertOpen(true);
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
        ...swalTheme,
      });
      setIsAlertOpen(false);

      if (currentIdx < soalUjian.length - 1) {
        setCurrentIdx(i => i + 1);
      }
    }
  }

  function nextSoal() {
    if (currentIdx < soalUjian.length - 1) setCurrentIdx(i => i + 1);
  }

  function prevSoal() {
    if (currentIdx > 0) setCurrentIdx(i => i - 1);
  }

  async function selesaikanUjian() {
    const belumDijawab = soalUjian.filter(s => !jawaban[s.id]).length;
    if (belumDijawab > 0) {
      const result = await Swal.fire({
        icon: 'question', title: 'Ada Soal Belum Dijawab',
        html: `<b>${belumDijawab} soal</b> belum dijawab. Yakin ingin selesai sekarang?`,
        showCancelButton: true, confirmButtonText: 'Selesaikan',
        cancelButtonText: 'Kembali', confirmButtonColor: '#7c6bff',
        cancelButtonColor: '#ff5c5c', ...swalTheme,
      });
      if (!result.isConfirmed) return;
    }
    finishUjian(false);
  }

  function finishUjian(autoFinish: boolean) {
    if (timerRef.current) clearInterval(timerRef.current);
    const snap = { ...jawaban };
    const benar = soalUjian.filter(s => snap[s.id] === s.jawaban_benar).length;
    const salah = soalUjian.length - benar;
    const persen = Math.round((benar / soalUjian.length) * 100);

    setFase('hasil');

    if (!autoFinish) {
      let icon: 'success' | 'warning' | 'error' = 'success';
      let title = '🎉 Luar Biasa!';
      if (persen < 75) { icon = 'warning'; title = '📚 Terus Belajar!'; }
      if (persen < 50) { icon = 'error'; title = '😅 Perlu Latihan Lagi!'; }

      Swal.fire({
        icon, title,
        html: `
          <div style="text-align:center;line-height:2">
            <p style="font-size:2rem;font-weight:800;color:${persen >= 75 ? '#00d4a1' : persen >= 50 ? '#ffb347' : '#ff5c5c'}">${persen}%</p>
            <p>Benar: <b style="color:#00d4a1">${benar}</b> &nbsp;|&nbsp; Salah: <b style="color:#ff5c5c">${salah}</b></p>
            <p style="font-size:0.85rem;color:#888">dari ${soalUjian.length} soal</p>
          </div>
        `,
        confirmButtonText: 'Lihat Detail', confirmButtonColor: '#7c6bff', ...swalTheme,
      });
    }
  }

  /* ===================== LOADING ===================== */
  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={32} color="var(--accent)" style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  /* ===================== UJIAN SCREEN ===================== */
  if (fase === 'ujian') {
    const soal = soalUjian[currentIdx];
    const answered = jawaban[soal.id];
    const progress = ((currentIdx + 1) / soalUjian.length) * 100;
    const isWarning = pakaiWaktu && timeLeft <= 60 && timeLeft > 0;
    const isDanger = pakaiWaktu && timeLeft <= 30 && timeLeft > 0;

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <header style={{
          borderBottom: '1px solid var(--border)', background: 'var(--surface)',
          padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={async () => {
              const r = await Swal.fire({
                icon: 'question', title: 'Keluar Ujian?', text: 'Kemajuan ujian tidak akan tersimpan.',
                showCancelButton: true, confirmButtonText: 'Keluar',
                cancelButtonText: 'Lanjut', confirmButtonColor: '#ff5c5c', ...swalTheme,
              });
              if (r.isConfirmed) { if (timerRef.current) clearInterval(timerRef.current); setFase('setup'); }
            }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
              <ArrowLeft size={20} />
            </button>
            <div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>TES UJIAN</p>
              <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>{matkulName}</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {pakaiWaktu && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.4rem 0.85rem', borderRadius: 8,
                background: isDanger ? 'rgba(255,92,92,0.15)' : isWarning ? 'rgba(255,179,71,0.15)' : 'var(--surface-2)',
                border: `1px solid ${isDanger ? 'rgba(255,92,92,0.4)' : isWarning ? 'rgba(255,179,71,0.4)' : 'var(--border)'}`,
                transition: 'all 0.3s',
              }}>
                <Clock size={14} color={isDanger ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--text-muted)'} />
                <span style={{
                  fontFamily: "'Space Mono', monospace", fontSize: '0.9rem', fontWeight: 700,
                  color: isDanger ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--text-muted)',
                  animation: isDanger ? 'pulse 0.7s ease-in-out infinite' : 'none',
                }}>
                  {formatTime(timeLeft)}
                </span>
              </div>
            )}
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent)' }}>
              {currentIdx + 1} / {soalUjian.length}
            </span>
            <button onClick={toggleThemeHandler} style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '0.4rem 0.5rem', cursor: 'pointer', color: 'var(--text-muted)',
            }}>
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </header>

        {/* Progress bar */}
        <div style={{ height: 4, background: 'var(--border)' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))', transition: 'width 0.3s' }} />
        </div>
        {pakaiWaktu && (
          <div style={{ height: 3, background: 'var(--border)' }}>
            <div style={{
              height: '100%',
              width: `${(timeLeft / (menitWaktu * 60)) * 100}%`,
              background: isDanger ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--accent-3)',
              transition: 'width 1s linear, background 0.3s',
            }} />
          </div>
        )}

        <main style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem' }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 18, padding: '2rem', marginBottom: '1.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
              <span style={{
                fontFamily: "'Space Mono', monospace", fontSize: '0.7rem', fontWeight: 700,
                color: 'var(--accent)', background: 'rgba(124,107,255,0.12)',
                border: '1px solid rgba(124,107,255,0.25)', borderRadius: 6, padding: '0.2rem 0.6rem',
              }}>
                Soal {currentIdx + 1}
              </span>
              {alertPerSoal && (
                <span style={{
                  fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent-2)',
                  background: 'rgba(255,107,157,0.1)', border: '1px solid rgba(255,107,157,0.25)',
                  borderRadius: 6, padding: '0.2rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.25rem',
                }}>
                  <Bell size={10} /> Mode Alert
                </span>
              )}
            </div>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.7 }}>
              {soal.pertanyaan}
            </p>
            {soal.gambar_url && (
              <div style={{ marginTop: '1rem' }}>
                <img
                  src={soal.gambar_url}
                  alt="Gambar soal"
                  style={{
                    maxWidth: '100%', maxHeight: 280, borderRadius: 10,
                    border: '1px solid var(--border)', objectFit: 'contain',
                    background: 'rgba(0,0,0,0.15)', display: 'block', margin: '0 auto',
                  }}
                />
              </div>
            )}
          </div>

          {/* ── Pilihan jawaban — single color, no bias ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
            {OPTS.map(opt => {
              const teks = soal[`pilihan_${opt.toLowerCase()}` as keyof Soal] as string;
              const isSelected = answered === opt;
              return (
                <button
                  key={opt}
                  onClick={() => pilihJawaban(soal.id, opt, soal)}
                  disabled={!!answered && alertPerSoal}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '1rem 1.25rem',
                    background: isSelected ? 'rgba(124,107,255,0.12)' : 'var(--surface)',
                    border: `2px solid ${isSelected ? OPT_ACCENT_RAW : 'var(--border)'}`,
                    borderRadius: 12, cursor: (!!answered && alertPerSoal) ? 'not-allowed' : 'pointer',
                    textAlign: 'left', transition: 'all 0.15s',
                    boxShadow: isSelected ? `0 0 16px rgba(124,107,255,0.25)` : 'none',
                    opacity: (!!answered && alertPerSoal && !isSelected) ? 0.45 : 1,
                  }}
                >
                  <span style={{
                    flexShrink: 0, width: 36, height: 36, borderRadius: 10,
                    background: isSelected ? OPT_ACCENT_RAW : 'var(--surface-2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Space Mono', monospace", fontSize: '0.85rem', fontWeight: 700,
                    color: isSelected ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s',
                  }}>
                    {opt}
                  </span>
                  <span style={{ fontSize: '0.9rem', color: isSelected ? 'var(--text)' : 'var(--text-muted)', fontWeight: isSelected ? 600 : 400, flex: 1 }}>
                    {teks}
                  </span>
                  {isSelected && (
                    <span style={{
                      flexShrink: 0, width: 20, height: 20, borderRadius: '50%',
                      background: OPT_ACCENT_RAW,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Navigasi dengan SoalNavigator ── */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
            <button onClick={prevSoal} disabled={currentIdx === 0} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.75rem 1.25rem', borderRadius: 10,
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: currentIdx === 0 ? 'var(--text-muted)' : 'var(--text)',
              cursor: currentIdx === 0 ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit', opacity: currentIdx === 0 ? 0.5 : 1,
              flexShrink: 0,
            }}>
              <ChevronLeft size={16} /> Sebelumnya
            </button>

            <SoalNavigator
              soalUjian={soalUjian}
              jawaban={jawaban}
              currentIdx={currentIdx}
              setCurrentIdx={setCurrentIdx}
            />

            {currentIdx < soalUjian.length - 1 ? (
              <button onClick={nextSoal} style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.75rem 1.25rem', borderRadius: 10,
                background: 'var(--accent)', border: 'none', color: '#fff',
                cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit',
                flexShrink: 0,
              }}>
                Berikutnya <ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={selesaikanUjian} style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.75rem 1.25rem', borderRadius: 10,
                background: 'linear-gradient(135deg, var(--accent-3), #00b386)', border: 'none', color: '#fff',
                cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, fontFamily: 'inherit',
                flexShrink: 0,
              }}>
                Selesai ✓
              </button>
            )}
          </div>
        </main>

        <style>{`
          @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
          @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        `}</style>
      </div>
    );
  }

  /* ===================== HASIL SCREEN ===================== */
  if (fase === 'hasil') {
    const snap = { ...jawaban };
    const benar = soalUjian.filter(s => snap[s.id] === s.jawaban_benar).length;
    const salah = soalUjian.length - benar;
    const persen = Math.round((benar / soalUjian.length) * 100);
    const soalSalah = soalUjian.filter(s => snap[s.id] !== s.jawaban_benar);

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <header style={{
          borderBottom: '1px solid var(--border)', background: 'var(--surface)',
          padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={() => setFase('setup')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
              <ArrowLeft size={20} />
            </button>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>Hasil Ujian — {matkulName}</span>
          </div>
          <button onClick={toggleThemeHandler} style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '0.4rem 0.5rem', cursor: 'pointer', color: 'var(--text-muted)',
          }}>
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </header>

        <main style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem' }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 18, padding: '2rem', textAlign: 'center', marginBottom: '1.5rem',
          }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
              Nilai Kamu
            </p>
            <p style={{
              fontSize: '4rem', fontWeight: 800, fontFamily: "'Space Mono', monospace",
              color: persen >= 75 ? 'var(--success)' : persen >= 50 ? 'var(--warning)' : 'var(--danger)', lineHeight: 1,
            }}>
              {persen}%
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle2 size={18} color="var(--success)" />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--success)' }}>{benar} Benar</span>
              </div>
              <div style={{ width: 1, background: 'var(--border)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <XCircle size={18} color="var(--danger)" />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--danger)' }}>{salah} Salah</span>
              </div>
              <div style={{ width: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>dari {soalUjian.length} soal</span>
            </div>
            <button onClick={() => mulaiUjian()} style={{
              marginTop: '1.5rem', padding: '0.7rem 1.5rem',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
              color: '#fff', border: 'none', borderRadius: 10,
              cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, fontFamily: 'inherit',
            }}>
              🔁 Ulangi Ujian
            </button>
          </div>

          {soalSalah.length > 0 ? (
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--danger)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <XCircle size={16} /> Soal yang Salah ({soalSalah.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {soalSalah.map((soal, i) => {
                  const jawabanUser = snap[soal.id] || '—';
                  const jawabanBenar = soal.jawaban_benar;
                  return (
                    <div key={soal.id} style={{
                      background: 'var(--surface)', border: '1px solid rgba(255,92,92,0.25)',
                      borderRadius: 14, padding: '1.25rem',
                    }}>
                      <p style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 700, marginBottom: '0.5rem', fontFamily: "'Space Mono', monospace" }}>SOAL {i + 1}</p>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.6, marginBottom: soal.gambar_url ? '0.75rem' : '1rem' }}>{soal.pertanyaan}</p>
                      {soal.gambar_url && (
                        <div style={{ marginBottom: '0.85rem' }}>
                          <img
                            src={soal.gambar_url}
                            alt="Gambar soal"
                            style={{
                              maxWidth: '100%', maxHeight: 200, borderRadius: 8,
                              border: '1px solid var(--border)', objectFit: 'contain',
                              background: 'rgba(0,0,0,0.1)', display: 'block',
                            }}
                          />
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                        {OPTS.map(opt => {
                          const teks = soal[`pilihan_${opt.toLowerCase()}` as keyof Soal] as string;
                          const isBenar = opt === jawabanBenar;
                          const isUserPilih = opt === jawabanUser;
                          let bg = 'var(--surface-2)', border = 'transparent', textCol = 'var(--text-muted)';
                          if (isBenar) { bg = 'rgba(0,212,161,0.1)'; border = 'rgba(0,212,161,0.4)'; textCol = 'var(--success)'; }
                          if (isUserPilih && !isBenar) { bg = 'rgba(255,92,92,0.1)'; border = 'rgba(255,92,92,0.4)'; textCol = 'var(--danger)'; }
                          return (
                            <div key={opt} style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 8, background: bg, border: `1px solid ${border}` }}>
                              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.7rem', fontWeight: 700, color: textCol, flexShrink: 0 }}>{opt}.</span>
                              <span style={{ fontSize: '0.8rem', color: textCol, fontWeight: isBenar ? 700 : 400 }}>{teks}</span>
                              {isBenar && <CheckCircle2 size={13} color="var(--success)" style={{ flexShrink: 0, marginLeft: 'auto', marginTop: 2 }} />}
                              {isUserPilih && !isBenar && <XCircle size={13} color="var(--danger)" style={{ flexShrink: 0, marginLeft: 'auto', marginTop: 2 }} />}
                            </div>
                          );
                        })}
                      </div>
                      <p style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Kamu menjawab: <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{jawabanUser}</span>
                        {' '}— Jawaban benar: <span style={{ color: 'var(--success)', fontWeight: 700 }}>{jawabanBenar}</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(0,212,161,0.07)', border: '1px solid rgba(0,212,161,0.2)', borderRadius: 14 }}>
              <CheckCircle2 size={40} color="var(--success)" style={{ margin: '0 auto 0.75rem' }} />
              <p style={{ fontWeight: 700, color: 'var(--success)' }}>Sempurna! Semua jawaban benar! 🎉</p>
            </div>
          )}
        </main>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  /* ===================== SETUP SCREEN ===================== */
  const jumlahOptions = [5, 10, 15, 20, soalAll.length].filter((v, i, a) => a.indexOf(v) === i && v <= soalAll.length && v > 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{
        borderBottom: '1px solid var(--border)', background: 'var(--surface)',
        padding: '1.1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 600 }}>
            <ArrowLeft size={15} /> Dashboard
          </Link>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img src="/logo.png" alt="Logo" style={{ height: 34, width: 'auto', display: 'block', borderRadius: 6 }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)' }}>Tes Ujian — {matkulName}</span>
          </div>
        </div>
        <button onClick={toggleThemeHandler} style={{
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '0.4rem 0.5rem', cursor: 'pointer', color: 'var(--text-muted)',
        }}>
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </header>

      <main style={{ maxWidth: 540, margin: '0 auto', padding: '3rem 1.5rem' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '2rem' }}>

          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              width: 60, height: 60, borderRadius: 16, margin: '0 auto 1rem',
              background: 'linear-gradient(135deg, var(--accent-2), var(--accent))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BookOpen size={28} color="#fff" />
            </div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.35rem' }}>{matkulName}</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{soalAll.length} soal tersedia</p>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '0.5rem' }}>
              Jumlah Soal
            </label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {jumlahOptions.map(n => (
                <button key={n} onClick={() => setJumlahSoal(n)} style={{
                  padding: '0.5rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontFamily: "'Space Mono', monospace", fontSize: '0.85rem', fontWeight: 700,
                  background: jumlahSoal === n ? 'var(--accent)' : 'var(--surface-2)',
                  color: jumlahSoal === n ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s',
                }}>
                  {n === soalAll.length ? `Semua (${n})` : n}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '0.5rem' }}>
              Urutan Soal
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setAcak(false)} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                padding: '0.75rem', borderRadius: 10, fontWeight: 600, fontFamily: 'inherit', fontSize: '0.85rem',
                border: `2px solid ${!acak ? 'var(--accent-3)' : 'var(--border)'}`,
                background: !acak ? 'rgba(0,212,161,0.08)' : 'var(--surface-2)',
                color: !acak ? 'var(--accent-3)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <ListOrdered size={16} /> Berurutan
              </button>
              <button onClick={() => setAcak(true)} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                padding: '0.75rem', borderRadius: 10, fontWeight: 600, fontFamily: 'inherit', fontSize: '0.85rem',
                border: `2px solid ${acak ? 'var(--accent-2)' : 'var(--border)'}`,
                background: acak ? 'rgba(255,107,157,0.08)' : 'var(--surface-2)',
                color: acak ? 'var(--accent-2)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <Shuffle size={16} /> Acak
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '0.5rem' }}>
              Batas Waktu
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: pakaiWaktu ? '0.75rem' : 0 }}>
              <button onClick={() => setPakaiWaktu(false)} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                padding: '0.75rem', borderRadius: 10, fontWeight: 600, fontFamily: 'inherit', fontSize: '0.85rem',
                border: `2px solid ${!pakaiWaktu ? 'var(--accent-3)' : 'var(--border)'}`,
                background: !pakaiWaktu ? 'rgba(0,212,161,0.08)' : 'var(--surface-2)',
                color: !pakaiWaktu ? 'var(--accent-3)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <BellOff size={15} /> Tanpa Waktu
              </button>
              <button onClick={() => setPakaiWaktu(true)} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                padding: '0.75rem', borderRadius: 10, fontWeight: 600, fontFamily: 'inherit', fontSize: '0.85rem',
                border: `2px solid ${pakaiWaktu ? 'var(--warning)' : 'var(--border)'}`,
                background: pakaiWaktu ? 'rgba(255,179,71,0.1)' : 'var(--surface-2)',
                color: pakaiWaktu ? 'var(--warning)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <Timer size={15} /> Pakai Waktu
              </button>
            </div>

            {pakaiWaktu && (
              <div style={{
                padding: '1rem', borderRadius: 10,
                background: 'rgba(255,179,71,0.07)', border: '1px solid rgba(255,179,71,0.2)',
                display: 'flex', alignItems: 'center', gap: '1rem',
              }}>
                <Clock size={16} color="var(--warning)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.78rem', color: 'var(--warning)', fontWeight: 700, marginBottom: '0.4rem' }}>Durasi Ujian</p>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {[5, 10, 15, 20, 30, 45, 60].map(m => (
                      <button key={m} onClick={() => setMenitWaktu(m)} style={{
                        padding: '0.35rem 0.7rem', borderRadius: 7, border: 'none', cursor: 'pointer',
                        fontFamily: "'Space Mono', monospace", fontSize: '0.78rem', fontWeight: 700,
                        background: menitWaktu === m ? 'var(--warning)' : 'var(--surface-2)',
                        color: menitWaktu === m ? '#1a1a1a' : 'var(--text-muted)', transition: 'all 0.15s',
                      }}>
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '0.5rem' }}>
              Feedback Jawaban
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setAlertPerSoal(false)} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                padding: '0.75rem', borderRadius: 10, fontWeight: 600, fontFamily: 'inherit', fontSize: '0.85rem',
                border: `2px solid ${!alertPerSoal ? 'var(--accent)' : 'var(--border)'}`,
                background: !alertPerSoal ? 'rgba(124,107,255,0.08)' : 'var(--surface-2)',
                color: !alertPerSoal ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <BellOff size={15} /> Setelah Selesai
              </button>
              <button onClick={() => setAlertPerSoal(true)} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                padding: '0.75rem', borderRadius: 10, fontWeight: 600, fontFamily: 'inherit', fontSize: '0.85rem',
                border: `2px solid ${alertPerSoal ? 'var(--accent-2)' : 'var(--border)'}`,
                background: alertPerSoal ? 'rgba(255,107,157,0.08)' : 'var(--surface-2)',
                color: alertPerSoal ? 'var(--accent-2)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <Bell size={15} /> Alert Per Soal
              </button>
            </div>
            {alertPerSoal && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', paddingLeft: '0.25rem' }}>
                Setiap menjawab akan muncul notifikasi benar/salah, lalu otomatis lanjut ke soal berikutnya.
              </p>
            )}
          </div>

          <button onClick={mulaiUjian} style={{
            width: '100%', padding: '1rem',
            background: 'linear-gradient(135deg, var(--accent-2), var(--accent))',
            color: '#fff', border: 'none', borderRadius: 12,
            fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            boxShadow: '0 4px 20px rgba(124,107,255,0.3)',
          }}>
            <Play size={18} /> Mulai Ujian
          </button>
        </div>
      </main>
      <footer style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        Dibuat oleh <span style={{ fontWeight: 700, color: 'var(--text)' }}>M. Riki Hidayat</span> — Mahasiswa SI UT
      </footer>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
