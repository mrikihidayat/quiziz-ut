'use client';

import { useState, useEffect, use, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { initTheme, setTheme } from '@/lib/theme';
import {
  ArrowLeft, Edit2, Trash2, Plus, CheckCircle,
  X, Save, BookOpen, Loader2, Sun, Moon, ClipboardList, Download,
  ImageIcon, UploadCloud, ArrowUp,
} from 'lucide-react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';

type Soal = {
  id: string;
  pertanyaan: string;
  pilihan_a: string;
  pilihan_b: string;
  pilihan_c: string;
  pilihan_d: string;
  jawaban_benar: 'A' | 'B' | 'C' | 'D';
  gambar_url?: string | null;
  created_at: string;
};

type FormState = Omit<Soal, 'id' | 'created_at'>;

const emptyForm: FormState = {
  pertanyaan: '',
  pilihan_a: '',
  pilihan_b: '',
  pilihan_c: '',
  pilihan_d: '',
  jawaban_benar: 'A',
  gambar_url: null,
};

// ── Cloudinary upload helper ─────────────────────────────────────────────────
async function uploadToCloudinary(file: File): Promise<string> {
  const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
  const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', UPLOAD_PRESET);
  fd.append('folder', 'quizizz');

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: fd,
  });

  if (!res.ok) throw new Error('Gagal upload ke Cloudinary');
  const data = await res.json();
  return data.secure_url as string;
}

// ── Image Upload Field Component ─────────────────────────────────────────────
function ImageUploadField({
  currentUrl,
  onUploaded,
  onRemove,
  theme,
}: {
  currentUrl: string | null | undefined;
  onUploaded: (url: string) => void;
  onRemove: () => void;
  theme: 'dark' | 'light';
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_MB = 5;
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Ukuran file maks ${MAX_MB}MB`);
      return;
    }

    setError('');
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      onUploaded(url);
    } catch (err) {
      setError('Upload gagal, coba lagi.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <label style={{
        fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700,
        display: 'block', marginBottom: '0.35rem', textTransform: 'uppercase' as const,
        letterSpacing: '0.06em',
      }}>
        Gambar Soal <span style={{ fontWeight: 400, textTransform: 'none' as const }}>(opsional)</span>
      </label>

      {currentUrl ? (
        <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
          <img
            src={currentUrl}
            alt="Gambar soal"
            style={{
              maxWidth: '100%', maxHeight: 220, borderRadius: 10,
              border: '1px solid var(--border)', display: 'block', objectFit: 'contain',
              background: theme === 'dark' ? '#11111a' : '#f5f5ff',
            }}
          />
          <button
            type="button"
            onClick={onRemove}
            title="Hapus gambar"
            style={{
              position: 'absolute', top: 6, right: 6,
              background: 'rgba(255,92,92,0.85)', border: 'none', borderRadius: '50%',
              width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#fff',
            }}
          >
            <X size={13} />
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            style={{
              marginTop: 8, display: 'flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.45rem 0.9rem', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface-2)', color: 'var(--text-muted)', cursor: 'pointer',
              fontSize: '0.78rem', fontFamily: 'inherit',
            }}
          >
            <UploadCloud size={13} /> Ganti Gambar
          </button>
        </div>
      ) : (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          style={{
            border: '2px dashed var(--border)', borderRadius: 10, padding: '1.5rem',
            textAlign: 'center', cursor: uploading ? 'not-allowed' : 'pointer',
            background: 'var(--surface-2)', transition: 'border-color 0.15s',
            color: 'var(--text-muted)',
          }}
        >
          {uploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '0.8rem' }}>Mengupload...</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <ImageIcon size={24} />
              <span style={{ fontSize: '0.82rem' }}>Klik untuk upload gambar</span>
              <span style={{ fontSize: '0.72rem', opacity: 0.6 }}>PNG, JPG, GIF — maks 5MB</span>
            </div>
          )}
        </div>
      )}

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.35rem' }}>{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ display: 'none' }}
      />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function KelolaSoal({ params }: { params: Promise<{ id: string }> }) {
  const { id: matkulId } = use(params);
  const [soalList, setSoalList] = useState<Soal[]>([]);
  const [matkulName, setMatkulName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<FormState>(emptyForm);
  const [theme, setThemeState] = useState<'dark' | 'light'>('dark');
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const t = initTheme();
    setThemeState(t);
    fetchData();
  }, [matkulId]);

  // Scroll-to-top listener
  useEffect(() => {
    function onScroll() {
      setShowScrollTop(window.scrollY > 400);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleThemeHandler() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  }

  async function fetchData() {
    setLoading(true);
    const [{ data: matkul }, { data: soal }] = await Promise.all([
      supabase.from('matkul').select('nama_matkul').eq('id', matkulId).single(),
      supabase.from('soal').select('*').eq('matkul_id', matkulId).order('created_at', { ascending: true }),
    ]);
    if (matkul) setMatkulName(matkul.nama_matkul);
    if (soal) setSoalList(soal);
    setLoading(false);
  }

  function handleEdit(soal: Soal) {
    setEditingId(soal.id);
    setFormData({
      pertanyaan: soal.pertanyaan,
      pilihan_a: soal.pilihan_a,
      pilihan_b: soal.pilihan_b,
      pilihan_c: soal.pilihan_c,
      pilihan_d: soal.pilihan_d,
      jawaban_benar: soal.jawaban_benar,
      gambar_url: soal.gambar_url ?? null,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancel() {
    setEditingId(null);
    setFormData(emptyForm);
    setShowForm(false);
  }

  const swalBg = { background: theme === 'dark' ? '#1a1a24' : '#ffffff', color: theme === 'dark' ? '#e8e8f0' : '#1a1a2e' };

  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    if (editingId) {
      const { error } = await supabase.from('soal').update(formData).eq('id', editingId);
      if (!error) {
        setSoalList(soalList.map(s => s.id === editingId ? { ...s, ...formData } : s));
        Swal.fire({ icon: 'success', title: 'Tersimpan!', text: 'Soal berhasil diperbarui.', timer: 1800, showConfirmButton: false, ...swalBg });
      } else {
        Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal menyimpan perubahan.', ...swalBg });
      }
    } else {
      const { data, error } = await supabase
        .from('soal')
        .insert([{ ...formData, matkul_id: matkulId }])
        .select();
      if (!error && data) {
        setSoalList([...soalList, data[0]]);
        Swal.fire({ icon: 'success', title: 'Soal Ditambahkan!', text: 'Soal baru berhasil disimpan.', timer: 1800, showConfirmButton: false, ...swalBg });
      } else {
        Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal menambahkan soal.', ...swalBg });
      }
    }
    setSaving(false);
    handleCancel();
  }

  async function handleDelete(id: string) {
    const result = await Swal.fire({
      icon: 'warning', title: 'Hapus Soal?',
      text: 'Soal ini akan dihapus permanen dan tidak bisa dikembalikan.',
      showCancelButton: true, confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal', confirmButtonColor: '#ff5c5c',
      cancelButtonColor: '#7c6bff', ...swalBg,
    });
    if (!result.isConfirmed) return;
    const { error } = await supabase.from('soal').delete().eq('id', id);
    if (!error) {
      setSoalList(soalList.filter(s => s.id !== id));
      Swal.fire({ icon: 'success', title: 'Dihapus!', timer: 1500, showConfirmButton: false, ...swalBg });
    }
  }

  function handleDownloadPDF() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 18;
    const usableW = pageW - margin * 2;
    let y = margin;

    doc.setFillColor(124, 107, 255);
    doc.rect(0, 0, pageW, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(matkulName, pageW / 2, 13, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Bank Soal — ${soalList.length} Soal`, pageW / 2, 19, { align: 'center' });
    y = 30;

    const answerColors: Record<string, [number, number, number]> = {
      A: [124, 107, 255], B: [255, 107, 157], C: [0, 212, 161], D: [255, 179, 71],
    };

    soalList.forEach((soal, idx) => {
      const nomorTampil = idx + 1;
      const estimasiTinggi = 14 + 28;
      if (y + estimasiTinggi > pageH - margin) {
        doc.addPage();
        doc.setFillColor(124, 107, 255);
        doc.rect(0, 0, pageW, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(matkulName, pageW / 2, 7, { align: 'center' });
        y = 16;
      }

      doc.setFillColor(245, 245, 255);
      doc.roundedRect(margin, y, usableW, 8, 2, 2, 'F');
      doc.setTextColor(80, 70, 180);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(`Soal ${nomorTampil}`, margin + 3, y + 5.5);
      y += 11;

      doc.setTextColor(30, 30, 50);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const pertLines = doc.splitTextToSize(soal.pertanyaan, usableW);
      doc.text(pertLines, margin, y);
      y += pertLines.length * 4.5 + 3;

      const opts: Array<{ key: 'A' | 'B' | 'C' | 'D'; teks: string }> = [
        { key: 'A', teks: soal.pilihan_a },
        { key: 'B', teks: soal.pilihan_b },
        { key: 'C', teks: soal.pilihan_c },
        { key: 'D', teks: soal.pilihan_d },
      ];

      opts.forEach(({ key, teks }) => {
        const isCorrect = soal.jawaban_benar === key;
        const [r, g, b] = answerColors[key];
        const linesTeks = doc.splitTextToSize(`${key}. ${teks}`, usableW - 6);
        const boxH = linesTeks.length * 4.5 + 3.5;

        if (y + boxH > pageH - margin) {
          doc.addPage();
          doc.setFillColor(124, 107, 255);
          doc.rect(0, 0, pageW, 10, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text(matkulName, pageW / 2, 7, { align: 'center' });
          y = 16;
        }

        if (isCorrect) {
          doc.setFillColor(r, g, b);
          doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
          doc.roundedRect(margin, y, usableW, boxH, 1.5, 1.5, 'F');
          doc.setGState(new (doc as any).GState({ opacity: 1 }));
          doc.setDrawColor(r, g, b);
          doc.setLineWidth(1.2);
          doc.line(margin, y, margin, y + boxH);
          doc.setLineWidth(0.2);
          doc.setTextColor(r, g, b);
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setTextColor(80, 80, 100);
          doc.setFont('helvetica', 'normal');
        }

        doc.setFontSize(8.5);
        doc.text(linesTeks, margin + 4, y + 3.5);
        y += boxH + 1.5;
      });

      y += 5;
    });

    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setTextColor(160, 160, 180);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(`Halaman ${i} / ${totalPages}`, pageW / 2, pageH - 8, { align: 'center' });
    }

    const safeName = matkulName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`soal_${safeName}.pdf`);
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.65rem 0.875rem',
    color: 'var(--text)',
    fontSize: '0.875rem',
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
  };

  const labelStyle = {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    fontWeight: 700,
    display: 'block',
    marginBottom: '0.35rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  };

  const jawabanBtns: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
  const jawabanColors: Record<string, string> = {
    A: '#7c6bff', B: '#ff6b9d', C: '#00d4a1', D: '#ffb347',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* ── HEADER ── */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: '0.85rem 1rem',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        {/* Row 1: back + title + theme */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <Link href="/" style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0,
              fontSize: '0.78rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 600,
            }}>
              <ArrowLeft size={14} /> <span className="hide-xs">Dashboard</span>
            </Link>
            <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
              <BookOpen size={13} color="var(--accent)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {matkulName}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {/* soal count badge */}
            <span style={{
              fontSize: '0.72rem', color: 'var(--text-muted)',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '0.25rem 0.6rem', whiteSpace: 'nowrap',
            }}>
              {soalList.length} Soal
            </span>
            <button onClick={toggleThemeHandler} style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '0.4rem 0.45rem', cursor: 'pointer', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center',
            }}>
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </div>

        {/* Row 2: action buttons — scrollable on mobile */}
        <div style={{
          display: 'flex', gap: '0.5rem', marginTop: '0.65rem',
          overflowX: 'auto', paddingBottom: '2px',
        }}>
          <Link href={`/ujian/${matkulId}`} style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0,
            fontSize: '0.76rem', fontWeight: 600, color: 'var(--accent-2)',
            textDecoration: 'none', padding: '0.38rem 0.75rem',
            background: 'rgba(255,107,157,0.1)', border: '1px solid rgba(255,107,157,0.3)',
            borderRadius: 7,
          }}>
            <ClipboardList size={12} /> Tes Ujian
          </Link>
          <button
            onClick={handleDownloadPDF}
            disabled={soalList.length === 0}
            title="Download soal + kunci jawaban sebagai PDF"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0,
              fontSize: '0.76rem', fontWeight: 600, color: '#00d4a1',
              padding: '0.38rem 0.75rem', cursor: soalList.length === 0 ? 'not-allowed' : 'pointer',
              background: 'rgba(0,212,161,0.1)', border: '1px solid rgba(0,212,161,0.3)',
              borderRadius: 7, opacity: soalList.length === 0 ? 0.4 : 1,
              fontFamily: 'inherit',
            }}
          >
            <Download size={12} /> Download PDF
          </button>
          <button onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData(emptyForm); }} style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0,
            background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: 7, padding: '0.38rem 0.85rem',
            fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <Plus size={13} /> Tambah Manual
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '1.25rem 1rem' }}>
        {/* Form tambah/edit */}
        {showForm && (
          <div style={{
            background: 'var(--surface)',
            border: `1px solid ${editingId ? 'rgba(255, 179, 71, 0.4)' : 'rgba(124, 107, 255, 0.4)'}`,
            borderRadius: 16, padding: '1.25rem', marginBottom: '1.25rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: editingId ? 'var(--warning)' : 'var(--accent)' }}>
                {editingId ? 'Edit Butir Soal' : '➕  Tambah Soal Baru'}
              </h3>
              <button onClick={handleCancel} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Pertanyaan</label>
                <textarea
                  rows={3} required value={formData.pertanyaan}
                  onChange={e => setFormData({ ...formData, pertanyaan: e.target.value })}
                  placeholder="Tulis teks pertanyaan di sini..."
                  style={inputStyle}
                />
              </div>

              <ImageUploadField
                currentUrl={formData.gambar_url}
                onUploaded={(url) => setFormData({ ...formData, gambar_url: url })}
                onRemove={() => setFormData({ ...formData, gambar_url: null })}
                theme={theme}
              />

              {/* Responsive grid: 2 cols on md+, 1 col on mobile */}
              <div className="pilihan-grid">
                {(['a', 'b', 'c', 'd'] as const).map(opt => (
                  <div key={opt}>
                    <label style={{ ...labelStyle, color: jawabanColors[opt.toUpperCase()] }}>Pilihan {opt.toUpperCase()}</label>
                    <input
                      type="text" required
                      value={formData[`pilihan_${opt}` as keyof FormState] as string}
                      onChange={e => setFormData({ ...formData, [`pilihan_${opt}`]: e.target.value })}
                      placeholder={`Isi pilihan ${opt.toUpperCase()}...`}
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>

              <div>
                <label style={labelStyle}>Kunci Jawaban Benar</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {jawabanBtns.map(j => (
                    <button
                      key={j} type="button"
                      onClick={() => setFormData({ ...formData, jawaban_benar: j })}
                      style={{
                        width: 44, height: 44, borderRadius: 10, border: 'none',
                        cursor: 'pointer', fontWeight: 800, fontSize: '1rem',
                        fontFamily: "'Space Mono', monospace",
                        background: formData.jawaban_benar === j ? jawabanColors[j] : 'var(--surface-2)',
                        color: formData.jawaban_benar === j ? '#fff' : 'var(--text-muted)',
                        transition: 'all 0.15s',
                        boxShadow: formData.jawaban_benar === j ? `0 0 12px ${jawabanColors[j]}60` : 'none',
                      }}
                    >{j}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" onClick={handleCancel} style={{
                  padding: '0.6rem 1.1rem', background: 'var(--surface-2)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem',
                }}>
                  Batal
                </button>
                <button type="submit" disabled={saving} style={{
                  padding: '0.6rem 1.35rem', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 700,
                  background: editingId ? 'var(--warning)' : 'var(--accent)',
                  color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  opacity: saving ? 0.7 : 1,
                }}>
                  {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                  {editingId ? 'Simpan Perubahan' : 'Tambahkan Soal'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
            <p style={{ marginTop: '1rem', fontSize: '0.85rem' }}>Memuat soal...</p>
          </div>
        ) : soalList.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '4rem',
            background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 16,
          }}>
            <BookOpen size={40} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Belum ada soal. Tambahkan manual atau gunakan AI upload di dashboard.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {soalList.map((soal, index) => (
              <div key={soal.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 14, padding: '1rem',
                display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
              }}>
                {/* Nomor */}
                <div style={{
                  flexShrink: 0, width: 34, height: 34, borderRadius: 8,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Space Mono', monospace", fontSize: '0.72rem',
                  fontWeight: 700, color: 'var(--text-muted)',
                }}>
                  {index + 1}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.6, marginBottom: '0.65rem' }}>
                    {soal.pertanyaan}
                  </p>

                  {soal.gambar_url && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <img
                        src={soal.gambar_url}
                        alt="Gambar soal"
                        style={{
                          maxWidth: '100%', maxHeight: 200, borderRadius: 8,
                          border: '1px solid var(--border)', objectFit: 'contain',
                          background: theme === 'dark' ? '#11111a' : '#f5f5ff',
                          display: 'block',
                        }}
                      />
                    </div>
                  )}

                  {/* Pilihan: 2 cols on md+, 1 col on mobile */}
                  <div className="pilihan-grid-sm">
                    {(['a', 'b', 'c', 'd'] as const).map(opt => {
                      const isCorrect = soal.jawaban_benar === opt.toUpperCase();
                      return (
                        <div key={opt} style={{
                          display: 'flex', alignItems: 'flex-start', gap: '0.45rem',
                          padding: '0.45rem 0.65rem', borderRadius: 8,
                          background: isCorrect ? `${jawabanColors[opt.toUpperCase()]}18` : 'var(--surface-2)',
                          border: `1px solid ${isCorrect ? `${jawabanColors[opt.toUpperCase()]}50` : 'transparent'}`,
                        }}>
                          <span style={{
                            flexShrink: 0, fontFamily: "'Space Mono', monospace",
                            fontSize: '0.68rem', fontWeight: 700,
                            color: isCorrect ? jawabanColors[opt.toUpperCase()] : 'var(--text-muted)',
                          }}>
                            {opt.toUpperCase()}.
                          </span>
                          <span style={{
                            fontSize: '0.78rem', lineHeight: 1.5,
                            color: isCorrect ? 'var(--text)' : 'var(--text-muted)',
                            fontWeight: isCorrect ? 600 : 400,
                            wordBreak: 'break-word',
                          }}>
                            {soal[`pilihan_${opt}` as keyof Soal] as string}
                          </span>
                          {isCorrect && <CheckCircle size={12} color={jawabanColors[opt.toUpperCase()]} style={{ flexShrink: 0, marginTop: 2 }} />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Aksi */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flexShrink: 0 }}>
                  <button onClick={() => handleEdit(soal)} style={{
                    background: 'rgba(124, 107, 255, 0.12)', border: '1px solid rgba(124, 107, 255, 0.25)',
                    borderRadius: 7, padding: '0.4rem 0.55rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', color: 'var(--accent)',
                  }}>
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => handleDelete(soal.id)} style={{
                    background: 'rgba(255, 92, 92, 0.1)', border: '1px solid rgba(255, 92, 92, 0.25)',
                    borderRadius: 7, padding: '0.4rem 0.55rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', color: 'var(--danger)',
                  }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Floating Scroll-to-Top Button ── */}
      <button
        onClick={scrollToTop}
        title="Kembali ke atas"
        aria-label="Kembali ke atas"
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.25rem',
          zIndex: 200,
          width: 46,
          height: 46,
          borderRadius: '50%',
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          boxShadow: '0 4px 18px rgba(124,107,255,0.45)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: showScrollTop ? 1 : 0,
          pointerEvents: showScrollTop ? 'auto' : 'none',
          transform: showScrollTop ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.85)',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
        }}
      >
        <ArrowUp size={20} />
      </button>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input:focus, select:focus, textarea:focus { border-color: var(--accent) !important; }
        input::placeholder, textarea::placeholder { color: var(--text-muted); opacity: 0.6; }
        
        /* Pilihan grid: 2 cols default, 1 col on small screens */
        .pilihan-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }
        .pilihan-grid-sm {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.4rem;
        }
        @media (max-width: 520px) {
          .pilihan-grid { grid-template-columns: 1fr; }
          .pilihan-grid-sm { grid-template-columns: 1fr; }
          .hide-xs { display: none; }
        }

        /* Header scroll snap fix */
        header { box-sizing: border-box; }
        * { box-sizing: border-box; }

        /* Scrollbar thin on mobile for action row */
        header div::-webkit-scrollbar { height: 3px; }
        header div::-webkit-scrollbar-track { background: transparent; }
        header div::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
      `}</style>
    </div>
  );
}
