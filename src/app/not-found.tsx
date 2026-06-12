'use client';

import Link from 'next/link';
import { Home, FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatOrb {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(30px, -20px) scale(1.05); }
          66%       { transform: translate(-20px, 15px) scale(0.97); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0  rgba(124,107,255,0.4); }
          70%  { box-shadow: 0 0 0 18px rgba(124,107,255,0); }
          100% { box-shadow: 0 0 0 0  rgba(124,107,255,0); }
        }
        .nf-card {
          animation: fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) both;
        }
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
        .nf-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(124,107,255,0.45) !important;
        }
        .nf-btn:active {
          transform: translateY(0);
        }
        .nf-btn {
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .icon-pulse {
          animation: pulse-ring 2.2s cubic-bezier(0.455,0.03,0.515,0.955) infinite;
        }
      `}</style>

      <div style={{
        minHeight: '100vh', width: '100%',
        background: '#0a0a0f',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
        padding: '1rem',
      }}>
        {/* Dot grid */}
        <div className="dot-grid" style={{ position: 'absolute', inset: 0, opacity: 0.6 }} />

        {/* Ambient orbs */}
        <div style={{
          position: 'absolute', width: 480, height: 480, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,107,255,0.18) 0%, transparent 70%)',
          top: '-80px', left: '-100px',
          animation: 'floatOrb 9s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,107,157,0.12) 0%, transparent 70%)',
          bottom: '-60px', right: '-80px',
          animation: 'floatOrb 12s ease-in-out infinite reverse',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,212,161,0.08) 0%, transparent 70%)',
          top: '40%', right: '15%',
          animation: 'floatOrb 7s ease-in-out infinite 2s',
          pointerEvents: 'none',
        }} />

        {/* Card */}
        <div className="nf-card" style={{
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
              Page Not Found
            </span>
          </div>

          {/* Icon */}
          <div className="icon-pulse" style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(124,107,255,0.2), rgba(255,107,157,0.1))',
            border: '1px solid rgba(124,107,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem',
            color: '#a78bfa',
          }}>
            <FileQuestion size={34} strokeWidth={1.5} />
          </div>

          {/* 404 number */}
          <div style={{ fontSize: '4rem', fontWeight: 900, lineHeight: 1, marginBottom: '0.5rem' }}>
            <span className="shimmer-text">404</span>
          </div>

          {/* Title */}
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#e8e8f0', marginBottom: 8, lineHeight: 1.3 }}>
            Halaman Tidak Ditemukan
          </h1>

          {/* Subtitle */}
          <p style={{ color: 'rgba(170,170,200,0.7)', fontSize: '0.875rem', marginBottom: '2rem', lineHeight: 1.6 }}>
            Halaman yang kamu cari tidak ada atau sudah dipindahkan.
            Pastikan URL yang kamu masukkan sudah benar.
          </p>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(124,107,255,0.15)', marginBottom: '1.75rem' }} />

          {/* Back button */}
          <Link href="/" style={{ textDecoration: 'none' }}>
            <button className="nf-btn" style={{
              width: '100%', padding: '0.875rem 1.5rem',
              background: 'linear-gradient(135deg, #7c6bff 0%, #9b59e8 100%)',
              color: '#fff', border: 'none', borderRadius: 14,
              fontWeight: 700, fontSize: '0.975rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: '0 4px 20px rgba(124,107,255,0.3)',
              letterSpacing: '0.01em',
            }}>
              <Home size={17} strokeWidth={2.2} />
              Kembali ke Beranda
            </button>
          </Link>
        </div>
      </div>
    </>
  );
}
