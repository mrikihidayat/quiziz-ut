'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, CheckCircle2, XCircle, BookOpen,
  Shuffle, ListOrdered, Play, Clock, BellOff, Bell, Timer, ScrollText,
  History, Eye, RotateCcw, Trash2, X, AlertTriangle,
} from 'lucide-react';
import Swal from 'sweetalert2';

function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

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
  ujianId: string;
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

function formatDurasiHHMMSS(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function getNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const swalDark = { background: '#1a1a24', color: '#e8e8f0' };

function svgIcon(path: string, color = '#888', size = 14) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block">${path}</svg>`;
}
const ICON_EYE = '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>';
const ICON_ROTATE_CCW = '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>';
const ICON_TRASH = '<path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>';
const ICON_HISTORY = '<path d="M3 3v5h5"/><path d="M3.05 13a9 9 0 1 0 2.13-5.36L3 8"/><path d="M12 7v5l4 2"/>';

export default function ShareTestClient({ matkulName, penerimaName, soalList, ujianId }: Props) {
  const [fase, setFase] = useState<Fase>('setup');
  const isMobile = typeof window !== 'undefined' ? isMobileBrowser() : false;

  const [acak, setAcak] = useState(false);
  const [jumlahSoal, setJumlahSoal] = useState(Math.min(10, soalList.length));
  const [pakaiWaktu, setPakaiWaktu] = useState(true);
  const [alertPerSoal, setAlertPerSoal] = useState(false);

  const [soalUjian, setSoalUjian] = useState<Soal[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [jawaban, setJawaban] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAlertOpenRef = useRef(false);
  const isTimeUpRef = useRef(false);

  const [isBlackout, setIsBlackout] = useState(false);

  const PROGRESS_KEY = `kuis_progress_${ujianId}`;
  const TIMER_KEY = `kuis_timer_${ujianId}`;
  const HISTORY_KEY = 'kuis_history_list';

  // Check if there's a resumable session
  const [hasResume, setHasResume] = useState(false);
  const [resumeSisa, setResumeSisa] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = localStorage.getItem(TIMER_KEY);
    const p = localStorage.getItem(PROGRESS_KEY);
    if (t && p) {
      const sisa = parseInt(t, 10);
      if (sisa > 0) { setHasResume(true); setResumeSisa(sisa); }
    }
  }, []);

  // ── Anti-Cheat ──
  useEffect(() => {
    const handleContext = (e: MouseEvent) => e.preventDefault();
    const handleSelectStart = (e: Event) => e.preventDefault();
    const handleCopy = (e: ClipboardEvent) => e.preventDefault();

    const triggerScreenshotAlert = () => {
      setIsBlackout(true);
      setTimeout(() => {
        Swal.fire({
          title: '⛔ Tindakan Dilarang!',
          html: `<p style="color:#e8e8f0;font-size:0.9rem">Screenshot terdeteksi.<br/><span style="color:#ff5c5c;font-weight:700">Aktivitas ini telah dicatat.</span></p>`,
          showConfirmButton: true, confirmButtonText: 'Saya Mengerti',
          confirmButtonColor: '#ff5c5c', ...swalDark,
        }).then(() => setIsBlackout(false));
      }, 100);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') setIsBlackout(true);
      else setTimeout(() => setIsBlackout(false), 600);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) || (e.ctrlKey && e.key === 'U')) {
        e.preventDefault(); e.stopPropagation(); return;
      }
      if (e.ctrlKey && ['c','a','x'].includes(e.key.toLowerCase())) { e.preventDefault(); return; }
      const isWinShiftS = e.shiftKey && e.key === 'S' && !e.ctrlKey && !e.altKey;
      const isPrintScreen = e.key === 'PrintScreen';
      const isMacScreenshot = e.metaKey && e.shiftKey && ['3','4','5','s','S'].includes(e.key);
      const isCtrlPrint = e.ctrlKey && e.key === 'PrintScreen';
      if (isPrintScreen || isWinShiftS || isMacScreenshot || isCtrlPrint) {
        e.preventDefault(); triggerScreenshotAlert();
      }
    };

    document.addEventListener('contextmenu', handleContext);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('copy', handleCopy);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('contextmenu', handleContext);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('copy', handleCopy);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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

    // Check localStorage for existing progress (anti-cheat resume)
    let savedJawaban: Record<string, string> = {};
    let savedTime: number | null = null;
    if (typeof window !== 'undefined') {
      try {
        const savedProgress = localStorage.getItem(PROGRESS_KEY);
        if (savedProgress) savedJawaban = JSON.parse(savedProgress);
        const savedTimerStr = localStorage.getItem(TIMER_KEY);
        if (savedTimerStr) savedTime = parseInt(savedTimerStr, 10);
      } catch {}
    }

    setSoalUjian(selected);
    setCurrentIdx(0);
    isTimeUpRef.current = false;

    // Only restore answers that match current question set
    const validIds = new Set(selected.map(s => s.id));
    const filteredJawaban = Object.fromEntries(
      Object.entries(savedJawaban).filter(([k]) => validIds.has(k))
    );
    setJawaban(filteredJawaban);
    setFase('ujian');

    if (pakaiWaktu) {
      const durasi = jumlahSoal * 60;
      const resumeTime = savedTime !== null && savedTime > 0 && savedTime <= durasi ? savedTime : durasi;
      startTimer(resumeTime);
    }

    // Info ramah: progres tersimpan otomatis, aman walau koneksi/sesi terputus
    Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 5000,
      timerProgressBar: true,
      ...swalDark,
    }).fire({
      icon: 'info',
      title: 'Progres Tersimpan Otomatis',
      text: 'Setiap jawaban langsung tersimpan. Kalau sesi terputus di tengah jalan, progresmu otomatis masuk ke Riwayat.',
    });
  }

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
      confirmButtonColor: '#7c6bff', ...swalDark,
    });
    setJawaban(prev => { finishUjian(prev); return prev; });
  }

  async function pilihJawaban(soalId: string, opt: string, soal: Soal) {
    if (isAlertOpenRef.current) return;
    const updated = (prev: Record<string, string>) => ({ ...prev, [soalId]: opt });
    setJawaban(prev => {
      const next = updated(prev);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(next)); } catch {}
      }
      return next;
    });

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
        timer: benar ? 1200 : 3000, timerProgressBar: true,
        showConfirmButton: !benar, confirmButtonText: 'Lanjut',
        confirmButtonColor: '#7c6bff', ...swalDark,
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
    finishUjian(jawaban);
  }

  function finishUjian(snap: Record<string, string>) {
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

    // Save to history
    if (typeof window !== 'undefined') {
      try {
        const existing: HistoryItem[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        const newEntry: HistoryItem = {
          id_pengerjaan: `hist_${Date.now()}`,
          id_ujian: ujianId,
          nama_matkul: matkulName,
          tanggal: getNow(),
          total_soal: soalUjian.length,
          benar, salah, skor, detail_review,
        };
        existing.push(newEntry);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(existing));
      } catch {}
      // Clear temp data
      try { localStorage.removeItem(PROGRESS_KEY); } catch {}
      try { localStorage.removeItem(TIMER_KEY); } catch {}
    }

    const persen = Math.round(skor);
    let icon: 'success' | 'warning' | 'error' = 'success';
    if (persen < 75) icon = 'warning';
    if (persen < 50) icon = 'error';

    Swal.fire({
      icon,
      title: persen >= 75 ? 'Luar Biasa!' : persen >= 50 ? 'Terus Belajar!' : 'Perlu Latihan Lagi!',
      html: `
        <div style="text-align:center;line-height:2">
          <p style="font-size:2.5rem;font-weight:800;color:${persen >= 75 ? '#00d4a1' : persen >= 50 ? '#ffb347' : '#ff5c5c'}">${persen}%</p>
          <p>Benar: <b style="color:#00d4a1">${benar}</b> &nbsp;|&nbsp; Salah: <b style="color:#ff5c5c">${salah}</b></p>
          <p style="font-size:0.82rem;color:#888">dari ${soalUjian.length} soal</p>
        </div>
      `,
      confirmButtonText: 'Lihat Detail', confirmButtonColor: '#7c6bff', ...swalDark,
    });
    setJawaban(snap);
    setFase('hasil');
  }

  function showDetailReview(h: HistoryItem) {
    const entries = Object.entries(h.detail_review);
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
      return `<div style="background:#1a1a24;border:1px solid ${isBenar ? 'rgba(0,212,161,0.2)' : 'rgba(255,92,92,0.2)'};border-radius:10px;padding:0.85rem;margin-bottom:0.65rem;text-align:left">
        <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.5rem">
          <span style="font-family:monospace;font-size:0.65rem;font-weight:700;color:${isBenar ? '#00d4a1' : '#ff5c5c'};background:${isBenar ? 'rgba(0,212,161,0.1)' : 'rgba(255,92,92,0.1)'};padding:0.15rem 0.5rem;border-radius:4px">${isBenar ? '✓ BENAR' : '✗ SALAH'}</span>
          <span style="font-size:0.65rem;color:#555">Soal ${num}</span>
        </div>
        <p style="font-size:0.8rem;color:#e0e0f0;line-height:1.5;margin-bottom:0.5rem">${d.pertanyaan}</p>
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
      ...swalDark,
    }).then(r => {
      if (r.isConfirmed) handleActionSafety(() => startUlangDariHistory(h));
    });
  }

  function startUlangDariHistory(h: HistoryItem) {
    // Rebuild soal list from detail_review, matching by pertanyaan
    const entries = Object.entries(h.detail_review);
    const rebuiltSoal: Soal[] = entries.map(([, d]) => {
      const match = soalList.find(s => s.pertanyaan === d.pertanyaan);
      if (match) return match;
      // fallback: create a pseudo soal from stored data
      return {
        id: `hist_${Math.random()}`,
        pertanyaan: d.pertanyaan,
        pilihan_a: d.opsi_a, pilihan_b: d.opsi_b,
        pilihan_c: d.opsi_c, pilihan_d: d.opsi_d,
        jawaban_benar: d.kunci as 'A' | 'B' | 'C' | 'D',
      };
    });
    setSoalUjian(rebuiltSoal);
    setCurrentIdx(0);
    setJawaban({});
    isTimeUpRef.current = false;
    setFase('ujian');
    if (pakaiWaktu) {
      if (typeof window !== 'undefined') {
        try { localStorage.removeItem(TIMER_KEY); localStorage.removeItem(PROGRESS_KEY); } catch {}
      }
      startTimer(rebuiltSoal.length * 60);
    }
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
        id_ujian: ujianId,
        nama_matkul: matkulName,
        tanggal: getNow(),
        total_soal: total, benar, salah, skor, detail_review,
      });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(existing));
      return true;
    } catch {
      return false;
    }
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
      ...swalDark,
    });
    if (!r.isConfirmed) return;
    if (typeof window === 'undefined') return;

    try {
      const savedProgress = localStorage.getItem(PROGRESS_KEY);
      const savedJawaban: Record<string, string> = savedProgress ? JSON.parse(savedProgress) : {};
      buildAndPushHistory(savedJawaban, soalList);
    } catch {}

    clearSesiCache();
    setHasResume(false);
  }

  /* ── Safety Net: proteksi saat "Ujian Ulang" diklik di tengah sesi aktif ── */
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

    if (!sedangUjianAktif) {
      proceed();
      return;
    }

    Swal.fire({
      icon: 'warning',
      title: 'Tinggalkan Ujian Sekarang?',
      text: 'Tenang, progres ujian Anda saat ini TIDAK AKAN HILANG. Sistem kami menyimpan jawaban Anda secara otomatis setiap detik. Keluar di tengah jalan akan otomatis membukukan progres Anda saat ini ke dalam halaman Riwayat sebagai sesi selesai awal. Yakin ingin lanjut Ujian Ulang?',
      showCancelButton: true,
      confirmButtonText: 'Ya, Lanjut Ujian Ulang',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#7c6bff',
      cancelButtonColor: '#444',
      ...swalDark,
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
      Swal.fire({ title: `<div style="display:flex;align-items:center;justify-content:center;gap:0.5rem">${svgIcon(ICON_HISTORY, '#888', 18)}<span>Riwayat Ujian</span></div>`, text: 'Belum ada riwayat ujian.', confirmButtonColor: '#7c6bff', ...swalDark });
      return;
    }

    const reversed = [...history].reverse().slice(0, 30);

    // Register global handlers so inline onclick in HTML can call them
    (window as any).__riwayatData = reversed;
    (window as any).__showDetail = (idx: number) => {
      Swal.close();
      setTimeout(() => showDetailReview(reversed[idx]), 150);
    };
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
        ...swalDark,
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
      <tr style="border-bottom:1px solid #2a2a3a">
        <td style="padding:0.5rem 0.4rem;font-size:0.72rem;color:#888">${h.tanggal}</td>
        <td style="padding:0.5rem 0.4rem;font-size:0.75rem;color:#e8e8f0;font-weight:600">${h.nama_matkul}</td>
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
      title: `<div style="display:flex;align-items:center;justify-content:center;gap:0.5rem">${svgIcon(ICON_HISTORY, '#888', 18)}<span>Riwayat Ujian</span></div>`,
      html: `<div style="overflow-x:auto;max-height:60vh"><table style="width:100%;border-collapse:collapse;min-width:480px">
        <thead><tr style="border-bottom:1px solid #2a2a3a">
          <th style="padding:0.4rem;font-size:0.65rem;color:#666;text-align:left">Tanggal</th>
          <th style="padding:0.4rem;font-size:0.65rem;color:#666;text-align:left">Matkul</th>
          <th style="padding:0.4rem;font-size:0.65rem;color:#666">Benar</th>
          <th style="padding:0.4rem;font-size:0.65rem;color:#666">Skor</th>
          <th style="padding:0.4rem;font-size:0.65rem;color:#666">Aksi</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`,
      width: 620, confirmButtonText: 'Tutup', confirmButtonColor: '#7c6bff', ...swalDark,
    });
  }

  /* ══════ SETUP FASE ══════ */
  if (fase === 'setup') {
    const jumlahOptions: { value: number; label: string }[] = [];
    for (let n = 5; n < soalList.length; n += 5) jumlahOptions.push({ value: n, label: String(n) });
    jumlahOptions.push({ value: soalList.length, label: 'Semua Soal' });
    const estimasiDetik = jumlahSoal * 60;

    return (
      <div style={{ minHeight: '100vh', background: '#0f0f17', fontFamily: 'system-ui, sans-serif', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' as any }}>
        {isBlackout && <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 99999 }} />}
        <header style={{ background: '#1a1a24', borderBottom: '1px solid #2a2a3a', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/logo.png" alt="Logo" style={{ height: 38, width: 'auto', display: 'block', borderRadius: 6 }} />
            <div>
              <p style={{ fontSize: '0.68rem', color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ujian Latihan</p>
              <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#e8e8f0' }}>{matkulName}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={showRiwayat} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', borderRadius: 8, background: '#12121c', border: '1px solid #2a2a3a', color: '#888', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit' }}>
              <ScrollText size={13} /><span style={{ display: isMobile ? 'none' : 'inline' }}>Riwayat</span>
            </button>
            <span style={{ fontSize: '0.72rem', color: '#888', background: '#12121c', border: '1px solid #2a2a3a', borderRadius: 6, padding: '0.25rem 0.6rem' }}>
              👤 {penerimaName}
            </span>
          </div>
        </header>

        <main style={{ maxWidth: 520, margin: '0 auto', padding: '2.5rem 1.25rem' }}>

          {/* ── Banner Resume Mati Lampu ── */}
          {hasResume && (
            <div style={{ background: 'rgba(255,179,71,0.08)', border: '1px solid rgba(255,179,71,0.35)', borderRadius: 14, padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <AlertTriangle size={20} color="#ffb347" />
                <div>
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffb347', marginBottom: '0.1rem' }}>Sesi Belum Selesai</p>
                  <p style={{ fontSize: '0.72rem', color: '#888' }}>Sisa waktu: <span style={{ fontFamily: 'monospace', color: '#ffb347', fontWeight: 700 }}>{formatTimer(resumeSisa)}</span> — klik untuk lanjutkan</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                <button onClick={mulaiUjian} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', borderRadius: 8, border: 'none', background: '#ffb347', color: '#1a1a1a', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Play size={12} /> Lanjut
                </button>
                <button onClick={akhiriSesiGantung} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.45rem', borderRadius: 8, border: '1px solid #2a2a3a', background: '#12121c', color: '#666', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          <div style={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 20, padding: '2rem' }}>
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
              <select
                value={jumlahSoal}
                onChange={(e) => setJumlahSoal(Number(e.target.value))}
                style={{
                  width: '100%', padding: '0.7rem 1rem', borderRadius: 10,
                  border: '1px solid #2a2a3a', background: '#12121c',
                  color: '#e8e8f0', fontFamily: 'monospace', fontSize: '0.9rem',
                  fontWeight: 700, cursor: 'pointer', appearance: 'none',
                  outline: 'none',
                }}
              >
                {jumlahOptions.map(opt => (
                  <option key={opt.value} value={opt.value} style={{ background: '#1a1a24', color: '#e8e8f0' }}>
                    {opt.label === 'Semua Soal' ? `Semua Soal (${opt.value})` : `${opt.label} Soal`}
                  </option>
                ))}
              </select>
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

            {/* Batas Waktu — otomatis */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Batas Waktu</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <button onClick={() => setPakaiWaktu(false)} style={{ ...toggleBtn, border: `2px solid ${!pakaiWaktu ? '#00d4a1' : '#2a2a3a'}`, background: !pakaiWaktu ? 'rgba(0,212,161,0.08)' : '#12121c', color: !pakaiWaktu ? '#00d4a1' : '#666' }}>
                  <BellOff size={15} /> Tanpa Waktu
                </button>
                <button onClick={() => setPakaiWaktu(true)} style={{ ...toggleBtn, border: `2px solid ${pakaiWaktu ? '#ffb347' : '#2a2a3a'}`, background: pakaiWaktu ? 'rgba(255,179,71,0.08)' : '#12121c', color: pakaiWaktu ? '#ffb347' : '#666' }}>
                  <Timer size={15} /> Pakai Waktu
                </button>
              </div>
              {pakaiWaktu && (
                <div style={{ padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(255,179,71,0.07)', border: '1px solid rgba(255,179,71,0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={14} color="#ffb347" />
                  <span style={{ fontSize: '0.78rem', color: '#ffb347', fontWeight: 700 }}>
                    Durasi: {formatDurasiHHMMSS(estimasiDetik)} ({jumlahSoal} soal × 1 menit)
                  </span>
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

  /* ══════ HASIL FASE ══════ */
  if (fase === 'hasil') {
    const snap = { ...jawaban };
    const benar = soalUjian.filter(s => snap[s.id] === s.jawaban_benar).length;
    const salah = soalUjian.length - benar;
    const persen = Math.round((benar / soalUjian.length) * 100);
    const soalSalah = soalUjian.filter(s => snap[s.id] !== s.jawaban_benar);

    return (
      <div style={{ minHeight: '100vh', background: '#0f0f17', padding: '0 0 4rem', fontFamily: 'system-ui, sans-serif', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' as any }}>
        {isBlackout && <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 99999 }} />}
        <header style={{ background: '#1a1a24', borderBottom: '1px solid #2a2a3a', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/logo.png" alt="Logo" style={{ height: 38, width: 'auto', display: 'block', borderRadius: 6 }} />
            <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#e8e8f0' }}>Hasil Ujian — {matkulName}</p>
          </div>
          <button onClick={showRiwayat} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', borderRadius: 8, background: '#12121c', border: '1px solid #2a2a3a', color: '#888', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit' }}>
            <ScrollText size={13} /> Riwayat
          </button>
        </header>

        <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.25rem' }}>
          <div style={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 18, padding: '2rem', textAlign: 'center', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.72rem', color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Hasil Ujian — {penerimaName}</p>
            <p style={{ fontSize: '3.5rem', fontWeight: 800, color: persen >= 75 ? '#00d4a1' : persen >= 50 ? '#ffb347' : '#ff5c5c', lineHeight: 1, fontFamily: 'monospace' }}>{persen}%</p>
            <p style={{ color: '#555', fontSize: '0.82rem', marginTop: '0.35rem' }}>{matkulName}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1.5rem' }}>
              <span style={{ color: '#00d4a1', fontWeight: 700 }}>✓ {benar} Benar</span>
              <span style={{ color: '#333' }}>|</span>
              <span style={{ color: '#ff5c5c', fontWeight: 700 }}>✗ {salah} Salah</span>
              <span style={{ color: '#333' }}>|</span>
              <span style={{ color: '#666' }}>{soalUjian.length} Soal</span>
            </div>
            <button onClick={() => setFase('setup')} style={{ marginTop: '1.5rem', padding: '0.7rem 1.5rem', background: 'linear-gradient(135deg, #7c6bff, #ff6b9d)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <RotateCcw size={16} /> Ulangi / Setting Ulang
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

  /* ══════ UJIAN FASE ══════ */
  const soal = soalUjian[currentIdx];
  const answered = jawaban[soal.id];
  const progress = ((currentIdx + 1) / soalUjian.length) * 100;
  const answeredCount = Object.keys(jawaban).length;
  const isWarning = pakaiWaktu && timeLeft <= 60 && timeLeft > 30;
  const isDanger = pakaiWaktu && timeLeft <= 30 && timeLeft > 0;

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f17', fontFamily: 'system-ui, sans-serif', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' as any }}>
      {isBlackout && <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 99999 }} />}
      <header style={{ background: '#1a1a24', borderBottom: '1px solid #2a2a3a', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <img src="/logo.png" alt="Logo" style={{ height: 34, width: 'auto', display: 'block', borderRadius: 6 }} />
          <div>
            <p style={{ fontSize: '0.68rem', color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ujian Latihan</p>
            <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#e8e8f0' }}>{matkulName}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {pakaiWaktu && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', borderRadius: 8, background: isDanger ? 'rgba(255,92,92,0.15)' : isWarning ? 'rgba(255,179,71,0.15)' : '#12121c', border: `1px solid ${isDanger ? 'rgba(255,92,92,0.4)' : isWarning ? 'rgba(255,179,71,0.4)' : '#2a2a3a'}` }}>
              <Clock size={13} color={isDanger ? '#ff5c5c' : isWarning ? '#ffb347' : '#555'} />
              <span style={{ fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 700, color: isDanger ? '#ff5c5c' : isWarning ? '#ffb347' : '#888', animation: isDanger ? 'pulse 0.7s ease-in-out infinite' : 'none' }}>
                {formatTimer(timeLeft)}
              </span>
            </div>
          )}
          <button onClick={showRiwayat} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.65rem', borderRadius: 8, background: '#12121c', border: '1px solid #2a2a3a', color: '#888', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit' }}>
            <ScrollText size={13} /><span style={{ display: isMobile ? 'none' : 'inline' }}>Riwayat</span>
          </button>
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
      {pakaiWaktu && (
        <div style={{ height: 3, background: '#1a1a24' }}>
          <div style={{ height: '100%', width: `${(timeLeft / (jumlahSoal * 60)) * 100}%`, background: isDanger ? '#ff5c5c' : isWarning ? '#ffb347' : '#00d4a1', transition: 'width 1s linear, background 0.3s' }} />
        </div>
      )}

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
          <p style={{ fontSize: 'clamp(0.85rem, 2.5vw, 1rem)', fontWeight: 600, color: '#e8e8f0', lineHeight: 1.7, marginTop: '0.25rem' }}>{soal.pertanyaan}</p>
          {soal.gambar_url && <img src={soal.gambar_url} alt="" style={{ marginTop: '1rem', maxWidth: '100%', maxHeight: 280, borderRadius: 10, border: '1px solid #2a2a3a', display: 'block', margin: '1rem auto 0' }} />}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', marginBottom: '2rem' }}>
          {OPTS.map(opt => {
            const teks = soal[`pilihan_${opt.toLowerCase()}` as keyof Soal] as string;
            const isSelected = answered === opt;
            const isDisabled = isTimeUpRef.current;
            return (
              <button key={opt} onClick={() => !isDisabled && pilihJawaban(soal.id, opt, soal)} disabled={isDisabled} style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '1rem 1.25rem',
                background: isSelected ? 'rgba(124,107,255,0.12)' : '#1a1a24',
                border: `2px solid ${isSelected ? '#7c6bff' : '#2a2a3a'}`,
                borderRadius: 12, cursor: isDisabled ? 'not-allowed' : 'pointer', textAlign: 'left',
                transition: 'all 0.15s', boxShadow: isSelected ? '0 0 16px rgba(124,107,255,0.2)' : 'none',
                fontFamily: 'inherit', opacity: isDisabled && !isSelected ? 0.5 : 1,
              }}>
                <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: isSelected ? '#7c6bff' : '#12121c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700, color: isSelected ? '#fff' : '#666', transition: 'all 0.15s' }}>
                  {opt}
                </span>
                <span style={{ fontSize: 'clamp(0.8rem, 2.5vw, 0.9rem)', color: isSelected ? '#e8e8f0' : '#aaa', fontWeight: isSelected ? 600 : 400, flex: 1, textAlign: 'left' }}>
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

        <p style={{ textAlign: 'center', marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '0.73rem', color: '#444' }}>
          {answeredCount} dari {soalUjian.length} soal dijawab
        </p>

        {/* ── Panel Navigasi Soal: grid penuh, scrollable untuk soal banyak ── */}
        <div style={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 14, padding: '1rem' }}>
          <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem' }}>
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
                fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 700,
                background: i === currentIdx ? '#7c6bff' : jawaban[s.id] ? 'rgba(0,212,161,0.15)' : '#12121c',
                color: i === currentIdx ? '#fff' : jawaban[s.id] ? '#00d4a1' : '#444',
                outline: i === currentIdx ? '2px solid #7c6bff' : '1px solid #2a2a3a', outlineOffset: 1,
                transition: 'all 0.15s',
              }}>
                {i + 1}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.85rem', flexWrap: 'wrap', fontSize: '0.68rem', color: '#666' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 12, height: 12, borderRadius: 4, background: '#7c6bff', display: 'inline-block' }} /> Sedang dilihat
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 12, height: 12, borderRadius: 4, background: 'rgba(0,212,161,0.15)', border: '1px solid #00d4a1', display: 'inline-block' }} /> Sudah dijawab
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 12, height: 12, borderRadius: 4, background: '#12121c', border: '1px solid #2a2a3a', display: 'inline-block' }} /> Belum dijawab
            </span>
          </div>
        </div>
      </main>

      <footer style={{ borderTop: '1px solid #2a2a3a', padding: '0.875rem 1.5rem', textAlign: 'center', color: '#444', fontSize: '0.72rem' }}>
        Dibuat oleh <span style={{ fontWeight: 700, color: '#666' }}>M. Riki Hidayat</span> — Mahasiswa SI UT
      </footer>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        *, *::before, *::after {
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          user-select: none !important;
          -webkit-touch-callout: none !important;
          -webkit-tap-highlight-color: transparent !important;
        }
        @media print { html, body { display: none !important; } }
      `}</style>
    </div>
  );
}

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
