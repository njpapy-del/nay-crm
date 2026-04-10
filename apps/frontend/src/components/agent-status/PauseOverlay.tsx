'use client';

import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';

const PAUSE_META: Record<string, { label: string; icon: string; bg: string; accent: string }> = {
  DEBRIEF:       { label: 'Débrief',            icon: '📋', bg: 'from-purple-900 to-purple-700', accent: 'bg-purple-500' },
  COFFEE_BREAK:  { label: 'Pause café',         icon: '☕', bg: 'from-amber-900 to-amber-700',   accent: 'bg-amber-500'  },
  TOILET_BREAK:  { label: 'Pause toilette',     icon: '🚻', bg: 'from-purple-900 to-purple-700', accent: 'bg-purple-500' },
  LUNCH_BREAK:   { label: 'Pause déjeuner',     icon: '🍽️', bg: 'from-orange-900 to-orange-700', accent: 'bg-orange-500' },
  TRAINING:      { label: 'Formation',          icon: '📚', bg: 'from-teal-900 to-teal-700',     accent: 'bg-teal-500'   },
  TECH_ISSUE:    { label: 'Problème technique', icon: '🔧', bg: 'from-red-900 to-red-700',       accent: 'bg-red-500'    },
  PAUSED:        { label: 'En pause',           icon: '⏸️', bg: 'from-gray-900 to-gray-700',     accent: 'bg-gray-500'   },
};

const fmtTimer = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
};

interface Props {
  reason: string;         // clé PAUSE_META
  onResume: () => void;
  loading?: boolean;
}

export function PauseOverlay({ reason, onResume, loading = false }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [reason]);

  const meta = PAUSE_META[reason] ?? PAUSE_META.PAUSED;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Fond flouté */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

      {/* Carte centrale */}
      <div className={`relative z-10 flex flex-col items-center gap-8 px-16 py-12 rounded-3xl bg-gradient-to-br ${meta.bg} shadow-2xl text-white text-center max-w-sm w-full mx-4`}>

        {/* Icône animée */}
        <div className="relative">
          <div className={`w-24 h-24 rounded-full ${meta.accent} flex items-center justify-center text-5xl shadow-lg`}>
            {meta.icon}
          </div>
          {/* Anneau pulsant */}
          <div className={`absolute inset-0 rounded-full ${meta.accent} opacity-30 animate-ping`} />
        </div>

        {/* Titre */}
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-white/60 mb-1">En pause</p>
          <p className="text-3xl font-bold">{meta.label}</p>
        </div>

        {/* Compteur */}
        <div className="flex flex-col items-center">
          <p className="text-6xl font-mono font-bold tabular-nums tracking-tight">
            {fmtTimer(elapsed)}
          </p>
          <p className="text-sm text-white/50 mt-2">Durée de la pause</p>
        </div>

        {/* Bouton reprendre */}
        <button
          onClick={onResume}
          disabled={loading}
          className="flex items-center gap-3 px-10 py-4 rounded-2xl bg-green-500 hover:bg-green-400 active:scale-95 transition-all font-bold text-lg shadow-lg shadow-green-900/40 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Play size={22} fill="white" />
          {loading ? 'Reprise…' : 'Reprendre'}
        </button>

        <p className="text-xs text-white/40">
          La page est verrouillée pendant la pause
        </p>
      </div>
    </div>
  );
}
