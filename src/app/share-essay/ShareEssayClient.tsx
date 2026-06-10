'use client';

import { useState, useEffect, useRef } from 'react';
import { ShieldCheck, ShieldAlert, FileText, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';

type Props = {
  pdfUrl: string;
  matkulNama: string;
  penerimaName: string;
};

export default function ShareEssayClient({ pdfUrl, matkulNama, penerimaName }: Props) {
  const [blobUrl, setBlobUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const devToolsRef = useRef(false);
  const [isBlackout, setIsBlackout] = useState(false);

  // ── Fetch PDF → blob URL (bypass Chrome X-Frame-Options) ────────────────
  useEffect(() => {
    async function loadPdf() {
      try {
        const res = await fetch(pdfUrl);
        if (!res.ok) throw new Error('Gagal mengambil file PDF.');
        const blob = await res.blob();
        setBlobUrl(URL.createObjectURL(blob));
      } catch (err: any) {
        setLoadError(err.message || 'Gagal memuat PDF.');
      } finally {
        setLoading(false);
      }
    }
    loadPdf();
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [pdfUrl]);

  // ── Anti-Cheat: Blokir keyboard, copy, screenshot ───────────────────────
  useEffect(() => {
    const blockContext = (e: MouseEvent) => e.preventDefault();
    const blockCopy = (e: ClipboardEvent) => e.preventDefault();
    const blockSelect = (e: Event) => e.preventDefault();

    const triggerScreenshotAlert = () => {
      setIsBlackout(true);
      setTimeout(() => {
        Swal.fire({
          title: '⛔ Tindakan Dilarang!',
          html: `<p style="color:#e8e8f0;font-size:0.9rem;line-height:1.6">
            Pengambilan screenshot terdeteksi.<br/>
            <span style="color:#ff5c5c;font-weight:700">Aktivitas ini telah dicatat.</span>
          </p>`,
          showConfirmButton: true,
          confirmButtonText: 'Saya Mengerti',
          confirmButtonColor: '#ff5c5c',
          background: '#1a1a24',
          color: '#e8e8f0',
        }).then(() => setIsBlackout(false));
      }, 100);
    };

    const blockKeys = (e: KeyboardEvent) => {
      // Blokir DevTools
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'K', 'E'].includes(e.key.toUpperCase())) ||
        (e.ctrlKey && ['U', 'P', 'S', 'A', 'C', 'F'].includes(e.key.toUpperCase()))
      ) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // Deteksi screenshot
      const isWinShiftS = e.shiftKey && e.key === 'S' && !e.ctrlKey && !e.altKey && !e.metaKey;
      const isPrintScreen = e.key === 'PrintScreen';
      const isMacScreenshot = e.metaKey && e.shiftKey && ['3', '4', '5', 's', 'S'].includes(e.key);
      const isCtrlPrint = e.ctrlKey && e.key === 'PrintScreen';
      if (isPrintScreen || isWinShiftS || isMacScreenshot || isCtrlPrint) {
        e.preventDefault();
        triggerScreenshotAlert();
      }
    };

    document.addEventListener('contextmenu', blockContext);
    document.addEventListener('keydown', blockKeys, true);
    document.addEventListener('copy', blockCopy);
    document.addEventListener('cut', blockCopy);
    document.addEventListener('selectstart', blockSelect);

    return () => {
      document.removeEventListener('contextmenu', blockContext);
      document.removeEventListener('keydown', blockKeys, true);
      document.removeEventListener('copy', blockCopy);
      document.removeEventListener('cut', blockCopy);
      document.removeEventListener('selectstart', blockSelect);
    };
  }, []);

  // ── Anti-Cheat: Deteksi DevTools via window size ─────────────────────────
  useEffect(() => {
    const THRESHOLD = 160;
    function checkDevTools() {
      const isOpen =
        window.outerWidth - window.innerWidth > THRESHOLD ||
        window.outerHeight - window.innerHeight > THRESHOLD;
      if (isOpen !== devToolsRef.current) {
        devToolsRef.current = isOpen;
        setDevToolsOpen(isOpen);
      }
    }
    const ro = new ResizeObserver(checkDevTools);
    ro.observe(document.body);
    window.addEventListener('resize', checkDevTools);
    checkDevTools();
    return () => { ro.disconnect(); window.removeEventListener('resize', checkDevTools); };
  }, []);

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#0f0f13',
    color: '#e8e8f0',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    display: 'flex',
    flexDirection: 'column',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none',
    userSelect: 'none',
    WebkitTouchCallout: 'none',
  };

  if (loading) {
    return (
      <div style={{ ...pageStyle, alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
        <Loader2 size={40} color="#7c6bff" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#7878a0', fontSize: '0.9rem' }}>Memuat dokumen...</p>
        <style>{GLOBAL_CSS}</style>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ ...pageStyle, alignItems: 'center', justifyContent: 'center', gap: '1rem', textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '3rem' }}>❌</div>
        <p style={{ color: '#ff5c5c', fontSize: '0.9rem' }}>{loadError}</p>
        <style>{GLOBAL_CSS}</style>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <style>{GLOBAL_CSS}</style>

      {/* ── Blackout Anti-Screenshot ──────────────────────────────────────── */}
      {isBlackout && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 99999 }} />
      )}

      {/* ── DevTools Overlay ──────────────────────────────────────────────── */}
      {devToolsOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: '#0f0f13',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '1rem', textAlign: 'center', padding: '2rem',
        }}>
          <ShieldAlert size={56} color="#ff5c5c" />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ff5c5c' }}>Akses Ditangguhkan</h2>
          <p style={{ fontSize: '0.85rem', color: '#7878a0', maxWidth: 340, lineHeight: 1.7 }}>
            Developer Tools terdeteksi aktif.<br />
            Tutup DevTools untuk melanjutkan membaca dokumen.
          </p>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{
        background: '#1a1a24', borderBottom: '1px solid #2e2e42',
        padding: '0.75rem 1.25rem', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <img src="/logo.png" alt="Logo" style={{ height: 34, width: 'auto', display: 'block', borderRadius: 6 }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{matkulNama}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ShieldCheck size={14} color="#00d4a1" />
          <span style={{ fontSize: '0.72rem', color: '#00d4a1', fontWeight: 600 }}>
            Akses untuk: {penerimaName}
          </span>
        </div>
      </div>

      {/* ── PDF Viewer ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0.75rem', gap: '0.75rem' }}>
        <div style={{
          flex: 1, borderRadius: 12, overflow: 'hidden',
          border: '1px solid #2e2e42', position: 'relative',
          minHeight: 'calc(100vh - 130px)',
        }}>
          <iframe
            src={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=1`}
            style={{ width: '100%', height: '100%', minHeight: 'calc(100vh - 130px)', border: 'none', display: 'block' }}
            title={matkulNama}
          />
          <div
            style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'transparent', pointerEvents: 'none' }}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
        <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#3a3a55', paddingBottom: '0.25rem', letterSpacing: '0.05em' }}>
          Dokumen ini hanya untuk {penerimaName} — dilarang menyebarluaskan
        </div>
      </div>

      <footer style={{ borderTop: '1px solid #2a2a3a', padding: '0.875rem 1.5rem', textAlign: 'center', color: '#444', fontSize: '0.72rem' }}>
        Dibuat oleh <span style={{ fontWeight: 700, color: '#666' }}>M. Riki Hidayat</span> — Mahasiswa SI UT
      </footer>
    </div>
  );
}

const GLOBAL_CSS = `
  @keyframes spin { to { transform: rotate(360deg); } }
  *, *::before, *::after {
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
    user-select: none !important;
    -webkit-touch-callout: none !important;
  }
  img, iframe {
    pointer-events: none;
    -webkit-user-drag: none;
  }
  @media print {
    html, body { display: none !important; visibility: hidden !important; }
  }
`;
