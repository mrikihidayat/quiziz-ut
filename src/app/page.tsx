'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { initTheme, setTheme } from '@/lib/theme';
import Link from 'next/link';
import {
  Upload, BookOpen, Plus, Loader2, Sparkles,
  FileText, ChevronRight, Trash2, AlertCircle, CheckCircle2,
  Sun, Moon, ClipboardList, ClipboardPaste, Share2, Eye,
  ShieldCheck, ShieldOff, Copy, ExternalLink, KeyRound,
} from 'lucide-react';
import Swal from 'sweetalert2';

type Matkul = { id: string; nama_matkul: string; created_at: string };
type Status = 'idle' | 'loading' | 'success' | 'error';
type InputMode = 'pdf' | 'text';
type ShareToken = {
  id: string;
  token: string;
  penerima_nama: string;
  is_used: boolean;
  saved_device_agent: string | null;
  created_at: string;
  matkul: { nama_matkul: string } | null;
};

export default function AdminDashboard() {
  const [matkulList, setMatkulList] = useState<Matkul[]>([]);
  const [selectedMatkul, setSelectedMatkul] = useState('');
  const [newMatkulName, setNewMatkulName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('pdf');
  const [uploadStatus, setUploadStatus] = useState<Status>('idle');
  const [addStatus, setAddStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [theme, setThemeState] = useState<'dark' | 'light'>('dark');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [shareTokens, setShareTokens] = useState<ShareToken[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);

  // === OTP GATEKEEPER STATE ===
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isOtpSent, setIsOtpSent] = useState<boolean>(false);
  const [otpInput, setOtpInput] = useState<string>('');
  const [otpLoading, setOtpLoading] = useState<boolean>(false);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) setIsAuthenticated(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const t = initTheme();
    setThemeState(t);
    fetchMatkul();
  }, [isAuthenticated]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  }

  function swalTheme() {
    return {
      background: theme === 'dark' ? '#1a1a24' : '#ffffff',
      color: theme === 'dark' ? '#e8e8f0' : '#1a1a2e',
    };
  }

  async function fetchMatkul() {
    const { data } = await supabase.from('matkul').select('*').order('created_at', { ascending: false });
    if (data) setMatkulList(data);
  }

  async function handleAddMatkul(e: React.FormEvent) {
    e.preventDefault();
    if (!newMatkulName.trim()) return;
    setAddStatus('loading');
    const { data, error } = await supabase
      .from('matkul')
      .insert([{ nama_matkul: newMatkulName.trim() }])
      .select();
    if (!error && data) {
      setMatkulList([data[0], ...matkulList]);
      setNewMatkulName('');
      setAddStatus('success');
      Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: `Mata kuliah "${data[0].nama_matkul}" berhasil ditambahkan.`,
        timer: 2000,
        showConfirmButton: false,
        ...swalTheme(),
      });
      setTimeout(() => setAddStatus('idle'), 2000);
    } else {
      setAddStatus('error');
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal menambahkan mata kuliah.', ...swalTheme() });
    }
  }

  async function handleDeleteMatkul(id: string, nama: string) {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Hapus Mata Kuliah?',
      html: `Mata kuliah <b>"${nama}"</b> beserta seluruh soalnya akan dihapus permanen.`,
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#ff5c5c',
      cancelButtonColor: '#7c6bff',
      ...swalTheme(),
    });
    if (!result.isConfirmed) return;
    const { error } = await supabase.from('matkul').delete().eq('id', id);
    if (!error) {
      setMatkulList(matkulList.filter(m => m.id !== id));
      Swal.fire({ icon: 'success', title: 'Dihapus!', text: `"${nama}" berhasil dihapus.`, timer: 1800, showConfirmButton: false, ...swalTheme() });
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedMatkul) {
      Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Pilih Mata Kuliah terlebih dahulu.', ...swalTheme() });
      return;
    }
    if (inputMode === 'pdf' && !file) {
      Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Pilih file PDF terlebih dahulu.', ...swalTheme() });
      return;
    }
    if (inputMode === 'text' && !pastedText.trim()) {
      Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Tempel teks soal terlebih dahulu.', ...swalTheme() });
      return;
    }

    setUploadStatus('loading');
    setMessage(inputMode === 'pdf'
      ? 'Mengekstrak teks PDF dan mengirim ke Gemini AI...'
      : 'Mengirim teks ke Gemini AI untuk diproses...'
    );

    const formData = new FormData();
    formData.append('matkul_id', selectedMatkul);
    formData.append('mode', inputMode);

    if (inputMode === 'pdf' && file) {
      formData.append('file', file);
    } else {
      formData.append('raw_text', pastedText);
    }

    try {
      const res = await fetch('/api/upload-pdf', { method: 'POST', body: formData });
      const result = await res.json();
      if (res.ok) {
        const skipMsg = result.skipped > 0 ? `\n${result.skipped} soal dilewati karena format tidak valid.` : '';
        setMessage(`Berhasil! ${result.count} soal berhasil dimasukkan ke database.${skipMsg}`);
        setUploadStatus('success');
        setFile(null);
        setPastedText('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          html: `<b>${result.count} soal</b> berhasil dimasukkan ke database.${skipMsg ? `<br><small style="opacity:0.7">${skipMsg}</small>` : ''}`,
          ...swalTheme(),
        });
      } else {
        setMessage(result.error || 'Terjadi kesalahan tidak diketahui.');
        setUploadStatus('error');
        Swal.fire({ icon: 'error', title: 'Proses Gagal', text: result.error || 'Terjadi kesalahan tidak diketahui.', ...swalTheme() });
      }
    } catch {
      setMessage('Gagal terhubung ke server. Periksa koneksi internet.');
      setUploadStatus('error');
      Swal.fire({ icon: 'error', title: 'Koneksi Error', text: 'Gagal terhubung ke server.', ...swalTheme() });
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === 'application/pdf') setFile(dropped);
  }

  async function fetchShareTokens() {
    const res = await fetch('/api/share');
    const data = await res.json();
    if (data.tokens) setShareTokens(data.tokens);
  }

  async function handleGenerateLink(matkulId: string, matkulNama: string) {
    const { value: nama } = await Swal.fire({
      title: `Generate Link untuk "${matkulNama}"`,
      input: 'text',
      inputPlaceholder: 'Nama penerima (misal: Siti)',
      inputAttributes: { autocomplete: 'off' },
      showCancelButton: true,
      confirmButtonText: 'Generate',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#7c6bff',
      ...swalTheme(),
      inputValidator: (v) => (!v?.trim() ? 'Nama penerima tidak boleh kosong!' : null),
    });
    if (!nama) return;

    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matkul_id: matkulId, penerima_nama: nama }),
    });
    const data = await res.json();
    if (!res.ok) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: data.error, ...swalTheme() });
      return;
    }

    const link = `${window.location.origin}/share-test?token=${data.token}`;
    await Swal.fire({
      icon: 'success',
      title: 'Link Berhasil Dibuat!',
      html: `
        <p style="margin-bottom:0.75rem;font-size:0.85rem;opacity:0.8">Bagikan link ini kepada <b>${nama}</b>:</p>
        <div style="display:flex;align-items:center;gap:0.5rem;background:#12121c;border:1px solid #2a2a3a;border-radius:8px;padding:0.6rem 0.85rem;word-break:break-all;font-family:monospace;font-size:0.78rem;color:#7c6bff;">
          ${link}
        </div>
        <button onclick="navigator.clipboard.writeText('${link}').then(()=>document.getElementById('copied-msg').style.display='block')" 
          style="margin-top:0.75rem;padding:0.5rem 1rem;background:#7c6bff;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.82rem;">
          Salin Link
        </button>
        <p id="copied-msg" style="display:none;margin-top:0.4rem;font-size:0.78rem;color:#00d4a1;">✓ Tersalin!</p>
      `,
      confirmButtonText: 'Tutup',
      confirmButtonColor: '#7c6bff',
      ...swalTheme(),
    });
  }

  async function handleViewLinks() {
    await fetchShareTokens();
    setShowShareModal(true);
  }

  async function handleDeleteToken(id: string, nama: string) {
    const r = await Swal.fire({
      icon: 'warning',
      title: 'Hapus Link Ini?',
      html: `Link milik <b>${nama}</b> akan dihapus permanen. Jika mereka membuka link lama, akan muncul pesan "Link tidak valid!".`,
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#ff5c5c',
      cancelButtonColor: '#7c6bff',
      ...swalTheme(),
    });
    if (!r.isConfirmed) return;

    const res = await fetch('/api/share', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setShareTokens(prev => prev.filter(t => t.id !== id));
      Swal.fire({ icon: 'success', title: 'Dihapus!', text: 'Link berhasil dihapus.', timer: 1800, showConfirmButton: false, ...swalTheme() });
    }
  }

  async function handleResetToken(id: string, nama: string) {
    const r = await Swal.fire({
      icon: 'question',
      title: 'Buka Blokir Perangkat?',
      html: `Token milik <b>${nama}</b> akan di-reset. Mereka bisa mengakses ulang dari perangkat baru.`,
      showCancelButton: true,
      confirmButtonText: 'Ya, Reset',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#ffb347',
      ...swalTheme(),
    });
    if (!r.isConfirmed) return;

    const res = await fetch('/api/share', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setShareTokens(prev => prev.map(t => t.id === id ? { ...t, is_used: false, saved_device_agent: null } : t));
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Token berhasil di-reset.', timer: 1800, showConfirmButton: false, ...swalTheme() });
    }
  }

  // === OTP HANDLER FUNCTIONS ===
  async function handleMintaOtp() {
    setOtpLoading(true);
    Swal.fire({
      title: 'Mengirim OTP...',
      text: 'Silakan tunggu, kode sedang dikirim ke email admin.',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      const res = await fetch('/api/admin/send-otp', { method: 'POST' });
      if (res.ok) {
        setIsOtpSent(true);
        Swal.fire({ icon: 'success', title: 'OTP Terkirim! 🚀', text: 'Periksa kotak masuk email admin.', timer: 2000, showConfirmButton: false });
      } else {
        Swal.fire('Gagal!', 'Gagal mengirim email OTP, hubungi server.', 'error');
      }
    } catch {
      Swal.fire('Error!', 'Terjadi gangguan koneksi jaringan.', 'error');
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleVerifikasiOtp(e: React.FormEvent | React.MouseEvent) {
    e.preventDefault();
    if (otpInput.length < 6) return Swal.fire('Peringatan!', 'Masukkan 6 digit angka lengkap.', 'warning');
    setOtpLoading(true);
    try {
      const res = await fetch('/api/admin/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp_input: otpInput }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('admin_token', data.token);
        setIsAuthenticated(true);
        Swal.fire({ icon: 'success', title: 'Akses Diberikan! 🔓', text: 'Selamat datang kembali di Dashboard Admin.', timer: 1500, showConfirmButton: false });
      } else {
        Swal.fire('Akses Ditolak!', data.error || 'Kode salah.', 'error');
      }
    } catch {
      Swal.fire('Error!', 'Terjadi kesalahan verifikasi jaringan.', 'error');
    } finally {
      setOtpLoading(false);
    }
  }

  // === RENDER GATEKEEPER JIKA BELUM LOGIN ===
  if (!isAuthenticated) {
    return (
      <>
        <style>{`
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(24px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes floatOrb {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(30px, -20px) scale(1.05); }
            66% { transform: translate(-20px, 15px) scale(0.97); }
          }
          @keyframes spinLoader {
            to { transform: rotate(360deg); }
          }
          @keyframes pulse-ring {
            0% { box-shadow: 0 0 0 0 rgba(124,107,255,0.4); }
            70% { box-shadow: 0 0 0 18px rgba(124,107,255,0); }
            100% { box-shadow: 0 0 0 0 rgba(124,107,255,0); }
          }
          @keyframes shimmer {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
          .otp-card {
            animation: fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) both;
          }
          .otp-input-box:focus {
            border-color: #7c6bff !important;
            box-shadow: 0 0 0 3px rgba(124,107,255,0.2) !important;
          }
          .otp-btn-primary:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 8px 30px rgba(124,107,255,0.45) !important;
          }
          .otp-btn-primary:active:not(:disabled) {
            transform: translateY(0);
          }
          .otp-btn-primary {
            transition: transform 0.18s ease, box-shadow 0.18s ease !important;
          }
          .icon-pulse { animation: pulse-ring 2.2s cubic-bezier(0.455,0.03,0.515,0.955) infinite; }
          .spin { animation: spinLoader 0.85s linear infinite; }
          .shimmer-text {
            background: linear-gradient(90deg, #a78bfa 0%, #f472b6 30%, #7c6bff 60%, #a78bfa 100%);
            background-size: 200% auto;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: shimmer 3s linear infinite;
          }
          .dot-grid {
            background-image: radial-gradient(circle, rgba(124,107,255,0.18) 1px, transparent 1px);
            background-size: 28px 28px;
          }
        `}</style>

        {/* Full-screen container */}
        <div style={{
          minHeight: '100vh', width: '100%',
          background: '#0a0a0f',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
          padding: '1rem',
        }}>
          {/* Dot grid background */}
          <div className="dot-grid" style={{ position: 'absolute', inset: 0, opacity: 0.6 }} />

          {/* Ambient glow orbs */}
          <div style={{
            position: 'absolute', width: 480, height: 480,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,107,255,0.18) 0%, transparent 70%)',
            top: '-80px', left: '-100px',
            animation: 'floatOrb 9s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', width: 400, height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,107,157,0.12) 0%, transparent 70%)',
            bottom: '-60px', right: '-80px',
            animation: 'floatOrb 12s ease-in-out infinite reverse',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', width: 300, height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,212,161,0.08) 0%, transparent 70%)',
            top: '40%', right: '15%',
            animation: 'floatOrb 7s ease-in-out infinite 2s',
            pointerEvents: 'none',
          }} />

          {/* Card */}
          <div className="otp-card" style={{
            position: 'relative', zIndex: 10,
            width: '100%', maxWidth: 420,
            background: 'rgba(20,20,32,0.85)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(124,107,255,0.2)',
            borderRadius: 24,
            padding: '2.75rem 2.25rem',
            textAlign: 'center',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.04) inset, 0 32px 80px rgba(0,0,0,0.6)',
          }}>
            {/* Top label */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(124,107,255,0.1)',
              border: '1px solid rgba(124,107,255,0.2)',
              borderRadius: 99, padding: '4px 14px',
              marginBottom: '1.75rem',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c6bff', boxShadow: '0 0 6px #7c6bff' }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#a78bfa', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Secure Admin Access
              </span>
            </div>

            {/* Icon */}
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(124,107,255,0.2), rgba(255,107,157,0.1))',
              border: '1px solid rgba(124,107,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.5rem',
              color: isOtpSent ? '#00d4a1' : '#a78bfa',
            }} className={!isOtpSent ? 'icon-pulse' : ''}>
              {isOtpSent ? <ShieldCheck size={34} strokeWidth={1.5} /> : <KeyRound size={34} strokeWidth={1.5} />}
            </div>

            {/* Title */}
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 8, lineHeight: 1.2 }}>
              <span className="shimmer-text">
                {isOtpSent ? 'Masukkan Kode OTP' : 'Verifikasi Admin'}
              </span>
            </h1>
            <p style={{ color: 'rgba(170,170,200,0.7)', fontSize: '0.875rem', marginBottom: '2rem', lineHeight: 1.6 }}>
              {isOtpSent
                ? 'Kode 6 digit telah dikirim ke email tujuan admin. Segera masukkan sebelum kedaluwarsa.'
                : 'Dashboard ini dilindungi OTP. Klik tombol di bawah untuk mengirim kode akses ke email admin.'}
            </p>

            {/* Content based on state */}
            {!isOtpSent ? (
              <button
                onClick={handleMintaOtp}
                disabled={otpLoading}
                className="otp-btn-primary"
                style={{
                  width: '100%', padding: '0.875rem 1.5rem',
                  background: otpLoading
                    ? 'rgba(124,107,255,0.4)'
                    : 'linear-gradient(135deg, #7c6bff 0%, #9b59e8 100%)',
                  color: '#fff', border: 'none', borderRadius: 14,
                  fontWeight: 700, fontSize: '0.975rem',
                  cursor: otpLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: '0 4px 20px rgba(124,107,255,0.3)',
                  letterSpacing: '0.01em',
                }}
              >
                {otpLoading
                  ? <><Loader2 size={18} className="spin" /> Mengirim ke email...</>
                  : <><KeyRound size={17} strokeWidth={2.2} /> Kirim Kode OTP ke Email</>}
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* OTP digit input */}
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="· · · · · ·"
                  className="otp-input-box"
                  style={{
                    width: '100%', padding: '1rem',
                    textAlign: 'center',
                    letterSpacing: '0.6em',
                    fontSize: '1.75rem',
                    fontFamily: "'Space Mono', monospace",
                    fontWeight: 700,
                    background: 'rgba(10,10,18,0.8)',
                    border: '1.5px solid rgba(124,107,255,0.25)',
                    borderRadius: 14,
                    color: '#e8e8f0',
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    boxSizing: 'border-box',
                  }}
                  autoFocus
                />

                <button
                  onClick={handleVerifikasiOtp}
                  disabled={otpLoading || otpInput.length < 6}
                  className="otp-btn-primary"
                  style={{
                    width: '100%', padding: '0.875rem',
                    background: (otpLoading || otpInput.length < 6)
                      ? 'rgba(0,180,130,0.3)'
                      : 'linear-gradient(135deg, #00d4a1 0%, #00a882 100%)',
                    color: '#fff', border: 'none', borderRadius: 14,
                    fontWeight: 700, fontSize: '0.975rem',
                    cursor: (otpLoading || otpInput.length < 6) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    boxShadow: (otpLoading || otpInput.length < 6) ? 'none' : '0 4px 20px rgba(0,212,161,0.3)',
                    letterSpacing: '0.01em',
                  }}
                >
                  {otpLoading
                    ? <><Loader2 size={18} className="spin" /> Memverifikasi...</>
                    : <><ShieldCheck size={17} strokeWidth={2.2} /> Verifikasi & Masuk</>}
                </button>

                <button
                  onClick={() => { setIsOtpSent(false); setOtpInput(''); }}
                  style={{
                    background: 'none', border: 'none',
                    color: 'rgba(170,170,200,0.5)',
                    fontSize: '0.8rem', cursor: 'pointer',
                    padding: '4px 0',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(170,170,200,0.9)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(170,170,200,0.5)')}
                >
                  ← Minta kode baru
                </button>
              </div>
            )}

            {/* Footer note */}
            <p style={{ marginTop: '1.75rem', fontSize: '0.72rem', color: 'rgba(120,120,160,0.5)', letterSpacing: '0.03em' }}>
              Sistem Kuis UT · Akses terbatas untuk admin
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '0' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: '0.9rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap' as const,
        gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={18} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Space Mono', monospace", fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px' }}>
              UAS Simulasi
            </h1>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 1 }}>Admin Panel — AI Question Engine</p>
          </div>
        </div>
        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{
            background: 'rgba(124, 107, 255, 0.1)',
            borderRadius: 8,
            padding: '0.45rem 0.8rem',
            border: '1px solid rgba(124, 107, 255, 0.3)',
            fontSize: '0.7rem',
            color: 'var(--accent)',
            fontWeight: 600,
          }}>
            Gemini 2.5 Flash
          </div>
          <button onClick={handleViewLinks} title="Lihat semua share link" style={{
            background: 'rgba(0, 212, 161, 0.1)',
            border: '1px solid rgba(0, 212, 161, 0.3)',
            borderRadius: 8,
            padding: '0.45rem 0.8rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--accent-3)',
            fontSize: '0.75rem',
            fontWeight: 600,
            fontFamily: 'inherit',
          }}>
            <Eye size={14} /> View Link
          </button>
          <button onClick={toggleTheme} title="Ganti Tema" style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '0.45rem 0.6rem',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center',
            color: 'var(--text-muted)',
            transition: 'all 0.2s',
          }}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>
  

      <main className="dashboard-main">

        {/* Panel Kiri: Manajemen Matkul */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '1.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <BookOpen size={16} color="var(--accent)" />
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>Mata Kuliah</h2>
            </div>

            <form onSubmit={handleAddMatkul} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="Nama mata kuliah baru..."
                value={newMatkulName}
                onChange={(e) => setNewMatkulName(e.target.value)}
                style={{
                  flex: 1,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0.6rem 0.875rem',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <button type="submit" disabled={addStatus === 'loading'} style={{
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '0.6rem 1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                fontFamily: 'inherit',
              }}>
                {addStatus === 'loading' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
                Tambah
              </button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 380, overflowY: 'auto' }}>
              {matkulList.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '2rem 0' }}>
                  Belum ada mata kuliah. Tambahkan dulu.
                </p>
              )}
              {matkulList.map((m) => (
                <div key={m.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '0.75rem 1rem',
                  transition: 'border-color 0.2s',
                }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', flex: 1, minWidth: '120px' }}>{m.nama_matkul}</span>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button onClick={() => handleGenerateLink(m.id, m.nama_matkul)} style={{
                      display: 'flex', alignItems: 'center', gap: '0.25rem',
                      fontSize: '0.75rem', fontWeight: 600, color: '#a78bfa',
                      padding: '0.3rem 0.75rem',
                      background: 'rgba(124, 107, 255, 0.1)',
                      border: '1px solid rgba(124, 107, 255, 0.3)',
                      borderRadius: 6,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      fontFamily: 'inherit',
                    }}>
                      <Share2 size={12} /> Share
                    </button>
                    <Link href={`/ujian/${m.id}`} style={{
                      display: 'flex', alignItems: 'center', gap: '0.25rem',
                      fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-2)',
                      textDecoration: 'none', padding: '0.3rem 0.75rem',
                      background: 'rgba(255, 107, 157, 0.1)',
                      border: '1px solid rgba(255, 107, 157, 0.3)',
                      borderRadius: 6,
                      whiteSpace: 'nowrap',
                    }}>
                      <ClipboardList size={12} /> Tes
                    </Link>
                    <Link href={`/admin/matkul/${m.id}`} style={{
                      display: 'flex', alignItems: 'center', gap: '0.25rem',
                      fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-3)',
                      textDecoration: 'none', padding: '0.3rem 0.75rem',
                      background: 'rgba(0, 212, 161, 0.1)',
                      border: '1px solid rgba(0, 212, 161, 0.25)',
                      borderRadius: 6,
                    }}>
                      Kelola <ChevronRight size={12} />
                    </Link>
                    <button onClick={() => handleDeleteMatkul(m.id, m.nama_matkul)} style={{
                      background: 'rgba(255, 92, 92, 0.1)',
                      border: '1px solid rgba(255, 92, 92, 0.25)',
                      borderRadius: 6,
                      padding: '0.3rem 0.5rem',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center',
                      color: 'var(--danger)',
                    }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel Kanan: AI Auto-Generate Soal */}
        <div>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '1.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Sparkles size={16} color="var(--accent-2)" />
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>AI Auto-Generate Soal</h2>
            </div>

            {/* ── Dual-Tab UI ── */}
            <div style={{
              display: 'flex',
              gap: '0.25rem',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '0.25rem',
              marginBottom: '1.25rem',
            }}>
              {([
                { key: 'pdf', label: 'Upload PDF', icon: <Upload size={13} /> },
                { key: 'text', label: 'Tempel Teks Langsung', icon: <ClipboardPaste size={13} /> },
              ] as { key: InputMode; label: string; icon: React.ReactNode }[]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setInputMode(tab.key); setMessage(''); setUploadStatus('idle'); }}
                  style={{
                    flex: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    padding: '0.55rem 0.5rem',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    transition: 'all 0.2s',
                    background: inputMode === tab.key
                      ? 'linear-gradient(135deg, var(--accent), var(--accent-2))'
                      : 'transparent',
                    color: inputMode === tab.key ? '#fff' : 'var(--text-muted)',
                  }}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Pilih Mata Kuliah */}
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pilih Mata Kuliah
                </label>
                <select
                  value={selectedMatkul}
                  onChange={(e) => setSelectedMatkul(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '0.65rem 0.875rem',
                    color: selectedMatkul ? 'var(--text)' : 'var(--text-muted)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">-- Pilih Mata Kuliah --</option>
                  {matkulList.map(m => (
                    <option key={m.id} value={m.id}>{m.nama_matkul}</option>
                  ))}
                </select>
              </div>

              {/* ── Tab: Upload PDF ── */}
              {inputMode === 'pdf' && (
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Upload File PDF
                  </label>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${dragOver ? 'var(--accent)' : file ? 'var(--accent-3)' : 'var(--border)'}`,
                      borderRadius: 12,
                      padding: '2rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: dragOver ? 'rgba(124, 107, 255, 0.05)' : file ? 'rgba(0, 212, 161, 0.05)' : 'var(--surface-2)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {file ? (
                      <>
                        <FileText size={28} color="var(--accent-3)" style={{ margin: '0 auto 0.5rem' }} />
                        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent-3)' }}>{file.name}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload size={28} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem' }} />
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Drag & drop atau klik untuk pilih PDF</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', opacity: 0.7, marginTop: 4 }}>Maksimal 20MB per file</p>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    style={{ display: 'none' }}
                  />
                </div>
              )}

              {/* ── Tab: Tempel Teks Langsung ── */}
              {inputMode === 'text' && (
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Tempel Teks Soal
                  </label>
                  <textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste / tempel teks soal di sini... (copy dari dokumen, PDF, atau sumber lain)"
                    rows={10}
                    style={{
                      width: '100%',
                      background: 'var(--surface-2)',
                      border: pastedText ? '1px solid var(--accent-3)' : '1px solid var(--border)',
                      borderRadius: 10,
                      padding: '0.875rem',
                      color: 'var(--text)',
                      fontSize: '0.82rem',
                      fontFamily: 'inherit',
                      lineHeight: 1.6,
                      outline: 'none',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s',
                    }}
                  />
                  {pastedText && (
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem', textAlign: 'right' }}>
                      {pastedText.length.toLocaleString('id')} karakter · {pastedText.trim().split(/\s+/).length.toLocaleString('id')} kata
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={uploadStatus === 'loading'}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  background: uploadStatus === 'loading'
                    ? 'var(--surface-2)'
                    : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                  color: uploadStatus === 'loading' ? 'var(--text-muted)' : '#fff',
                  border: 'none',
                  borderRadius: 10,
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: uploadStatus === 'loading' ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'opacity 0.2s',
                }}
              >
                {uploadStatus === 'loading'
                  ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Memproses via Gemini AI...</>
                  : <><Sparkles size={16} /> Proses dengan AI</>
                }
              </button>
            </form>

            {message && (
              <div style={{
                marginTop: '1rem',
                padding: '0.875rem 1rem',
                borderRadius: 10,
                border: `1px solid ${uploadStatus === 'success' ? 'rgba(0, 212, 161, 0.3)' : uploadStatus === 'error' ? 'rgba(255, 92, 92, 0.3)' : 'var(--border)'}`,
                background: uploadStatus === 'success' ? 'rgba(0, 212, 161, 0.05)' : uploadStatus === 'error' ? 'rgba(255, 92, 92, 0.05)' : 'var(--surface-2)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
              }}>
                {uploadStatus === 'success' && <CheckCircle2 size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: 2 }} />}
                {uploadStatus === 'error' && <AlertCircle size={16} color="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }} />}
                {uploadStatus === 'loading' && <Loader2 size={16} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 2, animation: 'spin 1s linear infinite' }} />}
                <p style={{
                  fontSize: '0.82rem',
                  color: uploadStatus === 'success' ? 'var(--success)' : uploadStatus === 'error' ? 'var(--danger)' : 'var(--text-muted)',
                  lineHeight: 1.5,
                }}>
                  {message}
                </p>
              </div>
            )}          
          </div>
        </div>

        {/* Stats bar bawah */}
        <div style={{
          gridColumn: 'unset',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '1rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '2rem',
        }}>
          <div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Total Mata Kuliah</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)', fontFamily: "'Space Mono', monospace" }}>{matkulList.length}</p>
          </div>
          <div style={{ width: 1, height: 40, background: 'var(--border)' }} />
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', flex: 1 }}>
            Klik <span style={{ color: 'var(--accent-3)', fontWeight: 600 }}>Kelola</span> untuk mengelola soal secara manual, klik <span style={{ color: 'var(--accent-2)', fontWeight: 600 }}>Tes</span> untuk mulai latihan, atau klik <span style={{ color: '#a78bfa', fontWeight: 600 }}>Share</span> untuk membagikan link ujian kepada teman.
          </p>
        </div>
      </main>

      {/* ── Modal: View Share Links ── */}
      {showShareModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }} onClick={(e) => { if (e.target === e.currentTarget) setShowShareModal(false); }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 18, padding: '1.75rem', width: '100%', maxWidth: 780,
            maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ExternalLink size={16} color="var(--accent-3)" />
                <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>Monitoring Share Links</h2>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '0.15rem 0.6rem' }}>
                  {shareTokens.length} token
                </span>
              </div>
              <button onClick={() => setShowShareModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.25rem', lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {shareTokens.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 0', fontSize: '0.85rem' }}>
                  Belum ada share link yang dibuat.
                </p>
              ) : (
                <table className="share-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      {['Penerima', 'Mata Kuliah', 'Status', 'Perangkat', 'Aksi'].map(h => (
                        <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shareTokens.map(t => (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td data-label="Penerima" style={{ padding: '0.75rem', color: 'var(--text)', fontWeight: 600 }}>{t.penerima_nama}</td>
                        <td data-label="Mata Kuliah" style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{t.matkul?.nama_matkul || '—'}</td>
                        <td data-label="Status" style={{ padding: '0.75rem' }}>
                          <span style={{
                            fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 20,
                            background: t.is_used ? 'rgba(255,92,92,0.1)' : 'rgba(0,212,161,0.1)',
                            color: t.is_used ? 'var(--danger)' : 'var(--accent-3)',
                            border: `1px solid ${t.is_used ? 'rgba(255,92,92,0.3)' : 'rgba(0,212,161,0.3)'}`,
                            display: 'flex', alignItems: 'center', gap: '0.3rem', width: 'fit-content',
                          }}>
                            {t.is_used ? <><ShieldCheck size={10} /> Terkunci</> : <><ShieldOff size={10} /> Belum Dibuka</>}
                          </span>
                        </td>
                        <td data-label="Perangkat" style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.72rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.saved_device_agent ? t.saved_device_agent.substring(0, 50) + '…' : '—'}
                        </td>
                        <td data-label="Aksi" style={{ padding: '0.75rem' }}>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              onClick={() => {
                                const link = `${window.location.origin}/share-test?token=${t.token}`;
                                navigator.clipboard.writeText(link);
                                Swal.fire({ icon: 'success', title: 'Tersalin!', timer: 1200, showConfirmButton: false, ...swalTheme() });
                              }}
                              style={{ background: 'rgba(124,107,255,0.1)', border: '1px solid rgba(124,107,255,0.3)', borderRadius: 6, padding: '0.3rem 0.55rem', cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center' }}
                              title="Salin link"
                            >
                              <Copy size={12} />
                            </button>
                            {t.is_used && (
                              <button
                                onClick={() => handleResetToken(t.id, t.penerima_nama)}
                                style={{ background: 'rgba(255,179,71,0.1)', border: '1px solid rgba(255,179,71,0.3)', borderRadius: 6, padding: '0.3rem 0.6rem', cursor: 'pointer', color: 'var(--warning)', fontSize: '0.72rem', fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                <ShieldOff size={11} /> Buka Blokir
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteToken(t.id, t.penerima_nama)}
                              style={{ background: 'rgba(255,92,92,0.1)', border: '1px solid rgba(255,92,92,0.3)', borderRadius: 6, padding: '0.3rem 0.55rem', cursor: 'pointer', color: 'var(--danger)', display: 'flex', alignItems: 'center' }}
                              title="Hapus link"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input:focus, select:focus, textarea:focus { border-color: var(--accent) !important; }
        input::placeholder, textarea::placeholder { color: var(--text-muted); }
        * { box-sizing: border-box; }

        /* Dashboard main grid */
        .dashboard-main {
          max-width: 1100px;
          margin: 0 auto;
          padding: 1.25rem 1rem;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
        }
        @media (max-width: 720px) {
          .dashboard-main {
            grid-template-columns: 1fr;
            padding: 1rem 0.75rem;
          }
        }

        /* Share modal table → card list on mobile */
        @media (max-width: 620px) {
          .share-table thead { display: none; }
          .share-table, .share-table tbody, .share-table tr, .share-table td {
            display: block; width: 100%;
          }
          .share-table tr {
            background: var(--surface-2);
            border: 1px solid var(--border) !important;
            border-radius: 10px;
            padding: 0.75rem;
            margin-bottom: 0.6rem;
          }
          .share-table td { padding: 0.25rem 0 !important; border: none !important; }
          .share-table td:before {
            content: attr(data-label);
            font-size: 0.68rem; font-weight: 700; color: var(--text-muted);
            text-transform: uppercase; letter-spacing: 0.05em;
            display: block; margin-bottom: 2px;
          }
        }

        /* Header action buttons wrap on tiny screens */
        @media (max-width: 480px) {
          header .header-actions {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
}
