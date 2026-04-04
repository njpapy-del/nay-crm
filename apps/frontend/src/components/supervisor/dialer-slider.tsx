'use client';

import { useState } from 'react';
import { Zap, Play, Square, Gauge } from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

type DialerMode = 'PROGRESSIVE' | 'PREDICTIVE' | 'PREVIEW';

interface Campaign { id: string; name: string; _count: { leads: number }; }

interface Props {
  campaigns: Campaign[];
  activeSessions: { campaignId: string; mode: string; active: boolean }[];
  onStart: (campaignId: string, mode: DialerMode, ratio: number) => void;
  onStop:  (campaignId: string) => void;
}

const MODE_INFO: Record<DialerMode, { desc: string; color: string }> = {
  PROGRESSIVE: { desc: '1 appel / agent libre',            color: 'bg-blue-500' },
  PREDICTIVE:  { desc: 'Ratio ajustable — plus de volume', color: 'bg-orange-500' },
  PREVIEW:     { desc: 'Agent valide avant appel',          color: 'bg-purple-500' },
};

export function DialerSlider({ campaigns, activeSessions, onStart, onStop }: Props) {
  const [campaignId, setCampaignId] = useState('');
  const [mode, setMode]             = useState<DialerMode>('PROGRESSIVE');
  const [ratio, setRatio]           = useState(1.2);

  const isRunning = (id: string) => activeSessions.some((s) => s.campaignId === id && s.active);

  const handleStart = () => {
    if (!campaignId) return;
    onStart(campaignId, mode, ratio);
  };

  return (
    <div className="space-y-4">
      {/* Campagne */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Campagne</label>
        <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="input-field text-sm">
          <option value="">Sélectionner...</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name} — {c._count.leads} leads</option>
          ))}
        </select>
      </div>

      {/* Mode */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Mode</label>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(MODE_INFO) as DialerMode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={clsx('py-2 px-1 rounded-lg text-[11px] font-semibold text-center border-2 transition-all',
                mode === m ? `${MODE_INFO[m].color} text-white border-transparent` : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300')}>
              {m === 'PROGRESSIVE' ? 'Progressif' : m === 'PREDICTIVE' ? 'Prédictif' : 'Prévisuel'}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-1 text-center">{MODE_INFO[mode].desc}</p>
      </div>

      {/* Slider ratio (uniquement PREDICTIVE) */}
      {mode === 'PREDICTIVE' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <Gauge size={12} /> Ratio appels/agent
            </label>
            <span className="text-sm font-bold text-orange-600">{ratio.toFixed(1)}×</span>
          </div>
          <input type="range" min="1.0" max="3.0" step="0.1"
            value={ratio} onChange={(e) => setRatio(+e.target.value)}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500" />
          <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
            <span>Conservateur 1.0×</span>
            <span>Agressif 3.0×</span>
          </div>
        </div>
      )}

      {/* Bouton start */}
      <button onClick={handleStart} disabled={!campaignId || isRunning(campaignId)}
        className="w-full btn-primary flex items-center justify-center gap-2 text-sm disabled:opacity-50">
        <Play size={15} /> Lancer le dialer
      </button>

      {/* Sessions actives */}
      {activeSessions.filter((s) => s.active).length > 0 && (
        <div className="pt-2 border-t border-gray-100 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase">Sessions actives</p>
          {activeSessions.filter((s) => s.active).map((s) => {
            const camp = campaigns.find((c) => c.id === s.campaignId);
            return (
              <div key={s.campaignId}
                className="flex items-center justify-between p-2.5 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <Zap size={13} className="text-green-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{camp?.name ?? s.campaignId}</p>
                    <p className="text-[10px] text-gray-500">{s.mode}</p>
                  </div>
                </div>
                <button onClick={() => onStop(s.campaignId)}
                  className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors shrink-0">
                  <Square size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
