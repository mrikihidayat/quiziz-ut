'use client';

import { useState, useEffect, useRef, use } from 'react';
import { supabase } from '@/lib/supabase';
import { initTheme, setTheme } from '@/lib/theme';
import Link from 'next/link';
import {
  ArrowLeft, Shuffle, ListOrdered, Play, ChevronRight,
  ChevronLeft, BookOpen, Loader2, Sun, Moon, CheckCircle2, XCircle,
  Clock, Bell, BellOff, Timer, ChevronDown, ChevronUp, ScrollText,
  History, Eye, RotateCcw, Trash2, X, AlertTriangle,
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

type HistoryItem = {
  id_pengerjaan: string;
  id_ujian: string;
  nama_matkul: string;
  tanggal: string;
  total_soal: number;
  benar: number;
  salah: number;
  skor: number;
  detail_review: Record<string, {
    pertanyaan: string;
    opsi_a: string; opsi_b: string; opsi_c: string; opsi_d: string;
    dipilih: string; kunci: string;
  }>;
};

const OPTS = ['A', 'B', 'C', 'D'] as const;
const OPT_ACCENT_RAW = '#7c6bff';

function formatTimer(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hh}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

function getNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function svgIcon(path: string, color = '#888', size = 14) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block">${path}</svg>`;
}
const ICON_EYE = '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>';
const ICON_ROTATE_CCW = '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>';
const ICON_TRASH = '<path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>';
const ICON_HISTORY = '<path d="M3 3v5h5"/><path d="M3.05 13a9 9 0 1 0 2.13-5.36L3 8"/><path d="M12 7v5l4 2"/>';

function formatDurasiHHMMSS(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export default function UjianPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: matkulId } = use(params);

  const PROGRESS_KEY = `kuis_progress_${matkulId}`;
  const TIMER_KEY = `kuis_timer_${matkulId}`;
  const HISTORY_KEY = 'kuis_history_list';

  const [fase, setFase] = useState<Fase>('setup');
  const [matkulName, setMatkulName] = useState('');
  const [soalAll, setSoalAll] = useState<Soal[]>([]);
  const [soalUjian, setSoalUjian] = useState<Soal[]>([]);
  const [loading, setLoading] = useState(true);

  const [acak, setAcak] = useState(false);
  const [jumlahSoal, setJumlahSoal] = useState(10);
  const [pakaiWaktu, setPakaiWaktu] = useState(true);
  const [alertPerSoal, setAlertPerSoal] = useState(false);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [jawaban, setJawaban] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isTimeUpRef = useRef(false);

  const [hasResume, setHasResume] = useState(false);
  const [resumeSisa, setResumeSisa] = useState(0);

  const [theme, setThemeState] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const t = initTheme();
    setThemeState(t);
    fetchData();
  }, [matkulId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = localStorage.getItem(TIMER_KEY);
    const p = localStorage.getItem(PROGRESS_KEY);
    if (t && p) {
      const sisa = parseInt(t, 10);
      if (sisa > 0) { setHasResume(true); setResumeSisa(sisa); }
    }
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  async function fetchData() {
    const [{ data: matkul }, { data: soal }] = await Promise.all([
      supabase.from('matkul').select('nama_matkul').eq('id', matkulId).single(),
      supabase.from('soal').select('*').eq('matkul_id', matkulId).order('nomor_soal', { ascending: true }),
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
        const next = prev - 1;
        if (typeof window !== 'undefined') {
          try { localStorage.setItem(TIMER_KEY, String(next)); } catch {}
        }
        if (next <= 0) {
          clearInterval(timerRef.current!);
          if (!isTimeUpRef.current) {
            isTimeUpRef.current = true;
            handleTimeUp();
          }
          return 0;
        }
        return next;
      });
    }, 1000);
  }

  async function handleTimeUp() {
    await Swal.fire({
      icon: 'warning', title: '⏰ Waktu Habis!',
      text: 'Waktu ujian sudah habis. Mengalkulasi skor otomatis...',
      confirmButtonColor: '#7c6bff', ...swalTheme,
    });
    setJawaban(prev => { finishUjian(prev, true); return prev; });
  }

  function mulaiUjian() {
    if (soalAll.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Belum Ada Soal', text: 'Tambahkan soal dulu via dashboard.', ...swalTheme });
      return;
    }
    let pool = [...soalAll];
    if (acak) pool = pool.sort(() => Math.random() - 0.5);
    const selected = pool.slice(0, jumlahSoal);
    isTimeUpRef.current = false;

    // Resume from localStorage if available
    let savedJawaban: Record<string, string> = {};
    let savedTime: number | null = null;
    if (typeof window !== 'undefined') {
      try {
        const sp = localStorage.getItem(PROGRESS_KEY);
        if (sp) savedJawaban = JSON.parse(sp);
        const st = localStorage.getItem(TIMER_KEY);
        if (st) savedTime = parseInt(st, 10);
      } catch {}
    }

    const validIds = new Set(selected.map(s => s.id));
    const filteredJawaban = Object.fromEntries(
      Object.entries(savedJawaban).filter(([k]) => validIds.has(k))
    );

    setSoalUjian(selected);
    setCurrentIdx(0);
    setJawaban(filteredJawaban);
    setFase('ujian');

    if (pakaiWaktu) {
      const durasi = jumlahSoal * 60;
      const resumeTime = savedTime !== null && savedTime > 0 && savedTime <= durasi ? savedTime : durasi;
      startTimer(resumeTime);
    }

    Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 5000,
      timerProgressBar: true,
      ...swalTheme,
    }).fire({
      icon: 'info',
      title: 'Progres Tersimpan Otomatis',
      text: 'Setiap jawaban langsung tersimpan. Kalau sesi terputus di tengah jalan, progresmu otomatis masuk ke Riwayat.',
    });
  }

  async function pilihJawaban(soalId: string, opt: string, soal: Soal) {
    if (isAlertOpen || isTimeUpRef.current) return;
    setJawaban(prev => {
      const next = { ...prev, [soalId]: opt };
      if (typeof window !== 'undefined') {
        try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(next)); } catch {}
      }
      return next;
    });

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
        timer: benar ? 1200 : 3000, timerProgressBar: true,
        showConfirmButton: !benar, confirmButtonText: 'Lanjut',
        confirmButtonColor: '#7c6bff', ...swalTheme,
      });
      setIsAlertOpen(false);
      if (currentIdx < soalUjian.length - 1) setCurrentIdx(i => i + 1);
    }
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
    finishUjian(jawaban, false);
  }

  function finishUjian(snap: Record<string, string>, autoFinish: boolean) {
    if (timerRef.current) clearInterval(timerRef.current);
    const benar = soalUjian.filter(s => snap[s.id] === s.jawaban_benar).length;
    const salah = soalUjian.length - benar;
    const skor = parseFloat(((benar / soalUjian.length) * 100).toFixed(1));

    // Build detail_review
    const detail_review: HistoryItem['detail_review'] = {};
    soalUjian.forEach((s, i) => {
      detail_review[String(i + 1)] = {
        pertanyaan: s.pertanyaan,
        opsi_a: s.pilihan_a, opsi_b: s.pilihan_b,
        opsi_c: s.pilihan_c, opsi_d: s.pilihan_d,
        dipilih: snap[s.id] || '—',
        kunci: s.jawaban_benar,
      };
    });

    // Save history
    if (typeof window !== 'undefined') {
      try {
        const existing: HistoryItem[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        existing.push({
          id_pengerjaan: `hist_${Date.now()}`,
          id_ujian: matkulId,
          nama_matkul: matkulName,
          tanggal: getNow(),
          total_soal: soalUjian.length,
          benar, salah, skor, detail_review,
        });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(existing));
      } catch {}
      try { localStorage.removeItem(PROGRESS_KEY); } catch {}
      try { localStorage.removeItem(TIMER_KEY); } catch {}
    }

    setJawaban(snap);
    setFase('hasil');

    if (!autoFinish) {
      const persen = Math.round(skor);
      let icon: 'success' | 'warning' | 'error' = 'success';
      let title = '🎉 Luar Biasa!';
      if (persen < 75) { icon = 'warning'; title = '📚 Terus Belajar!'; }
      if (persen < 50) { icon = 'error'; title = '😅 Perlu Latihan Lagi!'; }
      Swal.fire({
        icon, title,
        html: `<div style="text-align:center;line-height:2">
          <p style="font-size:2rem;font-weight:800;color:${persen >= 75 ? '#00d4a1' : persen >= 50 ? '#ffb347' : '#ff5c5c'}">${persen}%</p>
          <p>Benar: <b style="color:#00d4a1">${benar}</b> &nbsp;|&nbsp; Salah: <b style="color:#ff5c5c">${salah}</b></p>
          <p style="font-size:0.85rem;color:#888">dari ${soalUjian.length} soal</p>
        </div>`,
        confirmButtonText: 'Lihat Detail', confirmButtonColor: '#7c6bff', ...swalTheme,
      });
    }
  }

  function showDetailReview(h: HistoryItem) {
    const entries = Object.entries(h.detail_review);
    const bg0 = swalTheme.background;
    const cards = entries.map(([num, d]) => {
      const opts = [
        { key: 'A', val: d.opsi_a }, { key: 'B', val: d.opsi_b },
        { key: 'C', val: d.opsi_c }, { key: 'D', val: d.opsi_d },
      ];
      const optsHtml = opts.map(o => {
        const isBenar = o.key === d.kunci;
        const isUser = o.key === d.dipilih;
        let bg = '#12121c', border = '#2a2a3a', color = '#666';
        if (isBenar) { bg = 'rgba(0,212,161,0.1)'; border = '#00d4a1'; color = '#00d4a1'; }
        if (isUser && !isBenar) { bg = 'rgba(255,92,92,0.1)'; border = '#ff5c5c'; color = '#ff5c5c'; }
        const icon = isBenar ? ' ✓' : (isUser && !isBenar ? ' ✗' : '');
        return `<div style="display:flex;align-items:center;gap:0.4rem;padding:0.4rem 0.6rem;border-radius:6px;background:${bg};border:1px solid ${border};margin-bottom:0.3rem">
          <span style="font-family:monospace;font-size:0.7rem;font-weight:700;color:${color};flex-shrink:0">${o.key}.</span>
          <span style="font-size:0.75rem;color:${color};flex:1">${o.val}</span>
          <span style="font-size:0.7rem;font-weight:700;color:${color}">${icon}</span>
        </div>`;
      }).join('');
      const isBenar = d.dipilih === d.kunci;
      return `<div style="background:${bg0};border:1px solid ${isBenar ? 'rgba(0,212,161,0.25)' : 'rgba(255,92,92,0.25)'};border-radius:10px;padding:0.85rem;margin-bottom:0.65rem;text-align:left">
        <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.5rem">
          <span style="font-family:monospace;font-size:0.65rem;font-weight:700;color:${isBenar ? '#00d4a1' : '#ff5c5c'};background:${isBenar ? 'rgba(0,212,161,0.1)' : 'rgba(255,92,92,0.1)'};padding:0.15rem 0.5rem;border-radius:4px">${isBenar ? '✓ BENAR' : '✗ SALAH'}</span>
          <span style="font-size:0.65rem;color:#555">Soal ${num}</span>
        </div>
        <p style="font-size:0.8rem;line-height:1.5;margin-bottom:0.5rem">${d.pertanyaan}</p>
        ${optsHtml}
      </div>`;
    }).join('');

    Swal.fire({
      title: `📋 Detail Review — ${h.nama_matkul}`,
      html: `
        <div style="display:flex;gap:1rem;justify-content:center;margin-bottom:1rem;flex-wrap:wrap">
          <span style="font-size:0.75rem;color:#888">${h.tanggal}</span>
          <span style="font-size:0.8rem;font-weight:700;color:${h.skor >= 75 ? '#00d4a1' : h.skor >= 50 ? '#ffb347' : '#ff5c5c'}">${h.skor}% &nbsp;(${h.benar}/${h.total_soal} benar)</span>
        </div>
        <div style="max-height:55vh;overflow-y:auto;padding-right:4px">${cards}</div>
      `,
      width: 620,
      showCancelButton: true,
      confirmButtonText: 'Ujian Ulang',
      cancelButtonText: 'Tutup',
      confirmButtonColor: '#7c6bff',
      cancelButtonColor: '#444',
      ...swalTheme,
    }).then(r => { if (r.isConfirmed) handleActionSafety(() => startUlangDariHistory(h)); });
  }

  function startUlangDariHistory(h: HistoryItem) {
    const entries = Object.entries(h.detail_review);
    const rebuiltSoal: Soal[] = entries.map(([, d]) => {
      const match = soalAll.find(s => s.pertanyaan === d.pertanyaan);
      if (match) return match;
      return {
        id: `hist_${Math.random()}`,
        pertanyaan: d.pertanyaan,
        pilihan_a: d.opsi_a, pilihan_b: d.opsi_b,
        pilihan_c: d.opsi_c, pilihan_d: d.opsi_d,
        jawaban_benar: d.kunci as 'A' | 'B' | 'C' | 'D',
      };
    });
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem(TIMER_KEY); localStorage.removeItem(PROGRESS_KEY); } catch {}
    }
    setSoalUjian(rebuiltSoal);
    setCurrentIdx(0);
    setJawaban({});
    isTimeUpRef.current = false;
    setFase('ujian');
    if (pakaiWaktu) startTimer(rebuiltSoal.length * 60);
  }

  function buildAndPushHistory(snap: Record<string, string>, pool: Soal[]): boolean {
    const answeredIds = Object.keys(snap).filter(id => pool.some(s => s.id === id));
    if (answeredIds.length === 0) return false;
    if (typeof window === 'undefined') return false;
    try {
      const detail_review: HistoryItem['detail_review'] = {};
      let benar = 0;
      answeredIds.forEach((id, i) => {
        const s = pool.find(x => x.id === id);
        if (!s) return;
        const isBenar = snap[id] === s.jawaban_benar;
        if (isBenar) benar++;
        detail_review[String(i + 1)] = {
          pertanyaan: s.pertanyaan,
          opsi_a: s.pilihan_a, opsi_b: s.pilihan_b,
          opsi_c: s.pilihan_c, opsi_d: s.pilihan_d,
          dipilih: snap[id], kunci: s.jawaban_benar,
        };
      });
      const total = answeredIds.length;
      const salah = total - benar;
      const skor = parseFloat(((benar / total) * 100).toFixed(1));
      const existing: HistoryItem[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      existing.push({
        id_pengerjaan: `hist_${Date.now()}`,
        id_ujian: matkulId,
        nama_matkul: matkulName,
        tanggal: getNow(),
        total_soal: total, benar, salah, skor, detail_review,
      });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(existing));
      return true;
    } catch { return false; }
  }

  function clearSesiCache() {
    if (typeof window === 'undefined') return;
    try { localStorage.removeItem(PROGRESS_KEY); } catch {}
    try { localStorage.removeItem(TIMER_KEY); } catch {}
  }

  async function akhiriSesiGantung() {
    const r = await Swal.fire({
      icon: 'question',
      title: 'Akhiri Sesi Gantung?',
      text: 'Apakah Anda ingin mengakhiri sesi gantung ini? Progres jawaban yang sudah sempat Anda isi akan otomatis dibukukan ke dalam daftar Riwayat agar aman.',
      showCancelButton: true,
      confirmButtonText: 'Ya, Akhiri',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#ff5c5c',
      cancelButtonColor: '#444',
      ...swalTheme,
    });
    if (!r.isConfirmed) return;
    if (typeof window === 'undefined') return;
    try {
      const savedProgress = localStorage.getItem(PROGRESS_KEY);
      const savedJawaban: Record<string, string> = savedProgress ? JSON.parse(savedProgress) : {};
      buildAndPushHistory(savedJawaban, soalAll);
    } catch {}
    clearSesiCache();
    setHasResume(false);
  }

  function bukukanSesiAktifKeRiwayat() {
    if (soalUjian.length === 0) return;
    buildAndPushHistory(jawaban, soalUjian);
    if (timerRef.current) clearInterval(timerRef.current);
    clearSesiCache();
  }

  function handleActionSafety(proceed: () => void) {
    const sedangUjianAktif =
      fase === 'ujian' ||
      (typeof window !== 'undefined' && window.location.pathname.includes('/ujian/'));

    if (!sedangUjianAktif) { proceed(); return; }

    Swal.fire({
      icon: 'warning',
      title: 'Tinggalkan Ujian Sekarang?',
      text: 'Tenang, progres ujian Anda saat ini TIDAK AKAN HILANG. Sistem kami menyimpan jawaban Anda secara otomatis setiap detik. Keluar di tengah jalan akan otomatis membukukan progres Anda saat ini ke dalam halaman Riwayat sebagai sesi selesai awal. Yakin ingin lanjut Ujian Ulang?',
      showCancelButton: true,
      confirmButtonText: 'Ya, Lanjut Ujian Ulang',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#7c6bff',
      cancelButtonColor: '#444',
      ...swalTheme,
    }).then(r => {
      if (!r.isConfirmed) return;
      bukukanSesiAktifKeRiwayat();
      proceed();
    });
  }

  function showRiwayat() {
    if (typeof window === 'undefined') return;
    const history: HistoryItem[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    if (history.length === 0) {
      Swal.fire({
        title: `<div style="display:flex;align-items:center;justify-content:center;gap:0.5rem">${svgIcon(ICON_HISTORY, '#888', 18)}<span>Riwayat Tes</span></div>`,
        text: 'Belum ada riwayat.', confirmButtonColor: '#7c6bff', ...swalTheme,
      });
      return;
    }
    const reversed = [...history].reverse().slice(0, 30);
    (window as any).__riwayatData = reversed;
    (window as any).__showDetail = (idx: number) => { Swal.close(); setTimeout(() => showDetailReview(reversed[idx]), 150); };
    (window as any).__ulangUjian = (idx: number) => {
      Swal.close();
      setTimeout(() => handleActionSafety(() => startUlangDariHistory(reversed[idx])), 150);
    };
    (window as any).__hapusRiwayat = (idx: number) => {
      const item = reversed[idx];
      Swal.fire({
        title: 'Hapus Riwayat?',
        text: `Riwayat ujian "${item.nama_matkul}" (${item.tanggal}) akan dihapus permanen.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Hapus',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#ff5c5c',
        cancelButtonColor: '#444',
        ...swalTheme,
      }).then(r => {
        if (!r.isConfirmed) return;
        if (typeof window !== 'undefined') {
          try {
            const all: HistoryItem[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
            const filtered = all.filter(h => h.id_pengerjaan !== item.id_pengerjaan);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
          } catch {}
        }
        Swal.close();
        setTimeout(() => showRiwayat(), 150);
      });
    };

    const rows = reversed.map((h, i) => `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.07)">
        <td style="padding:0.5rem 0.4rem;font-size:0.72rem;color:#888">${h.tanggal}</td>
        <td style="padding:0.5rem 0.4rem;font-size:0.75rem;font-weight:600">${h.nama_matkul}</td>
        <td style="padding:0.5rem 0.4rem;font-size:0.75rem;text-align:center;color:#888">${h.benar}/${h.total_soal}</td>
        <td style="padding:0.5rem 0.4rem;font-size:0.8rem;font-weight:700;text-align:center;color:${h.skor >= 75 ? '#00d4a1' : h.skor >= 50 ? '#ffb347' : '#ff5c5c'}">${h.skor}%</td>
        <td style="padding:0.5rem 0.4rem;text-align:center">
          <div style="display:flex;gap:0.3rem;justify-content:center">
            <button onclick="window.__showDetail(${i})" style="padding:0.3rem;border-radius:5px;border:1px solid #2a2a3a;background:#12121c;color:#888;cursor:pointer;display:flex;align-items:center;justify-content:center" title="Lihat Hasil">${svgIcon(ICON_EYE, 'currentColor', 14)}</button>
            <button onclick="window.__ulangUjian(${i})" style="padding:0.3rem;border-radius:5px;border:1px solid #2a2a3a;background:#12121c;color:#888;cursor:pointer;display:flex;align-items:center;justify-content:center" title="Ujian Ulang">${svgIcon(ICON_ROTATE_CCW, 'currentColor', 14)}</button>
            <button onclick="window.__hapusRiwayat(${i})" style="padding:0.3rem;border-radius:5px;border:1px solid rgba(255,92,92,0.3);background:#12121c;color:#ff5c5c;cursor:pointer;display:flex;align-items:center;justify-content:center" title="Hapus Riwayat">${svgIcon(ICON_TRASH, 'currentColor', 14)}</button>
          </div>
        </td>
      </tr>
    `).join('');
    Swal.fire({
      title: `<div style="display:flex;align-items:center;justify-content:center;gap:0.5rem">${svgIcon(ICON_HISTORY, '#888', 18)}<span>Riwayat Tes</span></div>`,
      html: `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
        <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1)">
          <th style="padding:0.4rem;font-size:0.65rem;color:#666;text-align:left">Tanggal</th>
          <th style="padding:0.4rem;font-size:0.65rem;color:#666;text-align:left">Matkul</th>
          <th style="padding:0.4rem;font-size:0.65rem;color:#666">Benar</th>
          <th style="padding:0.4rem;font-size:0.65rem;color:#666">Skor</th>
          <th style="padding:0.4rem;font-size:0.65rem;color:#666">Aksi</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`,
      width: 620, confirmButtonText: 'Tutup', confirmButtonColor: '#7c6bff', ...swalTheme,
    });
  }

  /* ──── LOADING ──── */
  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={32} color="var(--accent)" style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  /* ──── UJIAN SCREEN ──── */
  if (fase === 'ujian') {
    const soal = soalUjian[currentIdx];
    const answered = jawaban[soal.id];
    const progress = ((currentIdx + 1) / soalUjian.length) * 100;
    const isWarning = pakaiWaktu && timeLeft <= 60 && timeLeft > 30;
    const isDanger = pakaiWaktu && timeLeft <= 30 && timeLeft > 0;

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <header style={{
          borderBottom: '1px solid var(--border)', background: 'var(--surface)',
          padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '0.5rem', flexWrap: 'nowrap',
        }}>
          {/* Kiri: tombol back + nama matkul */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: '1 1 0' }}>
            <button onClick={async () => {
              const r = await Swal.fire({
                icon: 'question', title: 'Keluar Ujian?', text: 'Kemajuan ujian tidak akan tersimpan.',
                showCancelButton: true, confirmButtonText: 'Keluar',
                cancelButtonText: 'Lanjut', confirmButtonColor: '#ff5c5c', ...swalTheme,
              });
              if (r.isConfirmed) {
                if (timerRef.current) clearInterval(timerRef.current);
                if (typeof window !== 'undefined') {
                  try { localStorage.removeItem(PROGRESS_KEY); localStorage.removeItem(TIMER_KEY); } catch {}
                }
                setFase('setup');
              }
            }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
              <ArrowLeft size={20} />
            </button>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>TES UJIAN</p>
              <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{matkulName}</p>
            </div>
          </div>

          {/* Kanan: timer + counter + riwayat + theme */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
            {pakaiWaktu && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.35rem 0.6rem', borderRadius: 8,
                background: isDanger ? 'rgba(255,92,92,0.15)' : isWarning ? 'rgba(255,179,71,0.15)' : 'var(--surface-2)',
                border: `1px solid ${isDanger ? 'rgba(255,92,92,0.4)' : isWarning ? 'rgba(255,179,71,0.4)' : 'var(--border)'}`,
                transition: 'all 0.3s',
              }}>
                <Clock size={13} color={isDanger ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--text-muted)'} />
                <span style={{
                  fontFamily: "'Space Mono', monospace", fontSize: '0.8rem', fontWeight: 700,
                  color: isDanger ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--text-muted)',
                  animation: isDanger ? 'pulse 0.7s ease-in-out infinite' : 'none',
                }}>
                  {formatTimer(timeLeft)}
                </span>
              </div>
            )}
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.35rem 0.5rem', whiteSpace: 'nowrap' }}>
              {currentIdx + 1}/{soalUjian.length}
            </span>
            <button onClick={showRiwayat} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.35rem 0.5rem',
              borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)',
              color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit',
            }} title="Riwayat">
              <ScrollText size={14} />
            </button>
            <button onClick={toggleThemeHandler} style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '0.35rem 0.5rem', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </header>

        <div style={{ height: 4, background: 'var(--border)' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))', transition: 'width 0.3s' }} />
        </div>
        {pakaiWaktu && (
          <div style={{ height: 3, background: 'var(--border)' }}>
            <div style={{
              height: '100%',
              width: `${(timeLeft / (jumlahSoal * 60)) * 100}%`,
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
            <p style={{ fontSize: 'clamp(0.85rem, 2.5vw, 1rem)', fontWeight: 600, color: 'var(--text)', lineHeight: 1.7 }}>
              {soal.pertanyaan}
            </p>
            {soal.gambar_url && (
              <div style={{ marginTop: '1rem' }}>
                <img src={soal.gambar_url} alt="Gambar soal" style={{
                  maxWidth: '100%', maxHeight: 280, borderRadius: 10,
                  border: '1px solid var(--border)', objectFit: 'contain',
                  background: 'rgba(0,0,0,0.15)', display: 'block', margin: '0 auto',
                }} />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
            {OPTS.map(opt => {
              const teks = soal[`pilihan_${opt.toLowerCase()}` as keyof Soal] as string;
              const isSelected = answered === opt;
              const isDisabled = isTimeUpRef.current;
              return (
                <button
                  key={opt}
                  onClick={() => pilihJawaban(soal.id, opt, soal)}
                  disabled={isDisabled}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '1rem 1.25rem',
                    background: isSelected ? 'rgba(124,107,255,0.12)' : 'var(--surface)',
                    border: `2px solid ${isSelected ? OPT_ACCENT_RAW : 'var(--border)'}`,
                    borderRadius: 12, cursor: isDisabled ? 'not-allowed' : 'pointer',
                    textAlign: 'left', transition: 'all 0.15s',
                    boxShadow: isSelected ? `0 0 16px rgba(124,107,255,0.25)` : 'none',
                    opacity: (isDisabled && !isSelected) ? 0.5 : 1,
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
                  <span style={{ fontSize: 'clamp(0.8rem, 2.5vw, 0.9rem)', color: isSelected ? 'var(--text)' : 'var(--text-muted)', fontWeight: isSelected ? 600 : 400, flex: 1 }}>
                    {teks}
                  </span>
                  {isSelected && (
                    <span style={{
                      flexShrink: 0, width: 20, height: 20, borderRadius: '50%',
                      background: OPT_ACCENT_RAW, display: 'flex', alignItems: 'center', justifyContent: 'center',
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

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
            <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0} style={{
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

            {currentIdx < soalUjian.length - 1 ? (
              <button onClick={() => setCurrentIdx(i => i + 1)} style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.75rem 1.25rem', borderRadius: 10,
                background: 'var(--accent)', border: 'none', color: '#fff',
                cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit', flexShrink: 0,
              }}>
                Berikutnya <ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={selesaikanUjian} style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.75rem 1.25rem', borderRadius: 10,
                background: 'linear-gradient(135deg, var(--accent-3), #00b386)', border: 'none', color: '#fff',
                cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, fontFamily: 'inherit', flexShrink: 0,
              }}>
                Selesai ✓
              </button>
            )}
          </div>

          <p style={{ textAlign: 'center', marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '0.73rem', color: 'var(--text-muted)' }}>
            {Object.keys(jawaban).length} dari {soalUjian.length} soal dijawab
          </p>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem' }}>
            <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem' }}>
              Navigasi Soal
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(34px, 1fr))',
              gap: '0.4rem',
              maxHeight: soalUjian.length > 60 ? 220 : undefined,
              overflowY: soalUjian.length > 60 ? 'auto' : undefined,
              paddingRight: soalUjian.length > 60 ? '0.25rem' : undefined,
            }}>
              {soalUjian.map((s, i) => (
                <button key={s.id} onClick={() => setCurrentIdx(i)} title={`Soal ${i + 1}`} style={{
                  width: '100%', aspectRatio: '1 / 1', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontFamily: "'Space Mono', monospace", fontSize: '0.7rem', fontWeight: 700,
                  background: i === currentIdx ? 'var(--accent)' : jawaban[s.id] ? 'rgba(0,212,161,0.15)' : 'var(--surface-2)',
                  color: i === currentIdx ? '#fff' : jawaban[s.id] ? 'var(--accent-3)' : 'var(--text-muted)',
                  outline: i === currentIdx ? '2px solid var(--accent)' : '1px solid var(--border)', outlineOffset: 1,
                  transition: 'all 0.15s',
                }}>
                  {i + 1}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.85rem', flexWrap: 'wrap', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: 'var(--accent)', display: 'inline-block' }} /> Sedang dilihat
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: 'rgba(0,212,161,0.15)', border: '1px solid var(--accent-3)', display: 'inline-block' }} /> Sudah dijawab
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'inline-block' }} /> Belum dijawab
              </span>
            </div>
          </div>
        </main>

        <style>{`
          @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
          @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        `}</style>
      </div>
    );
  }

  /* ──── HASIL SCREEN ──── */
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={showRiwayat} style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem',
              borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)',
              color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit',
            }}>
              <ScrollText size={13} /> Riwayat
            </button>
            <button onClick={toggleThemeHandler} style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '0.4rem 0.5rem', cursor: 'pointer', color: 'var(--text-muted)',
            }}>
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
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
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <RotateCcw size={16} /> Ulangi Ujian
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
                          <img src={soal.gambar_url} alt="" style={{
                            maxWidth: '100%', maxHeight: 200, borderRadius: 8,
                            border: '1px solid var(--border)', objectFit: 'contain',
                            background: 'rgba(0,0,0,0.1)', display: 'block',
                          }} />
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

  /* ──── SETUP SCREEN ──── */
  const jumlahOptions: { value: number; label: string }[] = [];
  for (let n = 5; n < soalAll.length; n += 5) jumlahOptions.push({ value: n, label: String(n) });
  jumlahOptions.push({ value: soalAll.length, label: 'Semua Soal' });
  const estimasiDetik = jumlahSoal * 60;

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={showRiwayat} style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem',
            borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit',
          }}>
            <ScrollText size={13} /> Riwayat
          </button>
          <button onClick={toggleThemeHandler} style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '0.4rem 0.5rem', cursor: 'pointer', color: 'var(--text-muted)',
          }}>
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 540, margin: '0 auto', padding: '3rem 1.5rem' }}>

        {/* ── Banner Resume Mati Lampu ── */}
        {hasResume && (
          <div style={{ background: 'rgba(255,179,71,0.08)', border: '1px solid rgba(255,179,71,0.35)', borderRadius: 14, padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <AlertTriangle size={20} color="var(--warning)" />
              <div>
                <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffb347', marginBottom: '0.1rem' }}>Sesi Belum Selesai</p>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Sisa waktu: <span style={{ fontFamily: "'Space Mono', monospace", color: '#ffb347', fontWeight: 700 }}>{formatTimer(resumeSisa)}</span> — klik untuk lanjutkan</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
              <button onClick={mulaiUjian} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', borderRadius: 8, border: 'none', background: '#ffb347', color: '#1a1a1a', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                <Play size={12} /> Lanjut
              </button>
              <button onClick={akhiriSesiGantung} style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} />
              </button>
            </div>
          </div>
        )}

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
            <label style={settingLabel}>Jumlah Soal</label>
            <select
              value={jumlahSoal}
              onChange={(e) => setJumlahSoal(Number(e.target.value))}
              style={{
                width: '100%', padding: '0.7rem 1rem', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--surface-2)',
                color: 'var(--text)', fontFamily: "'Space Mono', monospace", fontSize: '0.9rem',
                fontWeight: 700, cursor: 'pointer', appearance: 'none', outline: 'none',
              }}
            >
              {jumlahOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label === 'Semua Soal' ? `Semua Soal (${opt.value})` : `${opt.label} Soal`}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={settingLabel}>Urutan Soal</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setAcak(false)} style={{ ...settingToggle, border: `2px solid ${!acak ? 'var(--accent-3)' : 'var(--border)'}`, background: !acak ? 'rgba(0,212,161,0.08)' : 'var(--surface-2)', color: !acak ? 'var(--accent-3)' : 'var(--text-muted)' }}>
                <ListOrdered size={16} /> Berurutan
              </button>
              <button onClick={() => setAcak(true)} style={{ ...settingToggle, border: `2px solid ${acak ? 'var(--accent-2)' : 'var(--border)'}`, background: acak ? 'rgba(255,107,157,0.08)' : 'var(--surface-2)', color: acak ? 'var(--accent-2)' : 'var(--text-muted)' }}>
                <Shuffle size={16} /> Acak
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={settingLabel}>Batas Waktu</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button onClick={() => setPakaiWaktu(false)} style={{ ...settingToggle, border: `2px solid ${!pakaiWaktu ? 'var(--accent-3)' : 'var(--border)'}`, background: !pakaiWaktu ? 'rgba(0,212,161,0.08)' : 'var(--surface-2)', color: !pakaiWaktu ? 'var(--accent-3)' : 'var(--text-muted)' }}>
                <BellOff size={15} /> Tanpa Waktu
              </button>
              <button onClick={() => setPakaiWaktu(true)} style={{ ...settingToggle, border: `2px solid ${pakaiWaktu ? 'var(--warning)' : 'var(--border)'}`, background: pakaiWaktu ? 'rgba(255,179,71,0.1)' : 'var(--surface-2)', color: pakaiWaktu ? 'var(--warning)' : 'var(--text-muted)' }}>
                <Timer size={15} /> Pakai Waktu
              </button>
            </div>
            {pakaiWaktu && (
              <div style={{ padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(255,179,71,0.07)', border: '1px solid rgba(255,179,71,0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={14} color="var(--warning)" />
                <span style={{ fontSize: '0.78rem', color: 'var(--warning)', fontWeight: 700 }}>
                  Durasi: {formatDurasiHHMMSS(estimasiDetik)} ({jumlahSoal} soal × 1 menit)
                </span>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={settingLabel}>Feedback Jawaban</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setAlertPerSoal(false)} style={{ ...settingToggle, border: `2px solid ${!alertPerSoal ? 'var(--accent)' : 'var(--border)'}`, background: !alertPerSoal ? 'rgba(124,107,255,0.08)' : 'var(--surface-2)', color: !alertPerSoal ? 'var(--accent)' : 'var(--text-muted)' }}>
                <BellOff size={15} /> Setelah Selesai
              </button>
              <button onClick={() => setAlertPerSoal(true)} style={{ ...settingToggle, border: `2px solid ${alertPerSoal ? 'var(--accent-2)' : 'var(--border)'}`, background: alertPerSoal ? 'rgba(255,107,157,0.08)' : 'var(--surface-2)', color: alertPerSoal ? 'var(--accent-2)' : 'var(--text-muted)' }}>
                <Bell size={15} /> Alert Per Soal
              </button>
            </div>
            {alertPerSoal && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
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

const settingLabel: React.CSSProperties = {
  fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '0.5rem',
};
const settingToggle: React.CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
  padding: '0.75rem', borderRadius: 10, fontWeight: 600, fontFamily: 'inherit', fontSize: '0.85rem',
  cursor: 'pointer', transition: 'all 0.15s',
};
