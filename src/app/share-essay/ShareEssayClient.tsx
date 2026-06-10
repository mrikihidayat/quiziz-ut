'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldCheck, ShieldAlert, Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import Swal from 'sweetalert2';

type Props = {
  pdfUrl: string;
  matkulNama: string;
  penerimaName: string;
};

function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export default function ShareEssayClient({ pdfUrl, matkulNama, penerimaName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0); // base scale — actual render pakai fitScale * scale
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const devToolsRef = useRef(false);
  const [isBlackout, setIsBlackout] = useState(false);
  const isMobile = typeof window !== 'undefined' ? isMobileBrowser() : false;

  // ── Load PDF.js + dokumen ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        // Dynamic import — Next.js bundle PDF.js hanya saat dibutuhkan
        const pdfjsLib = await import('pdfjs-dist');

        // Worker wajib di-set sebelum getDocument()
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        // pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        const res = await fetch(pdfUrl);
        if (!res.ok) throw new Error('Gagal mengambil file PDF.');
        const arrayBuffer = await res.arrayBuffer();

        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
      } catch (err: any) {
        if (!cancelled) setLoadError(err.message || 'Gagal memuat PDF.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPdf();
    return () => { cancelled = true; };
  }, [pdfUrl]);

  // ── Render halaman ke canvas ─────────────────────────────────────────────
  const renderPage = useCallback(async (pageNum: number, zoom: number) => {
    if (!pdfDoc || !containerRef.current) return;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    setPageLoading(true);

    try {
      const page = await pdfDoc.getPage(pageNum);

      // Hitung scale supaya PDF pas dengan lebar container (fit-to-width)
      // PDF A4 native width ~595pt. containerRef.clientWidth = lebar area render.
      const containerWidth = containerRef.current.clientWidth || 600;
      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = containerWidth / baseViewport.width;
      const finalScale = fitScale * zoom; // zoom = user zoom multiplier (0.6–3)

      // devicePixelRatio: render canvas 2x/3x lebih tajam di layar HiDPI/mobile
      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: finalScale });

      let canvas = containerRef.current.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(canvas);
      }

      // Canvas internal resolution = tampilan * dpr → tajam di retina/HP
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      // CSS size = ukuran tampilan sebenarnya (bukan diperbesar)
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr); // scale context supaya PDF.js render di resolusi tinggi

      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Render error:', err);
      }
    } finally {
      setPageLoading(false);
    }
  }, [pdfDoc]);

  useEffect(() => {
    if (pdfDoc) renderPage(currentPage, scale);
  }, [pdfDoc, currentPage, scale, renderPage]);

  // ── Anti-Cheat ───────────────────────────────────────────────────────────
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

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setIsBlackout(true);
      } else {
        setTimeout(() => setIsBlackout(false), 600);
      }
    };

    const blockKeys = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'K', 'E'].includes(e.key.toUpperCase())) ||
        (e.ctrlKey && ['U', 'P', 'S', 'A', 'C', 'F'].includes(e.key.toUpperCase()))
      ) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
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
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('contextmenu', blockContext);
      document.removeEventListener('keydown', blockKeys, true);
      document.removeEventListener('copy', blockCopy);
      document.removeEventListener('cut', blockCopy);
      document.removeEventListener('selectstart', blockSelect);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // ── DevTools detection (desktop only) ───────────────────────────────────
  useEffect(() => {
    if (isMobile) return;
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
  }, [isMobile]);

  const prevPage = () => setCurrentPage(p => Math.max(1, p - 1));
  const nextPage = () => setCurrentPage(p => Math.min(totalPages, p + 1));
  const zoomIn = () => setScale(s => Math.min(3, parseFloat((s + 0.2).toFixed(1))));
  const zoomOut = () => setScale(s => Math.max(0.6, parseFloat((s - 0.2).toFixed(1))));

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
    WebkitTouchCallout: 'none' as any,
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

      {/* Blackout */}
      {isBlackout && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 99999 }} />
      )}

      {/* DevTools Overlay */}
      {devToolsOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: '#0f0f13',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '1rem', textAlign: 'center', padding: '2rem',
        }}>
          <ShieldAlert size={56} color="#ff5c5c" />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ff5c5c' }}>Akses Ditangguhkan</h2>
          <p style={{ fontSize: '0.85rem', color: '#7878a0', maxWidth: 340, lineHeight: 1.7 }}>
            Developer Tools terdeteksi aktif.<br />
            Tutup DevTools untuk melanjutkan membaca dokumen.
          </p>
        </div>
      )}

      {/* Header */}
      <div style={{
        background: '#1a1a24', borderBottom: '1px solid #2e2e42',
        padding: '0.75rem 1.25rem', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <img src="/logo.png" alt="Logo" style={{ height: 34, width: 'auto', borderRadius: 6 }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{matkulNama}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ShieldCheck size={14} color="#00d4a1" />
          <span style={{ fontSize: '0.72rem', color: '#00d4a1', fontWeight: 600 }}>
            Akses untuk: {penerimaName}
          </span>
        </div>
      </div>

      {/* Toolbar navigasi + zoom */}
      <div style={{
        background: '#13131c', borderBottom: '1px solid #2e2e42',
        padding: '0.5rem 1rem', display: 'flex',
        alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap',
      }}>
        <button onClick={prevPage} disabled={currentPage <= 1} style={toolbarBtn(currentPage <= 1)}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: '0.82rem', color: '#aaa', fontFamily: 'monospace', minWidth: 80, textAlign: 'center' }}>
          {pageLoading ? '...' : `${currentPage} / ${totalPages}`}
        </span>
        <button onClick={nextPage} disabled={currentPage >= totalPages} style={toolbarBtn(currentPage >= totalPages)}>
          <ChevronRight size={16} />
        </button>
        <div style={{ width: 1, height: 20, background: '#2e2e42' }} />
        <button onClick={zoomOut} disabled={scale <= 0.6} style={toolbarBtn(scale <= 0.6)}>
          <ZoomOut size={16} />
        </button>
        <span style={{ fontSize: '0.78rem', color: '#666', fontFamily: 'monospace', minWidth: 48, textAlign: 'center' }}>
          {scale === 1.0 ? 'Fit' : `${Math.round(scale * 100)}%`}
        </span>
        <button onClick={zoomIn} disabled={scale >= 3} style={toolbarBtn(scale >= 3)}>
          <ZoomIn size={16} />
        </button>
      </div>

      {/* Canvas area */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '1rem', background: '#0a0a10' }}>
        {pageLoading && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10 }}>
            <Loader2 size={32} color="#7c6bff" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        )}
        <div
          ref={containerRef}
          style={{
            borderRadius: 8, overflow: 'hidden',
            boxShadow: '0 4px 32px rgba(0,0,0,0.6)',
            opacity: pageLoading ? 0.4 : 1, transition: 'opacity 0.2s',
            pointerEvents: 'none', // canvas tidak bisa di-select/drag
          }}
        />
      </div>

      <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#2a2a3a', padding: '0.5rem', letterSpacing: '0.05em' }}>
        Dokumen ini hanya untuk {penerimaName} — dilarang menyebarluaskan
      </div>

      <footer style={{ borderTop: '1px solid #2a2a3a', padding: '0.875rem 1.5rem', textAlign: 'center', color: '#444', fontSize: '0.72rem' }}>
        Dibuat oleh <span style={{ fontWeight: 700, color: '#666' }}>M. Riki Hidayat</span> — Mahasiswa SI UT
      </footer>
    </div>
  );
}

function toolbarBtn(disabled: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 8,
    background: disabled ? 'transparent' : '#1e1e2e',
    border: `1px solid ${disabled ? 'transparent' : '#2e2e42'}`,
    color: disabled ? '#333' : '#aaa',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s',
  };
}

const GLOBAL_CSS = `
  @keyframes spin { to { transform: rotate(360deg); } }
  *, *::before, *::after {
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
    user-select: none !important;
    -webkit-touch-callout: none !important;
    -webkit-tap-highlight-color: transparent !important;
  }
  img, canvas, iframe {
    pointer-events: none !important;
    -webkit-user-drag: none !important;
  }
  @media print {
    html, body { display: none !important; visibility: hidden !important; }
  }
`;
