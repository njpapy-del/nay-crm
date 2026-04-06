'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth.store';
import { Logo } from '@/components/ui/logo';

const schema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Min. 6 caractères'),
});
type FormData = z.infer<typeof schema>;

// Déterministic positions for SSR safety
const PARTICLES = Array.from({ length: 30 }, (_, i) => ({
  left:     `${(i * 37 + 11) % 100}%`,
  delay:    `${(i * 0.4) % 8}s`,
  duration: `${6 + (i * 0.7) % 7}s`,
  size:     `${2 + (i % 4)}px`,
  opacity:  0.12 + (i % 5) * 0.05,
}));

const RINGS = [
  { size: 320, delay: '0s',    duration: '8s'  },
  { size: 520, delay: '-3s',   duration: '10s' },
  { size: 720, delay: '-6s',   duration: '13s' },
  { size: 920, delay: '-2s',   duration: '16s' },
];

const HEXAGONS = [
  { size: 60,  top: '8%',  left: '5%',  delay: '0s',   duration: '6s'  },
  { size: 40,  top: '15%', right: '8%', delay: '-2s',  duration: '8s'  },
  { size: 80,  bottom: '12%', left: '7%', delay: '-4s', duration: '7s' },
  { size: 50,  bottom: '20%', right: '5%', delay: '-1s', duration: '9s'},
  { size: 35,  top: '45%', left: '2%',  delay: '-3s',  duration: '5s'  },
  { size: 45,  top: '60%', right: '4%', delay: '-5s',  duration: '7s'  },
];

const LINES = Array.from({ length: 8 }, (_, i) => ({
  left:  `${10 + i * 12}%`,
  delay: `${i * 0.6}s`,
  height: `${80 + (i % 3) * 60}px`,
}));

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError('');
    try {
      await login(data.email, data.password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message ?? 'Identifiants incorrects');
    }
  };

  return (
    <div className="lp-root">

      {/* ══ BACKGROUND LAYER ══════════════════════════════════════════════ */}
      <div className="lp-bg" aria-hidden="true">

        {/* Deep gradient */}
        <div className="lp-gradient" />

        {/* Glowing orbs */}
        <div className="lp-orb lp-orb-1" />
        <div className="lp-orb lp-orb-2" />
        <div className="lp-orb lp-orb-3" />
        <div className="lp-orb lp-orb-4" />

        {/* Concentric pulsing rings */}
        <div className="lp-rings-center">
          {RINGS.map((r, i) => (
            <div key={i} className="lp-ring" style={{
              width: r.size, height: r.size,
              animationDelay: r.delay,
              animationDuration: r.duration,
            }} />
          ))}
        </div>

        {/* Grid overlay */}
        <div className="lp-grid" />

        {/* Floating hexagons */}
        {HEXAGONS.map((h, i) => (
          <div key={i} className="lp-hex" style={{
            width: h.size, height: h.size,
            top: (h as any).top, left: (h as any).left,
            right: (h as any).right, bottom: (h as any).bottom,
            animationDelay: h.delay,
            animationDuration: h.duration,
          }} />
        ))}

        {/* Vertical light beams */}
        {LINES.map((l, i) => (
          <div key={i} className="lp-beam" style={{
            left: l.left,
            height: l.height,
            animationDelay: l.delay,
          }} />
        ))}

        {/* Rising particles */}
        {PARTICLES.map((p, i) => (
          <div key={i} className="lp-particle" style={{
            left: p.left,
            width: p.size, height: p.size,
            opacity: p.opacity,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }} />
        ))}

        {/* Corner decorations */}
        <div className="lp-corner lp-corner-tl" />
        <div className="lp-corner lp-corner-tr" />
        <div className="lp-corner lp-corner-bl" />
        <div className="lp-corner lp-corner-br" />
      </div>

      {/* ══ CARD ══════════════════════════════════════════════════════════ */}
      <div className="lp-card-wrap">
        <div className="lp-card">

          {/* Glow border effect */}
          <div className="lp-card-glow" />

          {/* Logo */}
          <div className="lp-logo-wrap">
            <div className="lp-logo-ring" />
            <div className="lp-logo-inner">
              <Logo size={52} />
            </div>
          </div>

          <h1 className="lp-title">Bienvenue sur LNAYCRM</h1>
          <p className="lp-subtitle">Connectez-vous à votre espace</p>

          <form onSubmit={handleSubmit(onSubmit)} className="lp-form">
            <div>
              <label className="lp-label">Email</label>
              <input {...register('email')} type="email" className="input-field"
                placeholder="votre@email.com" autoComplete="email" />
              {errors.email && <p className="lp-err">{errors.email.message}</p>}
            </div>

            <div>
              <label className="lp-label">Mot de passe</label>
              <input {...register('password')} type="password" className="input-field"
                placeholder="••••••••" autoComplete="current-password" />
              {errors.password && <p className="lp-err">{errors.password.message}</p>}
            </div>

            {error && (
              <div className="lp-alert">{error}</div>
            )}

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-2.5">
              {isSubmitting ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div className="lp-footer-link">
            <p className="text-sm text-gray-500">
              Pas encore de compte ?{' '}
              <a href="/onboarding" className="text-primary-600 font-medium hover:underline">
                Créer votre espace gratuitement
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* ══ COPYRIGHT ═════════════════════════════════════════════════════ */}
      <div className="lp-copyright">
        <p>© {new Date().getFullYear()} <strong>CCOI SERVICES</strong> — Tunisie</p>
        <p>Tous droits réservés · Développé et édité par CCOI SERVICES</p>
      </div>

      {/* ══ STYLES ════════════════════════════════════════════════════════ */}
      <style jsx global>{`

        /* ── Root ── */
        .lp-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          overflow: hidden;
          position: relative;
          background: #06061a;
        }

        /* ── Background ── */
        .lp-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .lp-gradient {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 80% 60% at 50% 0%, #1e1b5e 0%, #0d0d2e 50%, #06061a 100%);
        }

        /* ── Orbs ── */
        .lp-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          animation: lp-orb-drift 14s ease-in-out infinite alternate;
        }
        .lp-orb-1 { width:600px; height:600px; top:-200px; left:-150px; background:rgba(99,102,241,0.28); animation-delay:0s; }
        .lp-orb-2 { width:500px; height:500px; bottom:-180px; right:-120px; background:rgba(139,92,246,0.25); animation-delay:-5s; }
        .lp-orb-3 { width:350px; height:350px; top:30%; right:10%; background:rgba(59,130,246,0.2); animation-delay:-9s; }
        .lp-orb-4 { width:280px; height:280px; bottom:25%; left:8%; background:rgba(168,85,247,0.18); animation-delay:-3s; }

        @keyframes lp-orb-drift {
          from { transform: translate(0,0) scale(1); }
          to   { transform: translate(50px,-50px) scale(1.12); }
        }

        /* ── Concentric rings ── */
        .lp-rings-center {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }
        .lp-ring {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(139,92,246,0.18);
          top: 50%; left: 50%;
          transform: translate(-50%, -50%) scale(0.6);
          animation: lp-ring-pulse ease-out infinite;
        }
        @keyframes lp-ring-pulse {
          0%   { transform: translate(-50%,-50%) scale(0.5); opacity:0.8; }
          70%  { transform: translate(-50%,-50%) scale(1);   opacity:0.2; }
          100% { transform: translate(-50%,-50%) scale(1.1); opacity:0;   }
        }

        /* ── Grid ── */
        .lp-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(139,92,246,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,92,246,0.04) 1px, transparent 1px);
          background-size: 60px 60px;
          animation: lp-grid-shift 20s linear infinite;
        }
        @keyframes lp-grid-shift {
          from { background-position: 0 0; }
          to   { background-position: 60px 60px; }
        }

        /* ── Hexagons ── */
        .lp-hex {
          position: absolute;
          border: 1.5px solid rgba(139,92,246,0.25);
          clip-path: polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);
          animation: lp-hex-float ease-in-out infinite alternate;
        }
        @keyframes lp-hex-float {
          from { transform: translateY(0) rotate(0deg);   opacity:0.35; }
          to   { transform: translateY(-20px) rotate(30deg); opacity:0.7; }
        }

        /* ── Light beams ── */
        .lp-beam {
          position: absolute;
          bottom: 0;
          width: 1px;
          background: linear-gradient(to top, rgba(139,92,246,0.5), transparent);
          animation: lp-beam-rise 4s ease-in-out infinite;
        }
        @keyframes lp-beam-rise {
          0%,100% { opacity:0; transform:scaleY(0) translateY(0); transform-origin: bottom; }
          50%      { opacity:1; transform:scaleY(1) translateY(0); }
        }

        /* ── Particles ── */
        .lp-particle {
          position: absolute;
          bottom: -10px;
          background: white;
          border-radius: 50%;
          animation: lp-particle-rise linear infinite;
        }
        @keyframes lp-particle-rise {
          0%   { transform: translateY(0) rotate(0deg);   opacity:0; }
          10%  { opacity:1; }
          90%  { opacity:0.8; }
          100% { transform: translateY(-105vh) rotate(540deg); opacity:0; }
        }

        /* ── Corner decorations ── */
        .lp-corner {
          position: absolute;
          width: 120px; height: 120px;
          border-color: rgba(139,92,246,0.3);
          border-style: solid;
          animation: lp-corner-fade 3s ease-in-out infinite alternate;
        }
        .lp-corner-tl { top:20px; left:20px;  border-width:2px 0 0 2px; border-radius:8px 0 0 0; }
        .lp-corner-tr { top:20px; right:20px; border-width:2px 2px 0 0; border-radius:0 8px 0 0; animation-delay:-1s; }
        .lp-corner-bl { bottom:20px; left:20px;  border-width:0 0 2px 2px; border-radius:0 0 0 8px; animation-delay:-2s; }
        .lp-corner-br { bottom:20px; right:20px; border-width:0 2px 2px 0; border-radius:0 0 8px 0; animation-delay:-0.5s; }
        @keyframes lp-corner-fade {
          from { opacity:0.3; }
          to   { opacity:0.9; }
        }

        /* ── Card ── */
        .lp-card-wrap {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 440px;
          animation: lp-fade-up 0.7s cubic-bezier(.22,1,.36,1) both;
        }
        .lp-card {
          background: rgba(255,255,255,0.97);
          backdrop-filter: blur(24px);
          border-radius: 20px;
          box-shadow: 0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.15), inset 0 1px 0 rgba(255,255,255,0.9);
          padding: 2.5rem 2rem;
          position: relative;
          overflow: hidden;
        }
        .lp-card-glow {
          position: absolute;
          top: -2px; left: 10%; right: 10%;
          height: 3px;
          background: linear-gradient(90deg, transparent, #7c3aed, #6366f1, #7c3aed, transparent);
          border-radius: 0 0 4px 4px;
          animation: lp-glow-sweep 3s ease-in-out infinite;
        }
        @keyframes lp-glow-sweep {
          0%,100% { opacity:0.4; transform:scaleX(0.6); }
          50%      { opacity:1;   transform:scaleX(1);   }
        }

        /* ── Logo ── */
        .lp-logo-wrap {
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 1.25rem;
          position: relative;
        }
        .lp-logo-ring {
          position: absolute;
          width: 90px; height: 90px;
          border: 2px solid rgba(99,102,241,0.2);
          border-radius: 50%;
          animation: lp-logo-spin 6s linear infinite;
          border-top-color: rgba(99,102,241,0.7);
        }
        @keyframes lp-logo-spin {
          to { transform: rotate(360deg); }
        }
        .lp-logo-inner {
          animation: lp-logo-pulse 3s ease-in-out infinite;
        }
        @keyframes lp-logo-pulse {
          0%,100% { transform:scale(1);    filter:drop-shadow(0 0 0 transparent); }
          50%      { transform:scale(1.05); filter:drop-shadow(0 0 14px rgba(99,102,241,0.5)); }
        }

        /* ── Typography ── */
        .lp-title    { text-align:center; font-size:1.2rem; font-weight:700; color:#111827; margin-bottom:0.25rem; }
        .lp-subtitle { text-align:center; font-size:0.875rem; color:#6b7280; margin-bottom:1.75rem; }
        .lp-label    { display:block; font-size:0.875rem; font-weight:500; color:#374151; margin-bottom:0.25rem; }
        .lp-err      { color:#ef4444; font-size:0.75rem; margin-top:0.25rem; }
        .lp-alert    { background:#fef2f2; border:1px solid #fecaca; color:#dc2626; font-size:0.875rem; padding:0.75rem 1rem; border-radius:0.5rem; }
        .lp-form     { display:flex; flex-direction:column; gap:1.25rem; }

        .lp-footer-link {
          margin-top: 1.5rem;
          padding-top: 1.25rem;
          border-top: 1px solid #f3f4f6;
          text-align: center;
        }

        /* ── Copyright ── */
        .lp-copyright {
          position: relative;
          z-index: 10;
          margin-top: 1.5rem;
          text-align: center;
          animation: lp-fade-up 0.7s cubic-bezier(.22,1,.36,1) 0.25s both;
        }
        .lp-copyright p:first-child { color:rgba(255,255,255,0.6); font-size:0.75rem; }
        .lp-copyright strong        { color:rgba(255,255,255,0.85); font-weight:600; }
        .lp-copyright p:last-child  { color:rgba(255,255,255,0.35); font-size:0.7rem; margin-top:2px; }

        /* ── Entrance animation ── */
        @keyframes lp-fade-up {
          from { opacity:0; transform:translateY(28px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  );
}
